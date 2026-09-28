import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { queryOne, queryAll } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard/stats: Real aggregated dashboard data from database
router.get('/stats', (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

    // 1. Student counts
    const totalStudents = queryOne<{ c: number }>('SELECT count(*) as c FROM students')?.c || 0;
    const activeStudents = queryOne<{ c: number }>('SELECT count(*) as c FROM students WHERE status = "active"')?.c || 0;

    // 2. Room & Bed counts
    const totalRooms = queryOne<{ c: number }>('SELECT count(*) as c FROM rooms')?.c || 0;
    const totalBeds = queryOne<{ c: number }>('SELECT count(*) as c FROM beds')?.c || 0;
    const occupiedBeds = queryOne<{ c: number }>('SELECT count(*) as c FROM beds WHERE status = "occupied"')?.c || 0;
    const availableBeds = queryOne<{ c: number }>('SELECT count(*) as c FROM beds WHERE status = "available"')?.c || 0;
    const occupancyPercentage = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    // 3. Current month financials
    const currentMonthRentRow = queryOne<{ billed: number; paid: number; pending: number }>(
      `SELECT
        coalesce(sum(total_amount), 0) as billed,
        coalesce(sum(paid_amount), 0) as paid,
        coalesce(sum(pending_amount), 0) as pending
       FROM rent_records WHERE billing_month = ?`,
      [currentMonth]
    );

    const currentMonthRent = currentMonthRentRow?.billed || 0;
    const currentMonthCollection = currentMonthRentRow?.paid || 0;
    const currentMonthPending = currentMonthRentRow?.pending || 0;

    // 4. Overall financials
    const totalIncome = queryOne<{ total: number }>('SELECT coalesce(sum(amount), 0) as total FROM payments')?.total || 0;
    const totalExpenses = queryOne<{ total: number }>('SELECT coalesce(sum(amount), 0) as total FROM expenses')?.total || 0;
    const totalPendingRent = queryOne<{ total: number }>('SELECT coalesce(sum(pending_amount), 0) as total FROM rent_records')?.total || 0;
    const netIncome = totalIncome - totalExpenses;

    // 5. Recent records for dashboard feeds
    const recentPayments = queryAll(
      `SELECT p.*, coalesce(s.full_name, 'Student') as student_name, coalesce(s.admission_number, '—') as admission_number, r.room_number
       FROM payments p
       LEFT JOIN students s ON p.student_id = s.id
       LEFT JOIN rent_records rn ON p.rent_id = rn.id
       LEFT JOIN rooms r ON rn.room_id = r.id
       ORDER BY p.payment_date DESC, p.created_at DESC
       LIMIT 6`
    );

    const recentStudents = queryAll(
      `SELECT id, admission_number, full_name, mobile, college, admission_date, status
       FROM students
       ORDER BY admission_date DESC, created_at DESC
       LIMIT 6`
    );

    const recentExpenses = queryAll(
      `SELECT * FROM expenses ORDER BY date DESC, created_at DESC LIMIT 6`
    );

    const pendingDuesList = queryAll(
      `SELECT rn.id, rn.billing_period, rn.total_amount, rn.paid_amount, rn.pending_amount, rn.due_date,
        s.id as student_id, s.full_name as student_name, s.admission_number, s.mobile as student_mobile,
        r.room_number
       FROM rent_records rn
       JOIN students s ON rn.student_id = s.id
       JOIN rooms r ON rn.room_id = r.id
       WHERE rn.pending_amount > 0
       ORDER BY rn.due_date ASC, rn.pending_amount DESC
       LIMIT 6`
    );

    const recentAllocations = queryAll(
      `SELECT a.*, s.full_name as student_name, s.admission_number, r.room_number, b.bed_number
       FROM room_allocations a
       JOIN students s ON a.student_id = s.id
       JOIN rooms r ON a.room_id = r.id
       JOIN beds b ON a.bed_id = b.id
       ORDER BY a.allocation_date DESC, a.created_at DESC
       LIMIT 6`
    );

    // 6. Chart series data: Last 6 months collection vs expenses
    const monthlySeries: { month: string; rentBilled: number; collection: number; expenses: number }[] = [];
    const dateCursor = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(dateCursor.getFullYear(), dateCursor.getMonth() - i, 1);
      const mStr = d.toISOString().slice(0, 7);

      const rentM = queryOne<{ billed: number; paid: number }>(
        'SELECT coalesce(sum(total_amount), 0) as billed, coalesce(sum(paid_amount), 0) as paid FROM rent_records WHERE billing_month = ?',
        [mStr]
      );
      const expM = queryOne<{ total: number }>(
        'SELECT coalesce(sum(amount), 0) as total FROM expenses WHERE strftime("%Y-%m", date) = ?',
        [mStr]
      );

      monthlySeries.push({
        month: mStr,
        rentBilled: rentM?.billed || 0,
        collection: rentM?.paid || 0,
        expenses: expM?.total || 0,
      });
    }

    // 7. Admissions trend: Last 6 months
    const admissionsSeries: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(dateCursor.getFullYear(), dateCursor.getMonth() - i, 1);
      const mStr = d.toISOString().slice(0, 7);
      const admM = queryOne<{ c: number }>(
        'SELECT count(*) as c FROM students WHERE strftime("%Y-%m", admission_date) = ?',
        [mStr]
      );
      admissionsSeries.push({
        month: mStr,
        count: admM?.c || 0,
      });
    }

    res.json({
      summary: {
        totalStudents,
        activeStudents,
        totalRooms,
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyPercentage,
        currentMonthRent,
        currentMonthCollection,
        currentMonthPending,
        totalIncome,
        totalExpenses,
        totalPendingRent,
        netIncome,
      },
      recent: {
        payments: recentPayments,
        students: recentStudents,
        expenses: recentExpenses,
        pendingDues: pendingDuesList,
        allocations: recentAllocations,
      },
      charts: {
        monthlyFinancials: monthlySeries,
        admissionsTrend: admissionsSeries,
        occupancy: {
          occupied: occupiedBeds,
          available: availableBeds,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to load dashboard data: ' + err.message });
  }
});

export default router;
