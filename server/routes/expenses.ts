import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest, logAudit } from '../auth.js';
import { queryOne, queryAll, runQuery } from '../db.js';

const router = express.Router();
router.use(requireAuth);

const VALID_CATEGORIES = [
  'Electricity',
  'Water',
  'Maintenance',
  'Repairs',
  'Food',
  'Salary',
  'Cleaning',
  'Internet',
  'Furniture',
  'Equipment',
  'Rent',
  'Transport',
  'Other',
];

// GET /api/expenses: List expenses with filters
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, payment_mode, start_date, end_date, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let where: string[] = [];
    let params: any[] = [];

    if (category && category !== 'all') {
      where.push('category = ?');
      params.push(category);
    }
    if (payment_mode && payment_mode !== 'all') {
      where.push('payment_mode = ?');
      params.push(payment_mode);
    }
    if (start_date) {
      where.push('date >= ?');
      params.push(start_date);
    }
    if (end_date) {
      where.push('date <= ?');
      params.push(end_date);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      where.push('(description LIKE ? OR vendor LIKE ? OR reference_number LIKE ?)');
      params.push(q, q, q);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = queryOne<{ count: number }>(`SELECT count(*) as count FROM expenses ${whereSql}`, params);
    const total = countRow?.count || 0;

    const expenses = queryAll(`SELECT * FROM expenses ${whereSql} ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?`, [
      ...params,
      limitNum,
      offset,
    ]);

    const totalExpense = queryOne<{ total: number }>(
      `SELECT coalesce(sum(amount), 0) as total FROM expenses ${whereSql}`,
      params
    )?.total || 0;

    res.json({
      expenses,
      totalExpense,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch expenses: ' + err.message });
  }
});

// POST /api/expenses: Add expense
router.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { date, category, description, amount, payment_mode, vendor, reference_number, notes } = req.body;

    if (!description || !description.trim()) {
      res.status(400).json({ error: 'Expense description is required.' });
      return;
    }

    const expAmount = parseFloat(amount);
    if (isNaN(expAmount) || expAmount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number.' });
      return;
    }

    const expCategory = VALID_CATEGORIES.includes(category) ? category : 'Other';
    const expDate = date || new Date().toISOString().split('T')[0];
    const expMode = payment_mode || 'Cash';
    const id = 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const now = new Date().toISOString();

    runQuery(
      `INSERT INTO expenses (id, date, category, description, amount, payment_mode, vendor, reference_number, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        expDate,
        expCategory,
        description.trim(),
        expAmount,
        expMode,
        vendor?.trim() || null,
        reference_number?.trim() || null,
        notes?.trim() || null,
        now,
      ]
    );

    logAudit('EXPENSE_CREATED', `Expense added: ${description} (₹${expAmount}) [${expCategory}]`, req.user!.id, req.user!.username, req.ip);

    res.status(201).json({ success: true, message: 'Expense recorded successfully.', expenseId: id });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record expense: ' + err.message });
  }
});

// PUT /api/expenses/:id: Update expense
router.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const expenseId = req.params.id;
    const existing = queryOne('SELECT * FROM expenses WHERE id = ?', [expenseId]);
    if (!existing) {
      res.status(404).json({ error: 'Expense record not found.' });
      return;
    }

    const { date, category, description, amount, payment_mode, vendor, reference_number, notes } = req.body;

    const expAmount = parseFloat(amount);
    if (isNaN(expAmount) || expAmount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number.' });
      return;
    }

    const expCategory = VALID_CATEGORIES.includes(category) ? category : 'Other';

    runQuery(
      `UPDATE expenses SET
        date = ?, category = ?, description = ?, amount = ?, payment_mode = ?,
        vendor = ?, reference_number = ?, notes = ?
       WHERE id = ?`,
      [
        date || existing.date,
        expCategory,
        description?.trim() || existing.description,
        expAmount,
        payment_mode || existing.payment_mode,
        vendor?.trim() || null,
        reference_number?.trim() || null,
        notes?.trim() || null,
        expenseId,
      ]
    );

    logAudit('EXPENSE_UPDATED', `Expense updated: ${description} (₹${expAmount})`, req.user!.id, req.user!.username, req.ip);

    res.json({ success: true, message: 'Expense updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update expense: ' + err.message });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const expenseId = req.params.id;
    const existing = queryOne<{ description: string; amount: number }>('SELECT description, amount FROM expenses WHERE id = ?', [expenseId]);
    if (!existing) {
      res.status(404).json({ error: 'Expense record not found.' });
      return;
    }

    runQuery('DELETE FROM expenses WHERE id = ?', [expenseId]);
    logAudit('EXPENSE_DELETED', `Deleted expense: ${existing.description} (₹${existing.amount})`, req.user!.id, req.user!.username, req.ip);

    res.json({ success: true, message: 'Expense deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete expense: ' + err.message });
  }
});

export default router;
