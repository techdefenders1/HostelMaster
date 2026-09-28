import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const BACKUPS_DIR = path.resolve(DATA_DIR, 'backups');
const DB_PATH = path.resolve(DATA_DIR, 'hostel.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

let dbInstance: SqlJsDatabase | null = null;

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  initTables(dbInstance);
  persistDb();
  return dbInstance;
}

export function persistDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error persisting database:', err);
  }
}

// Database query helpers
export function queryAll<T = any>(sql: string, params: any[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = any>(sql: string, params: any[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function runQuery(sql: string, params: any[] = []): void {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  persistDb();
}

function initTables(db: SqlJsDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_security (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      two_factor_secret TEXT,
      two_factor_enabled INTEGER DEFAULT 0,
      recovery_codes TEXT,
      failed_attempts INTEGER DEFAULT 0,
      lockout_until TEXT,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS challenge_tokens (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      hostel_name TEXT NOT NULL,
      hostel_address TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      website TEXT,
      logo_data TEXT,
      signature_data TEXT,
      currency TEXT DEFAULT '₹',
      date_format TEXT DEFAULT 'YYYY-MM-DD',
      default_rent REAL DEFAULT 500,
      receipt_prefix TEXT DEFAULT 'RCP-',
      invoice_prefix TEXT DEFAULT 'INV-',
      late_fee REAL DEFAULT 25,
      authorized_signature TEXT
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      admission_number TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      father_name TEXT,
      mother_name TEXT,
      mobile TEXT NOT NULL,
      alternate_mobile TEXT,
      email TEXT,
      dob TEXT,
      gender TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      pincode TEXT,
      college TEXT,
      course TEXT,
      year_semester TEXT,
      admission_date TEXT NOT NULL,
      guardian_name TEXT,
      guardian_mobile TEXT,
      id_proof_type TEXT,
      id_proof_number TEXT,
      photo_url TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      room_number TEXT UNIQUE NOT NULL,
      floor TEXT NOT NULL,
      room_type TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      monthly_rent REAL NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'available',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS beds (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      bed_number TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(room_id, bed_number)
    );

    CREATE TABLE IF NOT EXISTS room_allocations (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      room_id TEXT NOT NULL REFERENCES rooms(id),
      bed_id TEXT NOT NULL REFERENCES beds(id),
      allocation_date TEXT NOT NULL,
      expected_checkout_date TEXT,
      vacate_date TEXT,
      monthly_rent REAL NOT NULL,
      deposit_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rent_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      allocation_id TEXT REFERENCES room_allocations(id),
      room_id TEXT NOT NULL REFERENCES rooms(id),
      bed_id TEXT NOT NULL REFERENCES beds(id),
      billing_month TEXT NOT NULL,
      billing_period TEXT NOT NULL,
      rent_amount REAL NOT NULL,
      discount REAL DEFAULT 0,
      late_fee REAL DEFAULT 0,
      other_charges REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      pending_amount REAL NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(student_id, billing_period)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      receipt_number TEXT UNIQUE NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id),
      rent_id TEXT REFERENCES rent_records(id),
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      transaction_ref TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      payment_id TEXT UNIQUE NOT NULL REFERENCES payments(id),
      receipt_number TEXT UNIQUE NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id),
      receipt_data TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      vendor TEXT,
      reference_number TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
    CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
    CREATE INDEX IF NOT EXISTS idx_beds_room ON beds(room_id);
    CREATE INDEX IF NOT EXISTS idx_beds_status ON beds(status);
    CREATE INDEX IF NOT EXISTS idx_alloc_student ON room_allocations(student_id);
    CREATE INDEX IF NOT EXISTS idx_alloc_status ON room_allocations(status);
    CREATE INDEX IF NOT EXISTS idx_rent_student ON rent_records(student_id);
    CREATE INDEX IF NOT EXISTS idx_rent_period ON rent_records(billing_period);
    CREATE INDEX IF NOT EXISTS idx_rent_status ON rent_records(status);
    CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
  `);

  // Migration: Ensure signature_data column exists on settings table
  try {
    db.run('ALTER TABLE settings ADD COLUMN signature_data TEXT;');
  } catch {
    // Column already exists
  }

  // Ensure default currency is Rupees (₹)
  try {
    db.run("UPDATE settings SET currency = '₹' WHERE currency = '$' OR currency IS NULL OR currency = '';");
  } catch {
    // Ignore
  }

  // Initialize default settings if none exist
  const existingSettings = db.exec("SELECT id FROM settings WHERE id = 'default_settings'");
  if (!existingSettings || existingSettings.length === 0 || existingSettings[0].values.length === 0) {
    db.run(
      `INSERT INTO settings (
        id, hostel_name, hostel_address, phone, email, website, currency,
        date_format, default_rent, receipt_prefix, invoice_prefix, late_fee, authorized_signature
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'default_settings',
        'Hostel Management System',
        '',
        '',
        '',
        '',
        '₹',
        'YYYY-MM-DD',
        5000,
        'RCP-',
        'INV-',
        0,
        'Hostel Manager'
      ]
    );
  }
}

export function createDatabaseBackup(notes: string = 'Manual backup'): { id: string; filename: string; size: number; createdAt: string } {
  if (!dbInstance) throw new Error('Database not initialized');
  persistDb();
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `backup_hostel_${timestamp}.sqlite`;
  const backupPath = path.resolve(BACKUPS_DIR, filename);
  
  const data = dbInstance.export();
  fs.writeFileSync(backupPath, Buffer.from(data));
  const stats = fs.statSync(backupPath);
  
  const id = 'bck_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const createdAt = new Date().toISOString();
  
  runQuery(
    `INSERT INTO backups (id, filename, file_size, created_at, notes) VALUES (?, ?, ?, ?, ?)`,
    [id, filename, stats.size, createdAt, notes]
  );
  
  return { id, filename, size: stats.size, createdAt };
}

export async function restoreDatabaseBackup(backupFilename: string): Promise<boolean> {
  const backupPath = path.resolve(BACKUPS_DIR, backupFilename);
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file does not exist');
  }

  // 1. Create an automatic safety backup first
  createDatabaseBackup('Automatic pre-restore safety snapshot');

  // 2. Read the backup and instantiate
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(backupPath);
  const newDb = new SQL.Database(fileBuffer);

  // Validate the restored database has essential tables
  const testUsers = newDb.exec("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users'");
  if (!testUsers || testUsers.length === 0 || Number(testUsers[0].values[0][0]) === 0) {
    throw new Error('Restored file is not a valid Hostel database backup');
  }

  // Replace active instance and file
  if (dbInstance) {
    dbInstance.close();
  }
  dbInstance = newDb;
  persistDb();
  return true;
}
