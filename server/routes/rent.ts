import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest, logAudit } from '../auth.js';
import { queryOne, queryAll, runQuery } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/rent: List rent bills with filters
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, month, student_id, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let where: string[] = [];
    let params: any[] = [];

    if (status && status !== 'all') {
      where.push('rn.status = ?');
      params.push(status);
    }
    if (month) {
      where.push('rn.billing_month = ?');
      params.push(month);
    }
    if (student_id) {
      where.push('rn.student_id = ?');
      params.push(student_id);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      where.push('(s.full_name LIKE ? OR s.admission_number LIKE ? OR r.room_number LIKE ? OR rn.billing_period LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = queryOne<{ count: number }>(
      `SELECT count(*) as count
       FROM rent_records rn
       LEFT JOIN students s ON rn.student_id = s.id
       LEFT JOIN rooms r ON rn.room_id = r.id
       LEFT JOIN beds b ON rn.bed_id = b.id
       ${whereSql}`,
      params
    );
    const total = countRow?.count || 0;

    const records = queryAll(
      `SELECT rn.*,
        coalesce(s.full_name, 'Unknown Student') as student_name,
        coalesce(s.admission_number, '—') as admission_number,
        coalesce(s.mobile, '—') as student_mobile,
        coalesce(r.room_number, 'N/A') as room_number,
        coalesce(r.floor, '—') as floor,
        coalesce(b.bed_number, 'N/A') as bed_number
       FROM rent_records rn
       LEFT JOIN students s ON rn.student_id = s.id
       LEFT JOIN rooms r ON rn.room_id = r.id
       LEFT JOIN beds b ON rn.bed_id = b.id
       ${whereSql}
       ORDER BY rn.billing_month DESC, rn.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    // Compute summary totals for current filter
    const summary = queryOne<{ total_billed: number; total_paid: number; total_pending: number }>(
      `SELECT
        coalesce(sum(rn.total_amount), 0) as total_billed,
        coalesce(sum(rn.paid_amount), 0) as total_paid,
        coalesce(sum(rn.pending_amount), 0) as total_pending
       FROM rent_records rn
       LEFT JOIN students s ON rn.student_id = s.id
       LEFT JOIN rooms r ON rn.room_id = r.id
       LEFT JOIN beds b ON rn.bed_id = b.id
       ${whereSql}`,
      params
    );

    res.json({
      records,
      summary: {
        totalBilled: summary?.total_billed || 0,
        totalPaid: summary?.total_paid || 0,
        totalPending: summary?.total_pending || 0,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch rent records: ' + err.message });
  }
});

// POST /api/rent/generate: Generate rent for a single student or batch for all active students
router.post('/generate', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mode, student_id, billing_month, due_date, discount, late_fee, other_charges, notes } = req.body;

    if (!billing_month || !/^\d{4}-\d{2}$/.test(billing_month)) {
      res.status(400).json({ error: 'Valid billing month (YYYY-MM) is required.' });
      return;
    }

    const dueDate = due_date || `${billing_month}-10`; // Default 10th of month
    const disc = Math.max(0, parseFloat(discount) || 0);
    const lFee = Math.max(0, parseFloat(late_fee) || 0);
    const oCharges = Math.max(0, parseFloat(other_charges) || 0);

    const now = new Date().toISOString();

    if (mode === 'single') {
      if (!student_id) {
        res.status(400).json({ error: 'Student ID is required for single generation.' });
        return;
      }

      // Check active allocation
      const alloc = queryOne<{
        id: string;
        student_id: string;
        room_id: string;
        bed_id: string;
        monthly_rent: number;
        student_name: string;
      }>(
        `SELECT a.id, a.student_id, a.room_id, a.bed_id, a.monthly_rent, s.full_name as student_name
         FROM room_allocations a
         JOIN students s ON a.student_id = s.id
         WHERE a.student_id = ? AND a.status = 'active'`,
        [student_id]
      );

      if (!alloc) {
        res.status(400).json({ error: 'Student does not have an active bed allocation to generate rent for.' });
        return;
      }

      const billingPeriod = `${billing_month}`;

      // Check duplicate
      const existing = queryOne('SELECT id FROM rent_records WHERE student_id = ? AND billing_period = ?', [
        student_id,
        billingPeriod,
      ]);

      if (existing) {
        res.status(400).json({ error: `Rent for ${alloc.student_name} for period ${billingPeriod} has already been generated.` });
        return;
      }

      const baseRent = alloc.monthly_rent;
      const totalAmount = Math.max(0, baseRent + oCharges + lFee - disc);
      const rentId = 'rnt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      runQuery(
        `INSERT INTO rent_records (
          id, student_id, allocation_id, room_id, bed_id, billing_month,
          billing_period, rent_amount, discount, late_fee, other_charges,
          total_amount, paid_amount, pending_amount, due_date, status, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'pending', ?, ?, ?)`,
        [
          rentId,
          student_id,
          alloc.id,
          alloc.room_id,
          alloc.bed_id,
          billing_month,
          billingPeriod,
          baseRent,
          disc,
          lFee,
          oCharges,
          totalAmount,
          totalAmount,
          dueDate,
          notes?.trim() || null,
          now,
          now,
        ]
      );

      logAudit('RENT_GENERATED', `Generated rent invoice for ${alloc.student_name} (${billingPeriod})`, req.user!.id, req.user!.username, req.ip);

      res.status(201).json({
        success: true,
        message: `Rent invoice generated for ${alloc.student_name} (${billingPeriod}). Total: ₹${totalAmount}`,
        rentId,
      });
      return;
    }

    // Batch mode: generate rent for ALL active students with active allocations
    const activeAllocations = queryAll<{
      id: string;
      student_id: string;
      room_id: string;
      bed_id: string;
      monthly_rent: number;
      full_name: string;
    }>(
      `SELECT a.id, a.student_id, a.room_id, a.bed_id, a.monthly_rent, s.full_name
       FROM room_allocations a
       JOIN students s ON a.student_id = s.id
       WHERE a.status = 'active' AND s.status = 'active'`
    );

    if (activeAllocations.length === 0) {
      res.status(400).json({ error: 'No active allocations found in the hostel.' });
      return;
    }

    let generatedCount = 0;
    let skippedCount = 0;

    for (const alloc of activeAllocations) {
      const billingPeriod = `${billing_month}`;
      const existing = queryOne('SELECT id FROM rent_records WHERE student_id = ? AND billing_period = ?', [
        alloc.student_id,
        billingPeriod,
      ]);

      if (existing) {
        skippedCount++;
        continue;
      }

      const baseRent = alloc.monthly_rent;
      const totalAmount = Math.max(0, baseRent + oCharges + lFee - disc);
      const rentId = 'rnt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      runQuery(
        `INSERT INTO rent_records (
          id, student_id, allocation_id, room_id, bed_id, billing_month,
          billing_period, rent_amount, discount, late_fee, other_charges,
          total_amount, paid_amount, pending_amount, due_date, status, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'pending', ?, ?, ?)`,
        [
          rentId,
          alloc.student_id,
          alloc.id,
          alloc.room_id,
          alloc.bed_id,
          billing_month,
          billingPeriod,
          baseRent,
          disc,
          lFee,
          oCharges,
          totalAmount,
          totalAmount,
          dueDate,
          notes?.trim() || 'Batch rent generation',
          now,
          now,
        ]
      );
      generatedCount++;
    }

    logAudit(
      'BATCH_RENT_GENERATED',
      `Batch rent generated for ${billing_month}: ${generatedCount} generated, ${skippedCount} skipped (already existed)`,
      req.user!.id,
      req.user!.username,
      req.ip
    );

    res.json({
      success: true,
      message: `Rent generation complete for ${billing_month}: ${generatedCount} generated, ${skippedCount} skipped.`,
      generatedCount,
      skippedCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate rent: ' + err.message });
  }
});

// PUT /api/rent/:id: Update rent adjustments (discount, late fee, other charges)
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const rentId = req.params.id;
    const existing = queryOne<{
      id: string;
      rent_amount: number;
      paid_amount: number;
      student_id: string;
      billing_period: string;
    }>('SELECT * FROM rent_records WHERE id = ?', [rentId]);

    if (!existing) {
      res.status(404).json({ error: 'Rent record not found.' });
      return;
    }

    const { discount, late_fee, other_charges, due_date, notes } = req.body;

    const disc = Math.max(0, parseFloat(discount) || 0);
    const lFee = Math.max(0, parseFloat(late_fee) || 0);
    const oCharges = Math.max(0, parseFloat(other_charges) || 0);

    const totalAmount = Math.max(0, existing.rent_amount + oCharges + lFee - disc);
    const pendingAmount = Math.max(0, totalAmount - existing.paid_amount);

    let status = 'pending';
    if (existing.paid_amount >= totalAmount && totalAmount > 0) {
      status = 'paid';
    } else if (existing.paid_amount > 0) {
      status = 'partially_paid';
    } else if (due_date && new Date(due_date) < new Date()) {
      status = 'overdue';
    }

    const now = new Date().toISOString();

    runQuery(
      `UPDATE rent_records SET
        discount = ?, late_fee = ?, other_charges = ?, total_amount = ?,
        pending_amount = ?, status = ?, due_date = coalesce(?, due_date),
        notes = ?, updated_at = ?
       WHERE id = ?`,
      [disc, lFee, oCharges, totalAmount, pendingAmount, status, due_date || null, notes?.trim() || null, now, rentId]
    );

    logAudit('RENT_UPDATED', `Updated rent invoice ${rentId}`, req.user!.id, req.user!.username, req.ip);

    res.json({ success: true, message: 'Rent invoice updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update rent: ' + err.message });
  }
});

export default router;
