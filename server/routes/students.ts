import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest, logAudit } from '../auth.js';
import { queryOne, queryAll, runQuery } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/students: List students with search, filters, pagination
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, status, page = '1', limit = '15', sort = 'created_at', order = 'DESC' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 15));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (status && status !== 'all') {
      whereClauses.push('status = ?');
      params.push(status);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      whereClauses.push('(full_name LIKE ? OR admission_number LIKE ? OR mobile LIKE ? OR college LIKE ? OR email LIKE ?)');
      params.push(q, q, q, q, q);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM students ${whereSql}`, params);
    const total = countRow?.count || 0;

    const allowedSorts = ['full_name', 'admission_number', 'admission_date', 'status', 'created_at'];
    const safeSort = allowedSorts.includes(sort as string) ? (sort as string) : 'created_at';
    const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

    const students = queryAll(
      `SELECT * FROM students ${whereSql} ORDER BY ${safeSort} ${safeOrder} LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    // Attach active allocation details if any
    const enriched = students.map(s => {
      const activeAlloc = queryOne<{
        room_number: string;
        bed_number: string;
        allocation_date: string;
        monthly_rent: number;
      }>(
        `SELECT r.room_number, b.bed_number, a.allocation_date, a.monthly_rent
         FROM room_allocations a
         JOIN rooms r ON a.room_id = r.id
         JOIN beds b ON a.bed_id = b.id
         WHERE a.student_id = ? AND a.status = 'active'`,
        [s.id]
      );
      return {
        ...s,
        currentAllocation: activeAlloc || null,
      };
    });

    res.json({
      students: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch students: ' + err.message });
  }
});

// GET /api/students/:id: Detailed student profile with complete history
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = queryOne('SELECT * FROM students WHERE id = ?', [req.params.id]);
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    // Historical allocations
    const allocations = queryAll(
      `SELECT a.*, r.room_number, b.bed_number
       FROM room_allocations a
       JOIN rooms r ON a.room_id = r.id
       JOIN beds b ON a.bed_id = b.id
       WHERE a.student_id = ?
       ORDER BY a.allocation_date DESC`,
      [student.id]
    );

    // Rent records
    const rentRecords = queryAll(
      `SELECT * FROM rent_records WHERE student_id = ? ORDER BY billing_month DESC`,
      [student.id]
    );

    // Payments
    const payments = queryAll(
      `SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC`,
      [student.id]
    );

    // Financial balance calculation
    const totalBilled = rentRecords.reduce((sum, r) => sum + (r.total_amount || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const outstanding = Math.max(0, totalBilled - totalPaid);

    res.json({
      student,
      allocations,
      rentRecords,
      payments,
      financialSummary: {
        totalBilled,
        totalPaid,
        outstanding,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch student details: ' + err.message });
  }
});

// POST /api/students: Create new student
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      admission_number,
      full_name,
      father_name,
      mother_name,
      mobile,
      alternate_mobile,
      email,
      dob,
      gender,
      address,
      city,
      state,
      pincode,
      college,
      course,
      year_semester,
      admission_date,
      guardian_name,
      guardian_mobile,
      id_proof_type,
      id_proof_number,
      photo_url,
      notes,
    } = req.body;

    if (!full_name || !full_name.trim()) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }

    if (!admission_number || !admission_number.trim()) {
      res.status(400).json({ error: 'Admission number is required.' });
      return;
    }

    if (!mobile || !mobile.trim()) {
      res.status(400).json({ error: 'Primary mobile number is required.' });
      return;
    }

    // Check duplicate admission number
    const existing = queryOne('SELECT id FROM students WHERE admission_number = ?', [admission_number.trim()]);
    if (existing) {
      res.status(400).json({ error: `Admission number "${admission_number}" is already registered.` });
      return;
    }

    const id = 'stu_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();
    const admDate = admission_date || now.split('T')[0];

    runQuery(
      `INSERT INTO students (
        id, admission_number, full_name, father_name, mother_name, mobile,
        alternate_mobile, email, dob, gender, address, city, state, pincode,
        college, course, year_semester, admission_date, guardian_name,
        guardian_mobile, id_proof_type, id_proof_number, photo_url, status,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [
        id,
        admission_number.trim(),
        full_name.trim(),
        father_name?.trim() || null,
        mother_name?.trim() || null,
        mobile.trim(),
        alternate_mobile?.trim() || null,
        email?.trim() || null,
        dob || null,
        gender || 'Male',
        address?.trim() || null,
        city?.trim() || null,
        state?.trim() || null,
        pincode?.trim() || null,
        college?.trim() || null,
        course?.trim() || null,
        year_semester?.trim() || null,
        admDate,
        guardian_name?.trim() || null,
        guardian_mobile?.trim() || null,
        id_proof_type || 'Aadhaar / National ID',
        id_proof_number?.trim() || null,
        photo_url || null,
        notes?.trim() || null,
        now,
        now,
      ]
    );

    logAudit('STUDENT_CREATED', `Student created: ${full_name} (${admission_number})`, req.user!.id, req.user!.username, req.ip);

    res.status(201).json({
      success: true,
      message: 'Student registered successfully.',
      studentId: id,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create student: ' + err.message });
  }
});

// PUT /api/students/:id: Update student
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.params.id;
    const existing = queryOne('SELECT id, admission_number FROM students WHERE id = ?', [studentId]);
    if (!existing) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const {
      admission_number,
      full_name,
      father_name,
      mother_name,
      mobile,
      alternate_mobile,
      email,
      dob,
      gender,
      address,
      city,
      state,
      pincode,
      college,
      course,
      year_semester,
      admission_date,
      guardian_name,
      guardian_mobile,
      id_proof_type,
      id_proof_number,
      photo_url,
      status,
      notes,
    } = req.body;

    if (!full_name || !full_name.trim()) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }

    if (admission_number && admission_number.trim() !== existing.admission_number) {
      const duplicate = queryOne('SELECT id FROM students WHERE admission_number = ? AND id != ?', [
        admission_number.trim(),
        studentId,
      ]);
      if (duplicate) {
        res.status(400).json({ error: `Admission number "${admission_number}" is already used by another student.` });
        return;
      }
    }

    const now = new Date().toISOString();

    runQuery(
      `UPDATE students SET
        admission_number = ?, full_name = ?, father_name = ?, mother_name = ?, mobile = ?,
        alternate_mobile = ?, email = ?, dob = ?, gender = ?, address = ?, city = ?, state = ?,
        pincode = ?, college = ?, course = ?, year_semester = ?, admission_date = ?,
        guardian_name = ?, guardian_mobile = ?, id_proof_type = ?, id_proof_number = ?,
        photo_url = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?`,
      [
        (admission_number || existing.admission_number).trim(),
        full_name.trim(),
        father_name?.trim() || null,
        mother_name?.trim() || null,
        mobile.trim(),
        alternate_mobile?.trim() || null,
        email?.trim() || null,
        dob || null,
        gender || 'Male',
        address?.trim() || null,
        city?.trim() || null,
        state?.trim() || null,
        pincode?.trim() || null,
        college?.trim() || null,
        course?.trim() || null,
        year_semester?.trim() || null,
        admission_date || null,
        guardian_name?.trim() || null,
        guardian_mobile?.trim() || null,
        id_proof_type || null,
        id_proof_number?.trim() || null,
        photo_url || null,
        status || 'active',
        notes?.trim() || null,
        now,
        studentId,
      ]
    );

    logAudit('STUDENT_UPDATED', `Updated profile of student: ${full_name}`, req.user!.id, req.user!.username, req.ip);

    res.json({ success: true, message: 'Student information updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update student: ' + err.message });
  }
});

// POST /api/students/:id/status: Toggle active/inactive status
router.post('/:id/status', (req: AuthenticatedRequest, res: Response) => {
  try {
    const student = queryOne<{ id: string; full_name: string; status: string }>(
      'SELECT id, full_name, status FROM students WHERE id = ?',
      [req.params.id]
    );
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const { status } = req.body;
    if (!['active', 'inactive', 'vacated', 'suspended'].includes(status)) {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }

    // If deactivating, check if student has an active bed allocation
    if (status !== 'active') {
      const activeAlloc = queryOne('SELECT id FROM room_allocations WHERE student_id = ? AND status = "active"', [student.id]);
      if (activeAlloc) {
        res.status(400).json({
          error: 'Student currently occupies a bed. Please vacate the bed in Room Management before deactivating the student.',
        });
        return;
      }
    }

    const now = new Date().toISOString();
    runQuery('UPDATE students SET status = ?, updated_at = ? WHERE id = ?', [status, now, student.id]);

    logAudit('STUDENT_STATUS_CHANGED', `Student ${student.full_name} status changed to ${status}`, req.user!.id, req.user!.username, req.ip);
    res.json({ success: true, message: `Student status updated to ${status}.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update student status: ' + err.message });
  }
});

