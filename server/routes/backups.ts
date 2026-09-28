import express, { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth, AuthenticatedRequest, logAudit } from '../auth.js';
import { queryAll, queryOne, runQuery, createDatabaseBackup, restoreDatabaseBackup } from '../db.js';

const router = express.Router();
router.use(requireAuth);

const BACKUPS_DIR = path.resolve(process.cwd(), 'data', 'backups');

// GET /api/backups: List backups
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const backups = queryAll('SELECT * FROM backups ORDER BY created_at DESC');
    res.json({ backups });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch backups: ' + err.message });
  }
});

// POST /api/backups: Create new backup
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { notes } = req.body;
    const backup = createDatabaseBackup(notes || 'Manual user-initiated backup');

    logAudit('BACKUP_CREATED', `Database backup created: ${backup.filename} (${(backup.size / 1024).toFixed(1)} KB)`, req.user!.id, req.user!.username, req.ip);

    res.status(201).json({
      success: true,
      message: 'Database backup created successfully.',
      backup,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create backup: ' + err.message });
  }
});

// POST /api/backups/restore: Restore a backup
router.post('/restore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { filename } = req.body;

    if (!filename || typeof filename !== 'string') {
      res.status(400).json({ error: 'Backup filename is required.' });
      return;
    }

    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const backupPath = path.resolve(BACKUPS_DIR, safeFilename);

    if (!fs.existsSync(backupPath)) {
      res.status(404).json({ error: 'Backup file does not exist.' });
      return;
    }

    await restoreDatabaseBackup(safeFilename);

    logAudit('BACKUP_RESTORED', `Restored database from ${safeFilename}`, req.user!.id, req.user!.username, req.ip);

    res.json({
      success: true,
      message: `Database successfully restored from ${safeFilename}. An automatic safety snapshot of previous data was created before restoration.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to restore database: ' + err.message });
  }
});

// DELETE /api/backups/:id: Delete backup file & record
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const backupId = req.params.id;
    const backup = queryOne<{ filename: string }>('SELECT filename FROM backups WHERE id = ?', [backupId]);

    if (!backup) {
      res.status(404).json({ error: 'Backup record not found.' });
      return;
    }

    const safeFilename = path.basename(backup.filename);
    const backupPath = path.resolve(BACKUPS_DIR, safeFilename);

    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    runQuery('DELETE FROM backups WHERE id = ?', [backupId]);
    logAudit('BACKUP_DELETED', `Deleted backup file: ${safeFilename}`, req.user!.id, req.user!.username, req.ip);

    res.json({ success: true, message: 'Backup file deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete backup: ' + err.message });
  }
});

export default router;
