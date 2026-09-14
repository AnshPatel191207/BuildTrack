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
import * as property from '../controllers/property.controller';
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

// ── Customer 360° Profile ─────────────────────────────────────────
router.get('/customers/:id/profile', asyncHandler(property.getCustomer360Profile));

// ── Excel Bulk Import ─────────────────────────────────────────────
router.get('/import/template', asyncHandler(excel.downloadExcelTemplate));
router.post('/import/preview', upload.single('file'), asyncHandler(excel.previewExcelImport));
router.post('/import/execute', asyncHandler(excel.executeExcelImport));

// ── Auto Document Generation (Receipts, Banakhat, Dastavej) ───────
router.post('/payments/:paymentId/receipt', asyncHandler(docs.generatePaymentReceipt));
router.post('/bookings/:bookingId/banakhat', asyncHandler(docs.generateBanakhatDocument));
router.post('/bookings/:bookingId/dastavej', asyncHandler(docs.generateDastavejDocument));

router.get('/templates', asyncHandler(docs.listDocumentTemplates));
router.post('/templates', validate({ body: templateBodySchema }), asyncHandler(docs.createDocumentTemplate));

// ── Property Dashboard, Analytics & Reports ───────────────────────
router.get('/dashboard', asyncHandler(reports.getPropertyDashboard));
router.get('/reports', asyncHandler(reports.generatePropertyReport));
router.get('/reports/export/excel', asyncHandler(reports.exportPropertyReportExcel));
router.get('/reports/export/pdf', asyncHandler(reports.exportPropertyReportPdf));

export default router;
