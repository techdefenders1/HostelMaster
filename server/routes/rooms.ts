import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest, logAudit } from '../auth.js';
import { queryOne, queryAll, runQuery } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/rooms: List all rooms with live occupancy stats
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { floor, type, status, search } = req.query;

    let where: string[] = [];
    let params: any[] = [];

    if (floor) {
      where.push('floor = ?');
      params.push(floor);
    }
    if (type) {
      where.push('room_type = ?');
      params.push(type);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (search && typeof search === 'string' && search.trim()) {
      where.push('(room_number LIKE ? OR description LIKE ?)');
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rooms = queryAll(`SELECT * FROM rooms ${whereSql} ORDER BY room_number ASC`, params);

    // Compute bed counts and occupancy for each room
    const enriched = rooms.map(room => {
      const beds = queryAll(
        `SELECT b.*,
          a.id as allocation_id, a.student_id, a.allocation_date,
          s.full_name as student_name, s.admission_number, s.mobile as student_mobile
         FROM beds b
         LEFT JOIN room_allocations a ON a.bed_id = b.id AND a.status = 'active'
         LEFT JOIN students s ON a.student_id = s.id
         WHERE b.room_id = ?
         ORDER BY b.bed_number ASC`,
        [room.id]
      );

      const totalBeds = beds.length;
      const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
      const availableBeds = beds.filter(b => b.status === 'available').length;
      const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      return {
        ...room,
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyRate,
        beds,
      };
    });

    res.json({ rooms: enriched });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch rooms: ' + err.message });
  }
});

// GET /api/rooms/:id
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const room = queryOne('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    const beds = queryAll(
      `SELECT b.*,
        a.id as allocation_id, a.student_id, a.allocation_date, a.monthly_rent as allocated_rent,
        s.full_name as student_name, s.admission_number, s.mobile as student_mobile
       FROM beds b
       LEFT JOIN room_allocations a ON a.bed_id = b.id AND a.status = 'active'
       LEFT JOIN students s ON a.student_id = s.id
       WHERE b.room_id = ?
       ORDER BY b.bed_number ASC`,
      [room.id]
    );

    res.json({
      room: {
        ...room,
        beds,
        occupiedBeds: beds.filter(b => b.status === 'occupied').length,
        availableBeds: beds.filter(b => b.status === 'available').length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch room details: ' + err.message });
  }
});

// POST /api/rooms: Create new room and optionally auto-generate beds
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { room_number, floor, room_type, capacity, monthly_rent, description, auto_create_beds } = req.body;

    if (!room_number || !room_number.trim()) {
      res.status(400).json({ error: 'Room number is required.' });
      return;
    }
    if (!floor || !floor.trim()) {
      res.status(400).json({ error: 'Floor is required.' });
      return;
    }
    if (!room_type) {
      res.status(400).json({ error: 'Room type is required.' });
      return;
    }

    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap < 1) {
      res.status(400).json({ error: 'Room capacity must be at least 1.' });
      return;
    }

    const rent = parseFloat(monthly_rent);
    if (isNaN(rent) || rent < 0) {
      res.status(400).json({ error: 'Monthly rent must be a non-negative number.' });
      return;
    }

    // Check duplicate room number
    const existing = queryOne('SELECT id FROM rooms WHERE room_number = ?', [room_number.trim()]);
    if (existing) {
      res.status(400).json({ error: `Room number "${room_number}" already exists.` });
      return;
    }

    const roomId = 'rm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    runQuery(
      `INSERT INTO rooms (id, room_number, floor, room_type, capacity, monthly_rent, description, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?)`,
      [roomId, room_number.trim(), floor.trim(), room_type, cap, rent, description?.trim() || null, now, now]
    );

    // Auto-create beds if requested
    if (auto_create_beds !== false) {
      for (let i = 1; i <= cap; i++) {
        const bedId = 'bed_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substring(2, 5);
        const bedNumber = `Bed ${i}`;
        runQuery(
          `INSERT INTO beds (id, room_id, bed_number, status, created_at, updated_at) VALUES (?, ?, ?, 'available', ?, ?)`,
          [bedId, roomId, bedNumber, now, now]
        );
      }
    }

    logAudit('ROOM_CREATED', `Room ${room_number} created with capacity ${cap}`, req.user!.id, req.user!.username, req.ip);

    res.status(201).json({ success: true, message: 'Room created successfully.', roomId });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create room: ' + err.message });
  }
});

