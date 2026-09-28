import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { getDb } from './server/db.js';

// Route imports
import authRoutes from './server/routes/auth.js';
import studentsRoutes from './server/routes/students.js';
import roomsRoutes from './server/routes/rooms.js';
import bedsRoutes from './server/routes/beds.js';
import allocationsRoutes from './server/routes/allocations.js';
import rentRoutes from './server/routes/rent.js';
import paymentsRoutes from './server/routes/payments.js';
import expensesRoutes from './server/routes/expenses.js';
import dashboardRoutes from './server/routes/dashboard.js';
import duesRoutes from './server/routes/dues.js';
import reportsRoutes from './server/routes/reports.js';
import settingsRoutes from './server/routes/settings.js';
import backupsRoutes from './server/routes/backups.js';
import auditLogsRoutes from './server/routes/auditLogs.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Initialize Database
  await getDb();

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Mount API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/students', studentsRoutes);
  app.use('/api/rooms', roomsRoutes);
  app.use('/api/beds', bedsRoutes);
  app.use('/api/allocations', allocationsRoutes);
  app.use('/api/rent', rentRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/expenses', expensesRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/dues', duesRoutes);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/backups', backupsRoutes);
  app.use('/api/audit-logs', auditLogsRoutes);

  // Direct receipt print shortcut route
  app.get('/receipt/:receiptNumber/print', (req, res) => {
    res.redirect('/api/payments/receipt/' + encodeURIComponent(req.params.receiptNumber) + '/print');
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HostelMaster] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[HostelMaster] Fatal server error during startup:', err);
  process.exit(1);
});
