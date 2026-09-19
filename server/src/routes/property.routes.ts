import { Router } from 'express';
import multer from 'multer';
import { protect, requirePermission, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/apiResponse';
import {
  propertyProjectBodySchema,
  towerBodySchema,
  floorBodySchema,
  flatBodySchema,
  shopBodySchema,
  templateBodySchema,
  projectBrandingBodySchema,
  projectThemeBodySchema,
  projectReceiptConfigBodySchema,
  projectLegalDocConfigBodySchema,
  projectRulesBodySchema,
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
import * as branding from '../controllers/branding.controller';

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
  requirePermission('canCreateProject'),
  validate({ body: propertyProjectBodySchema }),
  asyncHandler(property.createPropertyProject),
);

router.get('/projects/:projectId/towers', asyncHandler(property.listTowers));
router.post(
  '/projects/:projectId/towers',
  requirePermission('canManageTowers', 'canManageStructure'),
  validate({ body: towerBodySchema }),
  asyncHandler(property.createTower),
);

router.get('/towers', asyncHandler(property.listTowers));
router.post(
  '/towers',
  requirePermission('canManageTowers', 'canManageStructure'),
  validate({ body: towerBodySchema }),
  asyncHandler(property.createTower),
);

router.get('/towers/:towerId/floors', asyncHandler(property.listFloors));
router.post(
  '/towers/:towerId/floors',
  requirePermission('canManageFloors', 'canManageStructure'),
  validate({ body: floorBodySchema }),
  asyncHandler(property.createFloor),
);

router.get('/floors', asyncHandler(property.listFloors));
router.post(
  '/floors',
  requirePermission('canManageFloors', 'canManageStructure'),
  validate({ body: floorBodySchema }),
  asyncHandler(property.createFloor),
);
router.delete(
  '/towers/:id',
  requirePermission('canManageTowers', 'canManageStructure'),
  asyncHandler(property.deleteTower),
);
router.delete(
  '/floors/:id',
  requirePermission('canManageFloors', 'canManageStructure'),
  asyncHandler(property.deleteFloor),
);

// ── Flats & Shops ─────────────────────────────────────────────────
router.get('/flats', asyncHandler(property.listFlats));
router.post(
  '/flats',
  requirePermission('canManageFlats', 'canManageUnits'),
  validate({ body: flatBodySchema }),
  asyncHandler(property.createFlat),
);

router.get('/shops', asyncHandler(property.listShops));
router.post(
  '/shops',
  requirePermission('canManageShops', 'canManageUnits'),
  validate({ body: shopBodySchema }),
  asyncHandler(property.createShop),
);

// Inventory Deletion (Flats, Shops & Bulk Delete)
router.delete(
  '/units/:id',
  requirePermission('canManageUnits'),
  asyncHandler(property.deleteUnit),
);
router.delete(
  '/flats/:id',
  requirePermission('canManageUnits', 'canManageFlats'),
  asyncHandler(property.deleteUnit),
);
router.delete(
  '/shops/:id',
  requirePermission('canManageUnits', 'canManageShops'),
  asyncHandler(property.deleteUnit),
);
router.post(
  '/units/delete-all',
  requirePermission('canManageUnits'),
  asyncHandler(property.deleteAllUnits),
);

// ── Customers & 360° Profile ──────────────────────────────────────
router.get('/customers', validate({ query: customerQuerySchema }), asyncHandler(customers.listCustomers));
router.post(
  '/customers',
  requirePermission('canManageCustomers'),
  validate({ body: customerBodySchema }),
  asyncHandler(customers.createCustomer),
);
router.get('/customers/:id/profile', asyncHandler(property.getCustomer360Profile));
router.get('/customers/:id', asyncHandler(customers.getCustomer));
router.put(
  '/customers/:id',
  requirePermission('canManageCustomers'),
  validate({ body: customerUpdateSchema }),
  asyncHandler(customers.updateCustomer),
);
router.delete(
  '/customers/:id',
  requirePermission('canManageCustomers'),
  asyncHandler(customers.deleteCustomer),
);

// ── Bookings ──────────────────────────────────────────────────────
router.get('/bookings', validate({ query: bookingQuerySchema }), asyncHandler(bookings.listBookings));
router.post(
  '/bookings',
  requirePermission('canManageBookings'),
  validate({ body: bookingBodySchema }),
  asyncHandler(bookings.createBooking),
);
router.post(
  '/bookings/:bookingId/banakhat',
  requirePermission('canGenerateBanakhat', 'canManageDocuments'),
  asyncHandler(docs.generateBanakhatDocument),
);
router.post(
  '/bookings/:bookingId/dastavej',
  requirePermission('canGenerateDastavej', 'canManageDocuments'),
  asyncHandler(docs.generateDastavejDocument),
);
router.get('/bookings/:id', asyncHandler(bookings.getBooking));
router.post(
  '/bookings/:id/actions',
  requirePermission('canManageBookings', 'canApproveBookings'),
  validate({ body: bookingActionSchema }),
  asyncHandler(bookings.bookingAction),
);
router.post(
  '/bookings/:id/schedule',
  requirePermission('canManagePayments'),
  validate({ body: bookingScheduleSchema }),
  asyncHandler(bookings.generateSchedule),
);
router.delete(
  '/bookings/:id',
  requirePermission('canManageBookings'),
  asyncHandler(bookings.deleteBooking),
);

// ── Receivables & Payments ────────────────────────────────────────
router.get(
  '/payments/receivables',
  requirePermission('canViewReceivables', 'canManagePayments', 'canViewFinancials'),
  validate({ query: paymentQuerySchema }),
  asyncHandler(payments.receivablesDashboard),
);
router.get('/payments', validate({ query: paymentQuerySchema }), asyncHandler(payments.listPayments));
router.post(
  '/payments',
  requirePermission('canManagePayments'),
  validate({ body: paymentBodySchema }),
  asyncHandler(payments.createPayment),
);
router.post(
  '/payments/:paymentId/receipt',
  requirePermission('canGenerateReceipts', 'canManagePayments'),
  asyncHandler(docs.generatePaymentReceipt),
);
router.delete(
  '/payments/:paymentId/receipt',
  requirePermission('canManagePayments', 'canGenerateReceipts'),
  asyncHandler(docs.deletePaymentReceipt),
);
router.get('/payments/:id', asyncHandler(payments.getPayment));
router.put(
  '/payments/:id',
  requirePermission('canManagePayments'),
  validate({ body: paymentUpdateSchema }),
  asyncHandler(payments.updatePayment),
);
router.post(
  '/payments/:id/mark-paid',
  requirePermission('canManagePayments'),
  asyncHandler(payments.markPaymentPaid),
);
router.delete(
  '/payments/:id',
  requirePermission('canManagePayments'),
  asyncHandler(payments.deletePayment),
);

// ── Excel Bulk Import ─────────────────────────────────────────────
router.get('/import/template', asyncHandler(excel.downloadExcelTemplate));
router.post(
  '/import/preview',
  requirePermission('canImportInventory', 'canManageUnits'),
  upload.single('file'),
  asyncHandler(excel.previewExcelImport),
);
router.post(
  '/import/execute',
  requirePermission('canImportInventory', 'canManageUnits'),
  asyncHandler(excel.executeExcelImport),
);

// ── Property Documents, Templates & Previews ─────────────────────
router.get('/documents', asyncHandler(docs.listPropertyDocuments));
router.get('/documents/variables', asyncHandler(docs.listTemplateVariables));
router.get('/documents/receipts/:paymentId/pdf', asyncHandler(docs.streamPaymentReceiptPdf));
router.get('/documents/:id/pdf', asyncHandler(docs.streamPropertyDocumentPdf));
router.get('/documents/:id', asyncHandler(docs.getPropertyDocument));
router.delete(
  '/documents/:id',
  requirePermission('canManageDocuments'),
  asyncHandler(docs.deletePropertyDocument),
);

router.get('/templates', asyncHandler(docs.listDocumentTemplates));
router.post(
  '/templates',
  requirePermission('canManageTemplates'),
  validate({ body: templateBodySchema }),
  asyncHandler(docs.createDocumentTemplate),
);

// ── Project Master Configuration, Branding & Theming ──────────────
router.get('/projects/:projectId/configuration', asyncHandler(branding.getProjectConfiguration));
router.put(
  '/projects/:projectId/branding',
  requirePermission('canManageCompany', 'canEditProject'),
  validate({ body: projectBrandingBodySchema }),
  asyncHandler(branding.updateProjectBranding),
);
router.post(
  '/projects/:projectId/logo',
  requirePermission('canManageCompany', 'canEditProject'),
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'logoDark', maxCount: 1 }]),
  asyncHandler(branding.uploadProjectLogo),
);
router.delete(
  '/projects/:projectId/logo',
  requirePermission('canManageCompany', 'canEditProject'),
  asyncHandler(branding.deleteProjectLogo),
);
router.put(
  '/projects/:projectId/theme',
  requirePermission('canManageCompany', 'canEditProject'),
  validate({ body: projectThemeBodySchema }),
  asyncHandler(branding.updateProjectTheme),
);
router.put(
  '/projects/:projectId/receipt-config',
  requirePermission('canManageCompany', 'canEditProject'),
  validate({ body: projectReceiptConfigBodySchema }),
  asyncHandler(branding.updateReceiptConfig),
);
router.put(
  '/projects/:projectId/legal-doc-config',
  requirePermission('canManageCompany', 'canEditProject'),
  validate({ body: projectLegalDocConfigBodySchema }),
  asyncHandler(branding.updateLegalDocConfig),
);
router.put(
  '/projects/:projectId/rules',
  requirePermission('canManageCompany', 'canEditProject'),
  validate({ body: projectRulesBodySchema }),
  asyncHandler(branding.updateProjectRules),
);
router.post(
  '/projects/:projectId/receipt-preview',
  requirePermission('canManageCompany', 'canGenerateReceipts'),
  asyncHandler(docs.previewReceiptPdf),
);

// ── Property Dashboard, Analytics & Reports ───────────────────────
router.get('/dashboard', asyncHandler(reports.getPropertyDashboard));
router.get('/reports', asyncHandler(reports.generatePropertyReport));
router.get('/reports/export', asyncHandler(reports.exportPropertyReport));
router.get('/reports/export/excel', asyncHandler(reports.exportPropertyReportExcel));
router.get('/reports/export/pdf', asyncHandler(reports.exportPropertyReportPdf));

// ── Demo Seeding ──────────────────────────────────────────────────
router.post(
  '/seed-demo',
  authorize('owner', 'super_admin', 'admin'),
  asyncHandler(property.seedDemoPropertyData),
);

export default router;