// DELETE /api/students/:id: Delete student and cascade associated allocations/financial records
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const studentId = req.params.id;
    const student = queryOne<{ full_name: string; admission_number: string }>(
      'SELECT full_name, admission_number FROM students WHERE id = ?',
      [studentId]
    );
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    // 1. Free any occupied beds allocated to this student
    const studentAllocations = queryAll<{ bed_id: string }>(
      'SELECT bed_id FROM room_allocations WHERE student_id = ?',
      [studentId]
    );
    for (const alloc of studentAllocations) {
      if (alloc.bed_id) {
        runQuery('UPDATE beds SET status = "available" WHERE id = ?', [alloc.bed_id]);
      }
    }

    // 2. Cascade delete receipts, payments, rent records, and allocations
    runQuery('DELETE FROM receipts WHERE student_id = ?', [studentId]);
    runQuery(
      'DELETE FROM receipts WHERE payment_id IN (SELECT id FROM payments WHERE student_id = ?)',
      [studentId]
    );
    runQuery('DELETE FROM payments WHERE student_id = ?', [studentId]);
    runQuery('DELETE FROM rent_records WHERE student_id = ?', [studentId]);
    runQuery('DELETE FROM room_allocations WHERE student_id = ?', [studentId]);

    // 3. Delete the student record
    runQuery('DELETE FROM students WHERE id = ?', [studentId]);

    logAudit(
      'STUDENT_DELETED',
      `Student permanently deleted: ${student.full_name} (${student.admission_number})`,
      req.user!.id,
      req.user!.username,
      req.ip
    );

    res.json({
      success: true,
      message: `छात्र "${student.full_name}" (${student.admission_number}) और संबंधित रिकॉर्ड्स सफलतापूर्वक हटा दिए गए हैं।`,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete student: ' + err.message });
  }
});

export default router;
