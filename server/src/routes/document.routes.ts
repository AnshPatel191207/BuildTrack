import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/apiResponse';
import { protect, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  documentMetaSchema,
  documentQuerySchema,
} from '../validators/erp.validator';
import * as documents from '../controllers/document.controller';

const router = Router();
router.use(protect);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get('/', validate({ query: documentQuerySchema }), asyncHandler(documents.listDocuments));
router.post(
  '/',
  requirePermission('canManageDocuments'),
  upload.single('file'),
  validate({ body: documentMetaSchema }),
  asyncHandler(documents.uploadDocument),
);
router.delete(
  '/:id',
  requirePermission('canManageDocuments'),
  asyncHandler(documents.deleteDocument),
);

export default router;
