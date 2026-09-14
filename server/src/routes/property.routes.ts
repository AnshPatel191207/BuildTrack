import { Router } from 'express';
import multer from 'multer';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/apiResponse';
import {
  propertyProjectBodySchema,
  towerBodySchema,
  floorBodySchema,
  flatBodySchema,
  shopBodySchema,
  templateBodySchema,
} from '../validators/property.validator';
import {
  customerBodySchema,
  customerUpdateSchema,
  customerQuerySchema,
  bookingBodySchema,
  bookingActionSchema,
  bookingScheduleSchema,
  bookingQuerySchema,
  paymentBodySchema,
  paymentUpdateSchema,
  paymentQuerySchema,
} from '../validators/erp.validator';
import * as property from '../controllers/property.controller';
import * as customers from '../controllers/customer.controller';
import * as bookings from '../controllers/booking.controller';
import * as payments from '../controllers/payment.controller';
import * as excel from '../controllers/excelImport.controller';
import * as docs from '../controllers/documentGenerator.controller';
import * as reports from '../controllers/propertyReport.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB
});

router.use(protect);

// ── Property Projects & Hierarchy ─────────────────────────────────
router.get('/projects', asyncHandler(property.listPropertyProjects));
router.post(
  '/projects',
  validate({ body: propertyProjectBodySchema }),
  asyncHandler(property.createPropertyProject),
);

router.get('/projects/:projectId/towers', asyncHandler(property.listTowers));
router.post(
  '/projects/:projectId/towers',
  validate({ body: towerBodySchema }),
  asyncHandler(property.createTower),
);

router.get('/towers', asyncHandler(property.listTowers));
router.post('/towers', validate({ body: towerBodySchema }), asyncHandler(property.createTower));

router.get('/towers/:towerId/floors', asyncHandler(property.listFloors));
router.post('/towers/:towerId/floors', validate({ body: floorBodySchema }), asyncHandler(property.createFloor));

router.get('/floors', asyncHandler(property.listFloors));
router.post('/floors', validate({ body: floorBodySchema }), asyncHandler(property.createFloor));

// ── Flats & Shops ─────────────────────────────────────────────────
router.get('/flats', asyncHandler(property.listFlats));
router.post('/flats', validate({ body: flatBodySchema }), asyncHandler(property.createFlat));

router.get('/shops', asyncHandler(property.listShops));
router.post('/shops', validate({ body: shopBodySchema }), asyncHandler(property.createShop));

// ── Customers & 360° Profile ──────────────────────────────────────
router.get('/customers', validate({ query: customerQuerySchema }), asyncHandler(customers.listCustomers));
router.post('/customers', validate({ body: customerBodySchema }), asyncHandler(customers.createCustomer));
router.get('/customers/:id/profile', asyncHandler(property.getCustomer360Profile));
router.get('/customers/:id', asyncHandler(customers.getCustomer));
router.put('/customers/:id', validate({ body: customerUpdateSchema }), asyncHandler(customers.updateCustomer));
router.delete('/customers/:id', asyncHandler(customers.deleteCustomer));

// ── Bookings ──────────────────────────────────────────────────────
router.get('/bookings', validate({ query: bookingQuerySchema }), asyncHandler(bookings.listBookings));
router.post('/bookings', validate({ body: bookingBodySchema }), asyncHandler(bookings.createBooking));
router.post('/bookings/:bookingId/banakhat', asyncHandler(docs.generateBanakhatDocument));
router.post('/bookings/:bookingId/dastavej', asyncHandler(docs.generateDastavejDocument));
router.get('/bookings/:id', asyncHandler(bookings.getBooking));
router.post('/bookings/:id/actions', validate({ body: bookingActionSchema }), asyncHandler(bookings.bookingAction));
router.post('/bookings/:id/schedule', validate({ body: bookingScheduleSchema }), asyncHandler(bookings.generateSchedule));
router.delete('/bookings/:id', asyncHandler(bookings.deleteBooking));

// ── Receivables & Payments ────────────────────────────────────────
router.get('/payments/receivables', validate({ query: paymentQuerySchema }), asyncHandler(payments.receivablesDashboard));
router.get('/payments', validate({ query: paymentQuerySchema }), asyncHandler(payments.listPayments));
router.post('/payments', validate({ body: paymentBodySchema }), asyncHandler(payments.createPayment));
router.post('/payments/:paymentId/receipt', asyncHandler(docs.generatePaymentReceipt));
router.get('/payments/:id', asyncHandler(payments.getPayment));
router.put('/payments/:id', validate({ body: paymentUpdateSchema }), asyncHandler(payments.updatePayment));
router.post('/payments/:id/mark-paid', asyncHandler(payments.markPaymentPaid));
router.delete('/payments/:id', asyncHandler(payments.deletePayment));

// ── Excel Bulk Import ─────────────────────────────────────────────
router.get('/import/template', asyncHandler(excel.downloadExcelTemplate));
router.post('/import/preview', upload.single('file'), asyncHandler(excel.previewExcelImport));
router.post('/import/execute', asyncHandler(excel.executeExcelImport));

// ── Property Documents & Templates ────────────────────────────────
router.get('/documents', asyncHandler(docs.listPropertyDocuments));
router.get('/documents/receipts/:paymentId/pdf', asyncHandler(docs.streamPaymentReceiptPdf));
router.get('/documents/:id/pdf', asyncHandler(docs.streamPropertyDocumentPdf));
router.get('/documents/:id', asyncHandler(docs.getPropertyDocument));

router.get('/templates', asyncHandler(docs.listDocumentTemplates));
router.post('/templates', validate({ body: templateBodySchema }), asyncHandler(docs.createDocumentTemplate));

// ── Property Dashboard, Analytics & Reports ───────────────────────
router.get('/dashboard', asyncHandler(reports.getPropertyDashboard));
router.get('/reports', asyncHandler(reports.generatePropertyReport));
router.get('/reports/export', asyncHandler(reports.exportPropertyReport));
router.get('/reports/export/excel', asyncHandler(reports.exportPropertyReportExcel));
router.get('/reports/export/pdf', asyncHandler(reports.exportPropertyReportPdf));

// ── Demo Seeding ──────────────────────────────────────────────────
router.post('/seed-demo', asyncHandler(property.seedDemoPropertyData));

export default router;

