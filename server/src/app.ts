import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { env } from './config/env';
import { httpLogger } from './utils/logger';
import { notFoundHandler, errorHandler } from './middleware/error';
import { protect } from './middleware/auth';
import { asyncHandler } from './utils/apiResponse';

import authRoutes from './routes/auth.routes';
import companyRoutes from './routes/company.routes';
import projectRoutes from './routes/project.routes';
import workerRoutes from './routes/worker.routes';
import attendanceRoutes from './routes/attendance.routes';
import materialRoutes from './routes/material.routes';
import expenseRoutes from './routes/expense.routes';
import taskRoutes from './routes/task.routes';
import reportRoutes from './routes/report.routes';
import photoRoutes from './routes/photo.routes';
import notificationRoutes from './routes/notification.routes';
import dashboardRoutes from './routes/dashboard.routes';
import inventoryRoutes from './routes/inventory.routes';
import customerRoutes from './routes/customer.routes';
import leadRoutes from './routes/lead.routes';
import bookingRoutes from './routes/booking.routes';
import paymentRoutes from './routes/payment.routes';
import contractorRoutes from './routes/contractor.routes';
import vendorRoutes from './routes/vendor.routes';
import purchaseOrderRoutes from './routes/purchaseOrder.routes';
import equipmentRoutes from './routes/equipment.routes';
import documentRoutes from './routes/document.routes';
import approvalRoutes from './routes/approval.routes';
import milestoneRoutes from './routes/milestone.routes';
import progressRoutes from './routes/progress.routes';
import analyticsRoutes, { auditRouter } from './routes/analytics.routes';
import { getProgressDashboard } from './controllers/progress.controller';

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow images from the API origin
    }),
  );

  const origins = env.CLIENT_URL.split(',').map((s) => s.trim()).filter(Boolean);
  app.use(
    cors(
      origins.length === 0 || origins.includes('*')
        ? { origin: true }
        : { origin: origins },
    ),
  );

  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(httpLogger);

  // Global rate limit + stricter auth rate limit.
  const globalLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again in a few minutes.',
    },
  });
  const authLimiter = rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many sign-in attempts. Please try again later.',
    },
  });
  app.use('/api', globalLimiter);
  app.use(['/api/auth/login', '/api/auth/register', '/api/auth/refresh'], authLimiter);

  // Local image storage (development fallback when Cloudinary is not configured).
  app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), { maxAge: '7d' }));

  app.get('/api/health', (_req, res) => {
    res.json({ success: true, message: 'BuildTrack API is running', data: { uptime: process.uptime() } });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/company', companyRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/workers', workerRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/materials', materialRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/photos', photoRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/dashboard', dashboardRoutes);

  // ── ERP expansion modules ─────────────────────────────────────
  app.use('/api/units', inventoryRoutes); // units + project structure + inventory summary
  app.use('/api/customers', customerRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/contractors', contractorRoutes);
  app.use('/api/vendors', vendorRoutes);
  app.use('/api/purchase-orders', purchaseOrderRoutes);
  app.use('/api/equipment', equipmentRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/approvals', approvalRoutes);
  app.use('/api/milestones', milestoneRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/audit-logs', auditRouter);

  // Project-scoped progress dashboard (Module 11).
  app.get('/api/projects/:id/progress', protect, asyncHandler(getProgressDashboard as any));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
