import express, { Request, Response } from 'express';
import crypto from 'crypto';
import {
  validatePassword,
  hashPassword,
  verifyPassword,
  generateTotpSetup,
  verifyTotpToken,
  generateRecoveryCodes,
  verifyAndConsumeRecoveryCode,
  logAudit,
  createSession,
  requireAuth,
  AuthenticatedRequest,
} from '../auth.js';
import { queryOne, queryAll, runQuery } from '../db.js';

const router = express.Router();

// GET /api/auth/status
router.get('/status', (req: Request, res: Response) => {
  try {
    const adminUser = queryOne<{ id: string; username: string }>('SELECT id, username FROM users LIMIT 1');
    const isInitialized = !!adminUser;

    let isAuthenticated = false;
    let currentUser = null;
    let twoFactorEnabled = false;

    const token = req.cookies?.hostel_session || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
    if (token) {
      const session = queryOne<{ id: string; user_id: string; expires_at: string }>(
        'SELECT id, user_id, expires_at FROM sessions WHERE id = ?',
        [token]
      );
      if (session && new Date(session.expires_at) > new Date()) {
        const user = queryOne<{ id: string; username: string; role: string }>(
          'SELECT id, username, role FROM users WHERE id = ?',
          [session.user_id]
        );
        if (user) {
          isAuthenticated = true;
          currentUser = user;
          const sec = queryOne<{ two_factor_enabled: number }>(
            'SELECT two_factor_enabled FROM user_security WHERE user_id = ?',
            [user.id]
          );
          twoFactorEnabled = sec ? sec.two_factor_enabled === 1 : false;
        }
      }
    }

    res.json({
      initialized: isInitialized,
      twoFactorEnabled,
      authenticated: isAuthenticated,
      user: currentUser,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve auth status', details: err.message });
  }
});

// Helper for user account creation
async function handleUserRegistration(req: Request, res: Response) {
  const { username, password, confirmPassword } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    res.status(400).json({ error: 'Username is required (minimum 3 characters).' });
    return;
  }

  const cleanUsername = username.trim();

  if (!password || !confirmPassword) {
    res.status(400).json({ error: 'Password and confirmation password are required.' });
    return;
  }

  if (password !== confirmPassword) {
    res.status(400).json({ error: 'Passwords do not match.' });
    return;
  }

  const pwdCheck = validatePassword(password);
  if (!pwdCheck.valid) {
    res.status(400).json({ error: pwdCheck.message });
    return;
  }

  // Check if username already exists
  const existing = queryOne<{ id: string }>('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [cleanUsername]);
  if (existing) {
    res.status(400).json({ error: 'An account with this username already exists. Please choose another username or log in.' });
    return;
  }

  const existingCount = queryOne<{ cnt: number }>('SELECT count(*) as cnt FROM users');
  const isFirstUser = !existingCount || existingCount.cnt === 0;
  const role = 'admin';

  if (isFirstUser) {
    // Brand new initial setup: ensure all old records, students, rooms, beds, rent, payments, expenses are clean
    try {
      runQuery('DELETE FROM receipts;');
      runQuery('DELETE FROM payments;');
      runQuery('DELETE FROM rent_records;');
      runQuery('DELETE FROM room_allocations;');
      runQuery('DELETE FROM beds;');
      runQuery('DELETE FROM rooms;');
      runQuery('DELETE FROM students;');
      runQuery('DELETE FROM expenses;');
      runQuery('DELETE FROM audit_logs;');
    } catch (e) {
      console.error('Error ensuring fresh database tables on setup:', e);
    }
  }

  const userId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  // Create user
  runQuery(
    'INSERT INTO users (id, username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, cleanUsername, passwordHash, role, now, now]
  );

  // Initialize security with 2FA disabled (0) by default
  runQuery(
    `INSERT INTO user_security (
      user_id, two_factor_secret, two_factor_enabled, recovery_codes, failed_attempts, last_login_at
    ) VALUES (?, NULL, 0, '[]', 0, ?)`,
    [userId, now]
  );

  // Automatically create session so user is logged in immediately
  const sessionId = createSession(userId, req.ip, req.headers['user-agent']);
  res.cookie('hostel_session', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });

  logAudit('ACCOUNT_CREATION', `Account created for '${cleanUsername}'. Two-Factor Authentication is currently OFF.`, userId, cleanUsername, req.ip);

  res.json({
    success: true,
    message: 'Account created successfully! You are now logged in.',
    token: sessionId,
    user: {
      id: userId,
      username: cleanUsername,
      role,
    },
    twoFactorEnabled: false,
  });
}

// POST /api/auth/register: Create user account
router.post('/register', async (req: Request, res: Response) => {
  try {
    await handleUserRegistration(req, res);
  } catch (err: any) {
    res.status(500).json({ error: 'Error creating account: ' + err.message });
  }
});

// POST /api/auth/setup-admin: First account creation (alias)
router.post('/setup-admin', async (req: Request, res: Response) => {
  try {
    await handleUserRegistration(req, res);
  } catch (err: any) {
    res.status(500).json({ error: 'Error setting up administrator: ' + err.message });
  }
});

// POST /api/auth/login-step1: Verify username and password
router.post('/login-step1', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const cleanUsername = String(username).trim();
    const user = queryOne<{ id: string; username: string; password_hash: string; role: string }>(
      'SELECT id, username, password_hash, role FROM users WHERE LOWER(username) = LOWER(?)',
      [cleanUsername]
    );

    if (!user) {
      const anyUser = queryOne<{ count: number }>('SELECT count(*) as count FROM users');
      if (!anyUser || anyUser.count === 0) {
        res.status(401).json({
          error: 'सिस्टम में अभी कोई अकाउंट मौजूद नहीं है। कृपया "क्रिएट अकाउंट (Register)" टैब से अपना नया एडमिन अकाउंट बनाएं (No account exists. Please create your admin account first).'
        });
        return;
      }
      logAudit('LOGIN_FAILED', `Failed login attempt for nonexistent user: ${cleanUsername}`, undefined, cleanUsername, req.ip);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const sec = queryOne<{
      failed_attempts: number;
      lockout_until: string | null;
      two_factor_enabled: number;
      two_factor_secret: string | null;
    }>('SELECT failed_attempts, lockout_until, two_factor_enabled, two_factor_secret FROM user_security WHERE user_id = ?', [user.id]);

    // Check account lockout
    if (sec?.lockout_until && new Date(sec.lockout_until) > new Date()) {
      const waitMin = Math.ceil((new Date(sec.lockout_until).getTime() - Date.now()) / 60000);
      res.status(429).json({
        error: `Account is temporarily locked due to repeated failed logins. Please try again in ${waitMin} minute(s).`,
      });
      return;
    }

    const match = await verifyPassword(password, user.password_hash);
    if (!match) {
      const attempts = (sec?.failed_attempts || 0) + 1;
      let lockout: string | null = null;
      if (attempts >= 5) {
        lockout = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes lockout
      }
      runQuery(
        'UPDATE user_security SET failed_attempts = ?, lockout_until = ? WHERE user_id = ?',
        [attempts, lockout, user.id]
      );
      logAudit('LOGIN_FAILED', `Incorrect password for user: ${user.username}`, user.id, user.username, req.ip);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    // Password is valid! Check if 2FA is enabled for this user
    const has2FA = sec && sec.two_factor_enabled === 1 && !!sec.two_factor_secret;

    if (has2FA) {
      // 2FA is ENABLED: issue challenge token for Step 2
      const challengeToken = 'chl_' + crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes validity

      runQuery(
        'INSERT INTO challenge_tokens (token, user_id, expires_at, type, created_at) VALUES (?, ?, ?, ?, ?)',
        [challengeToken, user.id, expiresAt, 'login_2fa', new Date().toISOString()]
      );

      res.json({
        success: true,
        requires2FA: true,
        challengeToken,
        username: user.username,
        message: 'Enter the 6-digit verification code from Google Authenticator.',
      });
      return;
    }

    // 2FA is NOT ENABLED: log in directly!
    const now = new Date().toISOString();
    runQuery(
      'UPDATE user_security SET failed_attempts = 0, lockout_until = null, last_login_at = ? WHERE user_id = ?',
      [now, user.id]
    );

    const sessionId = createSession(user.id, req.ip, req.headers['user-agent']);
    res.cookie('hostel_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    logAudit('LOGIN_SUCCESS', 'Logged in successfully (2FA disabled).', user.id, user.username, req.ip);

    res.json({
      success: true,
      requires2FA: false,
      token: sessionId,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login error: ' + err.message });
  }
});

// POST /api/auth/login-step2: Verify TOTP or Recovery Code and issue session
router.post('/login-step2', (req: Request, res: Response) => {
  try {
    const { challengeToken, totpCode } = req.body;

    if (!challengeToken || !totpCode) {
      res.status(400).json({ error: 'Challenge token and 6-digit authentication code are required.' });
      return;
    }

    const challenge = queryOne<{ token: string; user_id: string; expires_at: string; type: string }>(
      'SELECT token, user_id, expires_at, type FROM challenge_tokens WHERE token = ?',
      [challengeToken]
    );

    if (!challenge || challenge.type !== 'login_2fa') {
      res.status(400).json({ error: 'Invalid or expired login challenge. Please enter your credentials again.' });
      return;
    }

    if (new Date(challenge.expires_at) < new Date()) {
      runQuery('DELETE FROM challenge_tokens WHERE token = ?', [challengeToken]);
      res.status(400).json({ error: 'Login challenge expired. Please enter your credentials again.' });
      return;
    }

    const user = queryOne<{ id: string; username: string; role: string }>(
      'SELECT id, username, role FROM users WHERE id = ?',
      [challenge.user_id]
    );
    if (!user) {
      res.status(400).json({ error: 'User account not found.' });
      return;
    }

    const sec = queryOne<{ two_factor_secret: string; failed_attempts: number }>(
      'SELECT two_factor_secret, failed_attempts FROM user_security WHERE user_id = ?',
      [user.id]
    );

    const cleanCode = String(totpCode).trim();
    let isTotpValid = false;

    if (sec?.two_factor_secret) {
      isTotpValid = verifyTotpToken(sec.two_factor_secret, cleanCode);
    }

    let usedRecoveryCode = false;
    if (!isTotpValid) {
      // Check if it's a valid one-time recovery code
      usedRecoveryCode = verifyAndConsumeRecoveryCode(user.id, cleanCode);
    }

    if (!isTotpValid && !usedRecoveryCode) {
      const attempts = (sec?.failed_attempts || 0) + 1;
      runQuery('UPDATE user_security SET failed_attempts = ? WHERE user_id = ?', [attempts, user.id]);
      logAudit('2FA_FAILED', `Invalid 2FA code entered for user: ${user.username}`, user.id, user.username, req.ip);
      res.status(401).json({ error: 'Invalid Google Authenticator code. Please check your app or use a recovery code.' });
      return;
    }

    // Success! Invalidate challenge token
    runQuery('DELETE FROM challenge_tokens WHERE token = ?', [challengeToken]);

    // Reset failed attempts & update last login
    const now = new Date().toISOString();
    runQuery(
      'UPDATE user_security SET failed_attempts = 0, lockout_until = null, last_login_at = ? WHERE user_id = ?',
      [now, user.id]
    );

    // Create session
    const sessionId = createSession(user.id, req.ip, req.headers['user-agent']);
    res.cookie('hostel_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    logAudit(
      'LOGIN_SUCCESS',
      usedRecoveryCode ? 'Logged in using recovery code.' : 'Logged in successfully with Google Authenticator.',
      user.id,
      user.username,
      req.ip
    );

    res.json({
      success: true,
      token: sessionId,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      usedRecoveryCode,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Login verification error: ' + err.message });
  }
});

// POST /api/auth/enable-2fa-init: Begin 2FA setup from Settings
router.post('/enable-2fa-init', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const totpSetup = await generateTotpSetup(user.username);
    const { plainCodes, hashedCodes } = generateRecoveryCodes();

    const setupToken = 'set2fa_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();

    // Store pending setup in challenge_tokens
    runQuery(
      'INSERT INTO challenge_tokens (token, user_id, expires_at, type, created_at) VALUES (?, ?, ?, ?, ?)',
      [setupToken, user.id, expiresAt, 'enable_2fa_' + totpSetup.secret, new Date().toISOString()]
    );

    // Also store the pending hashed recovery codes
    const recToken = 'rec_' + setupToken;
    runQuery(
      'INSERT INTO challenge_tokens (token, user_id, expires_at, type, created_at) VALUES (?, ?, ?, ?, ?)',
      [recToken, user.id, expiresAt, JSON.stringify(hashedCodes), new Date().toISOString()]
    );

    res.json({
      success: true,
      setupToken,
      qrCodeUrl: totpSetup.qrCodeUrl,
      manualKey: totpSetup.secret,
      recoveryCodes: plainCodes,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to initiate 2FA setup: ' + err.message });
  }
});

// POST /api/auth/enable-2fa-confirm: Verify TOTP and turn ON 2FA
router.post('/enable-2fa-confirm', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { setupToken, totpCode } = req.body;

    if (!setupToken || !totpCode) {
      res.status(400).json({ error: 'Setup token and 6-digit verification code are required.' });
      return;
    }

    const challenge = queryOne<{ token: string; user_id: string; expires_at: string; type: string }>(
      'SELECT token, user_id, expires_at, type FROM challenge_tokens WHERE token = ?',
      [setupToken]
    );

    if (!challenge || !challenge.type.startsWith('enable_2fa_') || challenge.user_id !== userId) {
      res.status(400).json({ error: 'Invalid or expired setup session. Please try again.' });
      return;
    }

    if (new Date(challenge.expires_at) < new Date()) {
      runQuery('DELETE FROM challenge_tokens WHERE token = ?', [setupToken]);
      res.status(400).json({ error: 'Setup session expired. Please generate a new QR code.' });
      return;
    }

    const secret = challenge.type.replace('enable_2fa_', '');
    const cleanCode = String(totpCode).trim();

    if (!verifyTotpToken(secret, cleanCode)) {
      res.status(400).json({ error: 'Invalid 6-digit code. Please verify against Google Authenticator and try again.' });
      return;
    }

    // Retrieve hashed recovery codes
    const recToken = 'rec_' + setupToken;
    const recChallenge = queryOne<{ type: string }>('SELECT type FROM challenge_tokens WHERE token = ?', [recToken]);
    const hashedCodes = recChallenge?.type || '[]';

    // Enable 2FA in user_security!
    runQuery(
      'UPDATE user_security SET two_factor_secret = ?, two_factor_enabled = 1, recovery_codes = ? WHERE user_id = ?',
      [secret, hashedCodes, userId]
    );

    // Clean up tokens
    runQuery('DELETE FROM challenge_tokens WHERE token = ? OR token = ?', [setupToken, recToken]);

    logAudit('2FA_ENABLED', 'Two-Factor Authentication (Google Authenticator) successfully activated.', userId, req.user!.username, req.ip);

    res.json({
      success: true,
      message: 'Two-Factor Authentication is now ENABLED! You will be required to enter Google Authenticator OTP on future logins.',
      twoFactorEnabled: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to confirm 2FA: ' + err.message });
  }
});

// POST /api/auth/disable-2fa: Turn OFF 2FA from Settings
router.post('/disable-2fa', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { currentPassword } = req.body;

    if (!currentPassword) {
      res.status(400).json({ error: 'Password confirmation is required to disable Two-Factor Authentication.' });
      return;
    }

    const user = queryOne<{ password_hash: string; username: string }>('SELECT password_hash, username FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const match = await verifyPassword(currentPassword, user.password_hash);
    if (!match) {
      res.status(400).json({ error: 'Incorrect password.' });
      return;
    }

    runQuery('UPDATE user_security SET two_factor_enabled = 0 WHERE user_id = ?', [userId]);
    logAudit('2FA_DISABLED', 'Two-Factor Authentication was disabled by user.', userId, user.username, req.ip);

    res.json({
      success: true,
      message: 'Two-Factor Authentication has been disabled. You can now log in using just username and password.',
      twoFactorEnabled: false,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to disable 2FA: ' + err.message });
  }
});

// POST /api/auth/verify-2fa-setup: Legacy compatibility
router.post('/verify-2fa-setup', (req: Request, res: Response) => {
  try {
    const { setupToken, totpCode } = req.body;

    if (!setupToken || !totpCode) {
      res.status(400).json({ error: 'Setup token and 6-digit verification code are required.' });
      return;
    }

    const challenge = queryOne<{ token: string; user_id: string; expires_at: string; type: string }>(
      'SELECT token, user_id, expires_at, type FROM challenge_tokens WHERE token = ?',
      [setupToken]
    );

    if (!challenge) {
      res.status(400).json({ error: 'Invalid or expired setup session. Please refresh and try again.' });
      return;
    }

    const sec = queryOne<{ two_factor_secret: string }>(
      'SELECT two_factor_secret FROM user_security WHERE user_id = ?',
      [challenge.user_id]
    );

    if (!sec || !sec.two_factor_secret) {
      res.status(400).json({ error: 'Security profile not found.' });
      return;
    }

    const cleanCode = String(totpCode).trim();
    const isValid = verifyTotpToken(sec.two_factor_secret, cleanCode);

    if (!isValid) {
      res.status(400).json({ error: 'Invalid authentication code. Please ensure your device clock is accurate and try again.' });
      return;
    }

    runQuery('UPDATE user_security SET two_factor_enabled = 1 WHERE user_id = ?', [challenge.user_id]);
    runQuery('DELETE FROM challenge_tokens WHERE token = ?', [setupToken]);

    const user = queryOne<{ username: string }>('SELECT username FROM users WHERE id = ?', [challenge.user_id]);
    logAudit('2FA_SETUP_COMPLETED', 'Two-Factor Authentication successfully verified and enabled.', challenge.user_id, user?.username, req.ip);

    res.json({
      success: true,
      message: 'Two-factor authentication successfully configured.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to verify 2FA setup: ' + err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  const token = req.cookies?.hostel_session || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  if (token) {
    const session = queryOne<{ user_id: string }>('SELECT user_id FROM sessions WHERE id = ?', [token]);
    runQuery('DELETE FROM sessions WHERE id = ?', [token]);
    if (session) {
      logAudit('LOGOUT', 'User logged out.', session.user_id, undefined, req.ip);
    }
  }
  res.clearCookie('hostel_session');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const sec = queryOne<{ two_factor_enabled: number; last_login_at: string | null }>(
    'SELECT two_factor_enabled, last_login_at FROM user_security WHERE user_id = ?',
    [user.id]
  );
  res.json({
    user,
    twoFactorEnabled: sec?.two_factor_enabled === 1,
    lastLoginAt: sec?.last_login_at,
  });
});

// POST /api/auth/change-password
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ error: 'All password fields are required.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: 'New passwords do not match.' });
      return;
    }

    const pwdCheck = validatePassword(newPassword);
    if (!pwdCheck.valid) {
      res.status(400).json({ error: pwdCheck.message });
      return;
    }

    const user = queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const match = await verifyPassword(currentPassword, user.password_hash);
    if (!match) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const newHash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    runQuery('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [newHash, now, userId]);

    logAudit('PASSWORD_CHANGED', 'Password changed successfully.', userId, req.user!.username, req.ip);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update password: ' + err.message });
  }
});

// POST /api/auth/reconfigure-2fa: Request new TOTP setup
router.post('/reconfigure-2fa', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { currentPassword } = req.body;

    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required to configure two-factor authentication.' });
      return;
    }

    const user = queryOne<{ password_hash: string; username: string }>('SELECT password_hash, username FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const match = await verifyPassword(currentPassword, user.password_hash);
    if (!match) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const totpSetup = await generateTotpSetup(user.username);
    const { plainCodes, hashedCodes } = generateRecoveryCodes();

    const token = 're2fa_' + crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    runQuery(
      'INSERT INTO challenge_tokens (token, user_id, expires_at, type, created_at) VALUES (?, ?, ?, ?, ?)',
      [token, userId, expiresAt, 'reconf_' + totpSetup.secret, new Date().toISOString()]
    );

    const recToken = 'rec_' + token;
    runQuery(
      'INSERT INTO challenge_tokens (token, user_id, expires_at, type, created_at) VALUES (?, ?, ?, ?, ?)',
      [recToken, userId, expiresAt, JSON.stringify(hashedCodes), new Date().toISOString()]
    );

    res.json({
      success: true,
      reconfigureToken: token,
      qrCodeUrl: totpSetup.qrCodeUrl,
      manualKey: totpSetup.secret,
      recoveryCodes: plainCodes,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to initiate 2FA setup: ' + err.message });
  }
});

// POST /api/auth/verify-reconfigure-2fa: Finalize new 2FA
router.post('/verify-reconfigure-2fa', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { reconfigureToken, totpCode } = req.body;

    if (!reconfigureToken || !totpCode) {
      res.status(400).json({ error: 'Reconfigure token and verification code are required.' });
      return;
    }

    const challenge = queryOne<{ token: string; user_id: string; expires_at: string; type: string }>(
      'SELECT token, user_id, expires_at, type FROM challenge_tokens WHERE token = ?',
      [reconfigureToken]
    );

    if (!challenge || !challenge.type.startsWith('reconf_') || challenge.user_id !== userId) {
      res.status(400).json({ error: 'Invalid or expired reconfiguration request.' });
      return;
    }

    if (new Date(challenge.expires_at) < new Date()) {
      runQuery('DELETE FROM challenge_tokens WHERE token = ?', [reconfigureToken]);
      res.status(400).json({ error: 'Reconfiguration token expired.' });
      return;
    }

    const newSecret = challenge.type.replace('reconf_', '');
    const cleanCode = String(totpCode).trim();

    if (!verifyTotpToken(newSecret, cleanCode)) {
      res.status(400).json({ error: 'Invalid authenticator code. Check your authenticator app.' });
      return;
    }

    const recToken = 'rec_' + reconfigureToken;
    const recChallenge = queryOne<{ type: string }>('SELECT type FROM challenge_tokens WHERE token = ?', [recToken]);
    const hashedCodes = recChallenge?.type || '[]';

    runQuery(
      'UPDATE user_security SET two_factor_secret = ?, two_factor_enabled = 1, recovery_codes = ? WHERE user_id = ?',
      [newSecret, hashedCodes, userId]
    );

    runQuery('DELETE FROM challenge_tokens WHERE token = ? OR token = ?', [reconfigureToken, recToken]);
    logAudit('2FA_CONFIGURED', 'Two-Factor Authentication configured with new secret and recovery codes.', userId, req.user!.username, req.ip);

    res.json({ success: true, message: 'Google Authenticator 2FA successfully updated and enabled.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Error verifying configuration: ' + err.message });
  }
});

// POST /api/auth/generate-recovery-codes
router.post('/generate-recovery-codes', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { currentPassword } = req.body;

    if (!currentPassword) {
      res.status(400).json({ error: 'Current password is required to generate new recovery codes.' });
      return;
    }

    const user = queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const match = await verifyPassword(currentPassword, user.password_hash);
    if (!match) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    const { plainCodes, hashedCodes } = generateRecoveryCodes();
    runQuery('UPDATE user_security SET recovery_codes = ? WHERE user_id = ?', [JSON.stringify(hashedCodes), userId]);

    logAudit('RECOVERY_CODES_REGENERATED', 'New one-time recovery codes generated.', userId, req.user!.username, req.ip);
    res.json({
      success: true,
      recoveryCodes: plainCodes,
      message: 'New recovery codes generated. Store them safely.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate recovery codes: ' + err.message });
  }
});

// GET /api/auth/sessions
router.get('/sessions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessions = queryAll<{
      id: string;
      expires_at: string;
      ip_address: string;
      user_agent: string;
      created_at: string;
    }>('SELECT id, expires_at, ip_address, user_agent, created_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC', [req.user!.id]);

    const mapped = sessions.map(s => ({
      id: s.id.substring(0, 8) + '...',
      current: s.id === req.sessionId,
      expiresAt: s.expires_at,
      ipAddress: s.ip_address || 'Unknown',
      userAgent: s.user_agent || 'Unknown',
      createdAt: s.created_at,
    }));

    res.json({ sessions: mapped });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch sessions: ' + err.message });
  }
});

export default router;
