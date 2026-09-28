import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { queryAll } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/dues: Student-wise dues calculations
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, min_due, sort = 'outstanding', order = 'DESC' } = req.query;

    const studentDues = queryAll<{
      student_id: string;
      full_name: string;
      admission_number: string;
      mobile: string;
      email: string;
      student_status: string;
      room_number: string | null;
      bed_number: string | null;
      total_billed: number;
      total_paid: number;
      outstanding: number;
      oldest_due_date: string | null;
      oldest_pending_amount: number | null;
    }>(
      `SELECT
        s.id as student_id,
        s.full_name,
        s.admission_number,
        s.mobile,
        s.email,
        s.status as student_status,
        r.room_number,
        b.bed_number,
        coalesce(sum(rn.total_amount), 0) as total_billed,
        coalesce(sum(rn.paid_amount), 0) as total_paid,
        coalesce(sum(rn.pending_amount), 0) as outstanding,
        min(case when rn.pending_amount > 0 then rn.due_date end) as oldest_due_date,
        (
          SELECT rn2.pending_amount
          FROM rent_records rn2
          WHERE rn2.student_id = s.id AND rn2.pending_amount > 0
          ORDER BY rn2.due_date ASC LIMIT 1
        ) as oldest_pending_amount
       FROM students s
       LEFT JOIN room_allocations a ON a.student_id = s.id AND a.status = 'active'
       LEFT JOIN rooms r ON a.room_id = r.id
       LEFT JOIN beds b ON a.bed_id = b.id
       JOIN rent_records rn ON rn.student_id = s.id
       GROUP BY s.id
       HAVING outstanding > 0`
    );

    const now = new Date();

    let list = studentDues.map(item => {
      let daysOverdue = 0;
      if (item.oldest_due_date) {
        const dueDate = new Date(item.oldest_due_date);
        const diffMs = now.getTime() - dueDate.getTime();
        daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      }
      return {
        ...item,
        daysOverdue,
      };
    });

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        d =>
          d.full_name.toLowerCase().includes(q) ||
          d.admission_number.toLowerCase().includes(q) ||
          d.mobile.toLowerCase().includes(q) ||
          (d.room_number && d.room_number.toLowerCase().includes(q))
      );
    }

    if (min_due) {
      const min = parseFloat(min_due as string) || 0;
      list = list.filter(d => d.outstanding >= min);
    }

    // Sort
    list.sort((a, b) => {
      let valA: any = a.outstanding;
      let valB: any = b.outstanding;
      if (sort === 'days_overdue') {
        valA = a.daysOverdue;
        valB = b.daysOverdue;
      } else if (sort === 'name') {
        valA = a.full_name;
        valB = b.full_name;
      }
      if (order === 'ASC') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

    const totalOutstanding = list.reduce((sum, d) => sum + d.outstanding, 0);

    res.json({
      dues: list,
      totalOutstanding,
      count: list.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to calculate student dues: ' + err.message });
  }
});

export default router;
