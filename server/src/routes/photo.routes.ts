import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../utils/apiResponse';
import { protect, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { photoUploadSchema, photoQuerySchema } from '../validators/photo.validator';
import * as photos from '../controllers/photo.controller';

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];
const DOC_MIMES = ['application/pdf'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 64 * 1024 * 1024, // videos are big; per-mime caps enforced below
    fields: 20,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [...IMAGE_MIMES, ...VIDEO_MIMES, ...DOC_MIMES];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only images, MP4/MOV videos and PDF documents are allowed.'));
  },
});

function sizeCapFor(mimeType: string): number {
  if (mimeType.startsWith('video/')) return 64 * 1024 * 1024;
  if (mimeType === 'application/pdf') return 10 * 1024 * 1024;
  return 8 * 1024 * 1024; // images
}

const router = Router();

router.use(protect);

router.get(
  '/',
  authorize('owner', 'manager', 'engineer'),
  validate({ query: photoQuerySchema }),
  asyncHandler(photos.listPhotos),
);
router.post(
  '/',
  authorize('owner', 'manager', 'engineer'),
  upload.single('media'),
  (req, res, next) => {
    // multer puts text fields in req.body; coerce/validate them here.
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (file && file.size > sizeCapFor(file.mimetype)) {
        const capMb = Math.round(sizeCapFor(file.mimetype) / (1024 * 1024));
        res.status(413).json({
          success: false,
          message: `File too large. Maximum ${capMb} MB for this type.`,
        });
        return;
      }
      (req as any).validatedBody = photoUploadSchema.parse(req.body ?? {});
      next();
    } catch (err) {
      next(err);
    }
  },
  photos.uploadPhoto as any,
);
router.delete('/:id', authorize('owner', 'manager', 'engineer'), asyncHandler(photos.deletePhoto));

export default router;
