import express, { Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../auth.js';
import { queryAll, queryOne } from '../db.js';

const router = express.Router();
router.use(requireAuth);

// GET /api/audit-logs
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, search, page = '1', limit = '30' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10) || 30));
    const offset = (pageNum - 1) * limitNum;

    let where: string[] = [];
    let params: any[] = [];

    if (action && action !== 'all') {
      where.push('action = ?');
      params.push(action);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = `%${search.trim()}%`;
      where.push('(action LIKE ? OR details LIKE ? OR username LIKE ? OR ip_address LIKE ?)');
      params.push(q, q, q, q);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = queryOne<{ count: number }>(`SELECT count(*) as count FROM audit_logs ${whereSql}`, params);
    const total = countRow?.count || 0;

    const logs = queryAll(`SELECT * FROM audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [
      ...params,
      limitNum,
      offset,
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs: ' + err.message });
  }
});

export default router;
