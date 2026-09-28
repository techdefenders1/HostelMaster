import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest, logAudit } from '../auth.js';
import { queryOne, queryAll, runQuery } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/beds: List beds, optionally filtered by room or status
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { room_id, status } = req.query;

    let where: string[] = [];
    let params: any[] = [];

    if (room_id) {
      where.push('b.room_id = ?');
      params.push(room_id);
    }
    if (status) {
      where.push('b.status = ?');
      params.push(status);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const beds = queryAll(
      `SELECT b.*, r.room_number, r.floor, r.room_type, r.monthly_rent,
        a.id as allocation_id, a.student_id, a.allocation_date,
        s.full_name as student_name, s.admission_number, s.mobile as student_mobile
       FROM beds b
       JOIN rooms r ON b.room_id = r.id
       LEFT JOIN room_allocations a ON a.bed_id = b.id AND a.status = 'active'
       LEFT JOIN students s ON a.student_id = s.id
       ${whereSql}
       ORDER BY r.room_number ASC, b.bed_number ASC`,
      params
    );

    res.json({ beds });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch beds: ' + err.message });
  }
});

// POST /api/beds: Add a new bed to a room
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { room_id, bed_number, notes } = req.body;

    if (!room_id || !bed_number || !bed_number.trim()) {
      res.status(400).json({ error: 'Room and bed number are required.' });
      return;
    }

    const room = queryOne<{ id: string; room_number: string; capacity: number }>(
      'SELECT id, room_number, capacity FROM rooms WHERE id = ?',
      [room_id]
    );

    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    // Check capacity limit
    const currentBeds = queryOne<{ count: number }>('SELECT count(*) as count FROM beds WHERE room_id = ?', [room_id])?.count || 0;
    if (currentBeds >= room.capacity) {
      res.status(400).json({
        error: `Cannot add more beds. Room ${room.room_number} capacity limit (${room.capacity}) has already been reached.`,
      });
      return;
    }

    // Check duplicate bed number in room
    const existing = queryOne('SELECT id FROM beds WHERE room_id = ? AND bed_number = ?', [room_id, bed_number.trim()]);
    if (existing) {
      res.status(400).json({ error: `Bed "${bed_number}" already exists in room ${room.room_number}.` });
      return;
    }

    const bedId = 'bed_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    runQuery(
      `INSERT INTO beds (id, room_id, bed_number, status, notes, created_at, updated_at) VALUES (?, ?, ?, 'available', ?, ?, ?)`,
      [bedId, room_id, bed_number.trim(), notes?.trim() || null, now, now]
    );

    logAudit('BED_ADDED', `Bed ${bed_number} added to Room ${room.room_number}`, req.user!.id, req.user!.username, req.ip);

    res.status(201).json({ success: true, message: 'Bed added successfully.', bedId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add bed: ' + err.message });
  }
});

// PUT /api/beds/:id: Edit bed
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const bedId = req.params.id;
    const existing = queryOne<{ id: string; room_id: string; bed_number: string; status: string }>(
      'SELECT id, room_id, bed_number, status FROM beds WHERE id = ?',
      [bedId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Bed not found.' });
      return;
    }

    const { bed_number, status, notes } = req.body;

    if (!bed_number || !bed_number.trim()) {
      res.status(400).json({ error: 'Bed number is required.' });
      return;
    }

    // If bed is currently occupied, prevent status change to available/maintenance directly
    if (existing.status === 'occupied' && status && status !== 'occupied') {
      res.status(400).json({ error: 'Bed is currently allocated to an active student. Please vacate the bed first.' });
      return;
    }

    // Check duplicate
    if (bed_number.trim() !== existing.bed_number) {
      const duplicate = queryOne('SELECT id FROM beds WHERE room_id = ? AND bed_number = ? AND id != ?', [
        existing.room_id,
        bed_number.trim(),
        bedId,
      ]);
      if (duplicate) {
        res.status(400).json({ error: `Bed "${bed_number}" already exists in this room.` });
        return;
      }
    }

    const now = new Date().toISOString();
    runQuery(
      `UPDATE beds SET bed_number = ?, status = ?, notes = ?, updated_at = ? WHERE id = ?`,
      [bed_number.trim(), status || existing.status, notes?.trim() || null, now, bedId]
    );

    logAudit('BED_UPDATED', `Bed ${bed_number} updated`, req.user!.id, req.user!.username, req.ip);
    res.json({ success: true, message: 'Bed updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update bed: ' + err.message });
  }
});

// DELETE /api/beds/:id: Delete bed
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const bedId = req.params.id;
    const bed = queryOne<{ id: string; bed_number: string; status: string; room_id: string }>(
      'SELECT id, bed_number, status, room_id FROM beds WHERE id = ?',
      [bedId]
    );

    if (!bed) {
      res.status(404).json({ error: 'Bed not found.' });
      return;
    }

    // Clean up room allocations associated with this bed
    runQuery('DELETE FROM room_allocations WHERE bed_id = ?', [bedId]);

    runQuery('DELETE FROM beds WHERE id = ?', [bedId]);
    logAudit('BED_DELETED', `Deleted Bed ${bed.bed_number}`, req.user!.id, req.user!.username, req.ip);
    res.json({ success: true, message: `Bed ${bed.bed_number} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete bed: ' + err.message });
  }
});

export default router;
