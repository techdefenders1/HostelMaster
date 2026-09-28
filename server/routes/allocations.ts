import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest, logAudit } from '../auth.js';
import { queryOne, queryAll, runQuery } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/allocations: List room allocations with search and filters
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status = 'all', search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let where: string[] = [];
    let params: any[] = [];

    if (status && status !== 'all') {
      where.push('a.status = ?');
      params.push(status);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      where.push('(s.full_name LIKE ? OR s.admission_number LIKE ? OR r.room_number LIKE ?)');
      params.push(q, q, q);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = queryOne<{ count: number }>(
      `SELECT count(*) as count
       FROM room_allocations a
       JOIN students s ON a.student_id = s.id
       JOIN rooms r ON a.room_id = r.id
       JOIN beds b ON a.bed_id = b.id
       ${whereSql}`,
      params
    );
    const total = countRow?.count || 0;

    const allocations = queryAll(
      `SELECT a.*,
        s.full_name as student_name, s.admission_number, s.mobile as student_mobile, s.email as student_email,
        r.room_number, r.floor, r.room_type,
        b.bed_number
       FROM room_allocations a
       JOIN students s ON a.student_id = s.id
       JOIN rooms r ON a.room_id = r.id
       JOIN beds b ON a.bed_id = b.id
       ${whereSql}
       ORDER BY a.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      allocations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch allocations: ' + err.message });
  }
});

// POST /api/allocations/allocate: Allocate a bed to a student
router.post('/allocate', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { student_id, room_id, bed_id, allocation_date, expected_checkout_date, monthly_rent, deposit_amount, notes } = req.body;

    if (!student_id || !room_id || !bed_id) {
      res.status(400).json({ error: 'Student, room, and bed are required.' });
      return;
    }

    // 1. Validate student
    const student = queryOne<{ id: string; full_name: string; admission_number: string; status: string }>(
      'SELECT id, full_name, admission_number, status FROM students WHERE id = ?',
      [student_id]
    );
    if (!student) {
      res.status(404).json({ error: 'Selected student does not exist.' });
      return;
    }
    if (student.status !== 'active') {
      res.status(400).json({ error: `Cannot allocate bed: Student "${student.full_name}" is currently marked as ${student.status}.` });
      return;
    }

    // 2. Validate student has no active allocation
    const existingActive = queryOne<{ id: string; room_id: string }>(
      'SELECT id, room_id FROM room_allocations WHERE student_id = ? AND status = "active"',
      [student_id]
    );
    if (existingActive) {
      res.status(400).json({
        error: `Student "${student.full_name}" already has an active room allocation. Please vacate or transfer the student instead.`,
      });
      return;
    }

    // 3. Validate room and bed
    const room = queryOne<{ id: string; room_number: string; monthly_rent: number }>(
      'SELECT id, room_number, monthly_rent FROM rooms WHERE id = ?',
      [room_id]
    );
    if (!room) {
      res.status(404).json({ error: 'Selected room does not exist.' });
      return;
    }

    const bed = queryOne<{ id: string; bed_number: string; status: string; room_id: string }>(
      'SELECT id, bed_number, status, room_id FROM beds WHERE id = ?',
      [bed_id]
    );
    if (!bed) {
      res.status(404).json({ error: 'Selected bed does not exist.' });
      return;
    }
    if (bed.room_id !== room_id) {
      res.status(400).json({ error: 'Selected bed does not belong to the selected room.' });
      return;
    }
    if (bed.status !== 'available') {
      res.status(400).json({ error: `Selected bed "${bed.bed_number}" is currently ${bed.status} and cannot be allocated.` });
      return;
    }

    const allocId = 'alc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    const allocDate = allocation_date || now.split('T')[0];
    const rentAmount = parseFloat(monthly_rent !== undefined && monthly_rent !== '' ? monthly_rent : room.monthly_rent);
    const deposit = parseFloat(deposit_amount) || 0;

    // Insert allocation
    runQuery(
      `INSERT INTO room_allocations (
        id, student_id, room_id, bed_id, allocation_date, expected_checkout_date,
        monthly_rent, deposit_amount, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [allocId, student_id, room_id, bed_id, allocDate, expected_checkout_date || null, rentAmount, deposit, notes?.trim() || null, now, now]
    );

    // Update bed status to occupied
    runQuery('UPDATE beds SET status = "occupied", updated_at = ? WHERE id = ?', [now, bed_id]);

    logAudit(
      'ROOM_ALLOCATION',
      `Allocated Student ${student.full_name} to Room ${room.room_number}, Bed ${bed.bed_number}`,
      req.user!.id,
      req.user!.username,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Bed ${bed.bed_number} in Room ${room.room_number} successfully allocated to ${student.full_name}.`,
      allocationId: allocId,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to allocate bed: ' + err.message });
  }
});

// POST /api/allocations/:id/vacate: Vacate a bed allocation
router.post('/:id/vacate', (req: AuthenticatedRequest, res: Response) => {
  try {
    const allocId = req.params.id;
    const { vacate_date, notes } = req.body;

    const allocation = queryOne<{
      id: string;
      student_id: string;
      room_id: string;
      bed_id: string;
      status: string;
    }>('SELECT * FROM room_allocations WHERE id = ?', [allocId]);

    if (!allocation) {
      res.status(404).json({ error: 'Allocation not found.' });
      return;
    }
    if (allocation.status !== 'active') {
      res.status(400).json({ error: `Allocation is already marked as ${allocation.status}.` });
      return;
    }

    const now = new Date().toISOString();
    const effectiveVacateDate = vacate_date || now.split('T')[0];

    // Update allocation
    runQuery(
      'UPDATE room_allocations SET status = "vacated", vacate_date = ?, notes = coalesce(notes || "\n", "") || ?, updated_at = ? WHERE id = ?',
      [effectiveVacateDate, notes ? `[Vacated: ${notes}]` : '[Vacated]', now, allocId]
    );

    // Release bed
    runQuery('UPDATE beds SET status = "available", updated_at = ? WHERE id = ?', [now, allocation.bed_id]);

    const student = queryOne<{ full_name: string }>('SELECT full_name FROM students WHERE id = ?', [allocation.student_id]);
    const room = queryOne<{ room_number: string }>('SELECT room_number FROM rooms WHERE id = ?', [allocation.room_id]);

    logAudit(
      'BED_VACATED',
      `Vacated Student ${student?.full_name || allocation.student_id} from Room ${room?.room_number || allocation.room_id}`,
      req.user!.id,
      req.user!.username,
      req.ip
    );

    res.json({ success: true, message: 'Bed has been vacated and marked as available.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to vacate bed: ' + err.message });
  }
});

// POST /api/allocations/:id/transfer: Transfer student to another bed
router.post('/:id/transfer', (req: AuthenticatedRequest, res: Response) => {
  try {
    const allocId = req.params.id;
    const { new_room_id, new_bed_id, transfer_date, new_monthly_rent, notes } = req.body;

    if (!new_room_id || !new_bed_id) {
      res.status(400).json({ error: 'New room and bed are required for transfer.' });
      return;
    }

    const currentAlloc = queryOne<{
      id: string;
      student_id: string;
      room_id: string;
      bed_id: string;
      status: string;
      deposit_amount: number;
    }>('SELECT * FROM room_allocations WHERE id = ?', [allocId]);

    if (!currentAlloc || currentAlloc.status !== 'active') {
      res.status(400).json({ error: 'Only an active allocation can be transferred.' });
      return;
    }

    if (currentAlloc.bed_id === new_bed_id) {
      res.status(400).json({ error: 'New bed cannot be the same as the current bed.' });
      return;
    }

    // Validate new target
    const targetRoom = queryOne<{ id: string; room_number: string; monthly_rent: number }>(
      'SELECT id, room_number, monthly_rent FROM rooms WHERE id = ?',
      [new_room_id]
    );
    if (!targetRoom) {
      res.status(404).json({ error: 'Target room does not exist.' });
      return;
    }

    const targetBed = queryOne<{ id: string; bed_number: string; status: string; room_id: string }>(
      'SELECT id, bed_number, status, room_id FROM beds WHERE id = ?',
      [new_bed_id]
    );
    if (!targetBed) {
      res.status(404).json({ error: 'Target bed does not exist.' });
      return;
    }
    if (targetBed.room_id !== new_room_id) {
      res.status(400).json({ error: 'Target bed does not belong to the target room.' });
      return;
    }
    if (targetBed.status !== 'available') {
      res.status(400).json({ error: `Target bed "${targetBed.bed_number}" is not available.` });
      return;
    }

    const now = new Date().toISOString();
    const transDate = transfer_date || now.split('T')[0];
    const newRent = parseFloat(new_monthly_rent !== undefined && new_monthly_rent !== '' ? new_monthly_rent : targetRoom.monthly_rent);

    // 1. Close old allocation
    runQuery(
      'UPDATE room_allocations SET status = "transferred", vacate_date = ?, notes = coalesce(notes || "\n", "") || ?, updated_at = ? WHERE id = ?',
      [transDate, `[Transferred to Room ${targetRoom.room_number}, Bed ${targetBed.bed_number}]`, now, allocId]
    );

    // 2. Free old bed
    runQuery('UPDATE beds SET status = "available", updated_at = ? WHERE id = ?', [now, currentAlloc.bed_id]);

    // 3. Create new allocation
    const newAllocId = 'alc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    runQuery(
      `INSERT INTO room_allocations (
        id, student_id, room_id, bed_id, allocation_date, monthly_rent,
        deposit_amount, status, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [
        newAllocId,
        currentAlloc.student_id,
        new_room_id,
        new_bed_id,
        transDate,
        newRent,
        currentAlloc.deposit_amount,
        notes ? `[Transferred from previous bed. ${notes}]` : '[Transferred from previous bed]',
        now,
        now,
      ]
    );

    // 4. Occupy new bed
    runQuery('UPDATE beds SET status = "occupied", updated_at = ? WHERE id = ?', [now, new_bed_id]);

    const student = queryOne<{ full_name: string }>('SELECT full_name FROM students WHERE id = ?', [currentAlloc.student_id]);
    logAudit(
      'ROOM_TRANSFER',
      `Transferred student ${student?.full_name} to Room ${targetRoom.room_number}, Bed ${targetBed.bed_number}`,
      req.user!.id,
      req.user!.username,
      req.ip
    );

    res.json({
      success: true,
      message: `Student successfully transferred to Room ${targetRoom.room_number}, Bed ${targetBed.bed_number}.`,
      newAllocationId: newAllocId,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to transfer bed: ' + err.message });
  }
});

export default router;
