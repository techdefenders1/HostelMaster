import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import { Request, Response, NextFunction } from 'express';
import { queryOne, runQuery } from './db.js';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  sessionId?: string;
}

// Password policy validation
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character.' };
  }
  return { valid: true };
}

// Hash password using bcrypt with salt rounds 12
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate TOTP Secret and QR Code
export async function generateTotpSetup(username: string, issuer: string = 'HostelMaster') {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer,
    label: username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  const uri = totp.toString();
  const qrCodeUrl = await QRCode.toDataURL(uri, {
    margin: 2,
    width: 260,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
  });

  return {
    secret: secret.base32,
    uri,
    qrCodeUrl,
  };
}

// Verify a 6-digit TOTP code
export function verifyTotpToken(secretBase32: string, token: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });

    // delta with window of 1 (checks previous, current, next 30s period)
    const delta = totp.validate({ token: token.trim(), window: 1 });
    return delta !== null;
  } catch (err) {
    return false;
  }
}

// Generate 8 cryptographically secure recovery codes
export function generateRecoveryCodes(): { plainCodes: string[]; hashedCodes: string[] } {
  const plainCodes: string[] = [];
  const hashedCodes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
    plainCodes.push(formatted);
    // Hash recovery code with SHA-256
    const hashed = crypto.createHash('sha256').update(formatted).digest('hex');
    hashedCodes.push(hashed);
  }

  return { plainCodes, hashedCodes };
}

// Verify and burn a recovery code
export function verifyAndConsumeRecoveryCode(userId: string, inputCode: string): boolean {
  const sec = queryOne<{ recovery_codes: string }>(
    'SELECT recovery_codes FROM user_security WHERE user_id = ?',
    [userId]
  );
  if (!sec || !sec.recovery_codes) return false;

  let codes: string[] = [];
  try {
    codes = JSON.parse(sec.recovery_codes);
  } catch {
    return false;
  }

  const cleanInput = inputCode.trim().toUpperCase();
  const hashedInput = crypto.createHash('sha256').update(cleanInput).digest('hex');

  const idx = codes.indexOf(hashedInput);
  if (idx !== -1) {
    // Remove used code
    codes.splice(idx, 1);
    runQuery(
      'UPDATE user_security SET recovery_codes = ? WHERE user_id = ?',
      [JSON.stringify(codes), userId]
    );
    return true;
  }
  return false;
}

// Audit logger helper
export function logAudit(action: string, details?: string, userId?: string, username?: string, ip?: string): void {
  const id = 'aud_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const now = new Date().toISOString();
  try {
    runQuery(
      'INSERT INTO audit_logs (id, user_id, username, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId || null, username || null, action, details || null, ip || '127.0.0.1', now]
    );
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// Create authenticated session
export function createSession(userId: string, ipAddress?: string, userAgent?: string): string {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  runQuery(
    'INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [sessionId, userId, expires.toISOString(), ipAddress || null, userAgent || null, now.toISOString()]
  );

  return sessionId;
}

// Middleware: Authenticate Session
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.hostel_session || req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  if (!token) {
    res.status(401).json({ error: 'Authentication required. No session found.' });
    return;
  }

  const session = queryOne<{ id: string; user_id: string; expires_at: string }>(
    'SELECT id, user_id, expires_at FROM sessions WHERE id = ?',
    [token]
  );

  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    return;
  }

  if (new Date(session.expires_at) < new Date()) {
    runQuery('DELETE FROM sessions WHERE id = ?', [session.id]);
    res.status(401).json({ error: 'Session expired. Please log in again.' });
    return;
  }

  const user = queryOne<AuthUser>(
    'SELECT id, username, role FROM users WHERE id = ?',
    [session.user_id]
  );

  if (!user) {
    runQuery('DELETE FROM sessions WHERE id = ?', [session.id]);
    res.status(401).json({ error: 'User account not found.' });
    return;
  }

  req.user = user;
  req.sessionId = session.id;
  next();
}