// PUT /api/rooms/:id: Update room
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const roomId = req.params.id;
    const existing = queryOne<{ id: string; room_number: string; capacity: number }>(
      'SELECT id, room_number, capacity FROM rooms WHERE id = ?',
      [roomId]
    );

    if (!existing) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    const { room_number, floor, room_type, capacity, monthly_rent, description, status } = req.body;

    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap < 1) {
      res.status(400).json({ error: 'Room capacity must be at least 1.' });
      return;
    }

    // Check if new capacity is smaller than occupied beds
    const occupiedCount = queryOne<{ count: number }>(
      'SELECT count(*) as count FROM beds WHERE room_id = ? AND status = "occupied"',
      [roomId]
    )?.count || 0;

    if (cap < occupiedCount) {
      res.status(400).json({
        error: `Cannot reduce room capacity to ${cap} because there are currently ${occupiedCount} occupied beds.`,
      });
      return;
    }

    // Check duplicate room number
    if (room_number && room_number.trim() !== existing.room_number) {
      const duplicate = queryOne('SELECT id FROM rooms WHERE room_number = ? AND id != ?', [
        room_number.trim(),
        roomId,
      ]);
      if (duplicate) {
        res.status(400).json({ error: `Room number "${room_number}" is already used.` });
        return;
      }
    }

    const rent = parseFloat(monthly_rent);
    if (isNaN(rent) || rent < 0) {
      res.status(400).json({ error: 'Monthly rent must be a non-negative number.' });
      return;
    }

    const now = new Date().toISOString();
    runQuery(
      `UPDATE rooms SET
        room_number = ?, floor = ?, room_type = ?, capacity = ?, monthly_rent = ?,
        description = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      [
        room_number.trim(),
        floor.trim(),
        room_type,
        cap,
        rent,
        description?.trim() || null,
        status || 'available',
        now,
        roomId,
      ]
    );

    logAudit('ROOM_UPDATED', `Room ${room_number} updated`, req.user!.id, req.user!.username, req.ip);
    res.json({ success: true, message: 'Room updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update room: ' + err.message });
  }
});

// DELETE /api/rooms/:id: Delete room, cascade allocations and beds
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const roomId = req.params.id;
    const room = queryOne<{ id: string; room_number: string }>('SELECT id, room_number FROM rooms WHERE id = ?', [roomId]);
    if (!room) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }

    // 1. Delete receipts and payments attached to rent records for this room
    runQuery(
      'DELETE FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE rent_id IN (SELECT id FROM rent_records WHERE room_id = ?))',
      [roomId]
    );
    runQuery(
      'DELETE FROM payments WHERE rent_id IN (SELECT id FROM rent_records WHERE room_id = ?)',
      [roomId]
    );

    // 2. Delete rent records for this room
    runQuery('DELETE FROM rent_records WHERE room_id = ?', [roomId]);

    // 3. Delete all room allocation records for this room
    runQuery('DELETE FROM room_allocations WHERE room_id = ?', [roomId]);

    // 4. Delete all beds in this room
    runQuery('DELETE FROM beds WHERE room_id = ?', [roomId]);

    // 5. Delete the room
    runQuery('DELETE FROM rooms WHERE id = ?', [roomId]);

    logAudit('ROOM_DELETED', `Deleted room ${room.room_number} and all its beds`, req.user!.id, req.user!.username, req.ip);
    res.json({ success: true, message: `कमरा ${room.room_number} और संबंधित बेड्स सफलतापूर्वक हटा दिए गए हैं।` });
  } catch (err: any) {
    console.error('Failed to delete room:', err);
    res.status(500).json({ error: 'Failed to delete room: ' + err.message });
  }
});

export default router;
