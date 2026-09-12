import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { Photo } from '../models/Photo';
import { assertProjectAccess, canManageOperations } from '../utils/accessControl';
import { isCloudinaryEnabled, cloudinary } from '../config/cloudinary';
import { env } from '../config/env';
import { logError } from '../utils/logger';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];
const DOC_MIMES = ['application/pdf'];

export function resolveKind(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

function resourceTypeFor(mimeType: string): 'image' | 'video' | 'raw' {
  const kind = resolveKind(mimeType);
  if (kind === 'image') return 'image';
  if (kind === 'video') return 'video';
  return 'raw';
}

async function storeFile(
  file: Express.Multer.File,
): Promise<{ url: string; publicId: string | null }> {
  if (isCloudinaryEnabled()) {
    const resourceType = resourceTypeFor(file.mimetype);
    const options: Record<string, unknown> =
      resourceType === 'image'
        ? {
            folder: 'buildtrack',
            resource_type: 'image',
            transformation: [{ width: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
          }
        : { folder: 'buildtrack', resource_type: resourceType };

    return new Promise((resolve, reject) => {
      const stream = (cloudinary.uploader.upload_stream as any)(options, (error: any, result: any) => {
        if (error) {
          logError('Cloudinary upload failed', error);
          reject(ApiError.badRequest('Upload failed. Please try again.'));
        } else {
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      });
      stream.end(file.buffer);
    });
  }

  // Local disk fallback (development).
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = (path.extname(file.originalname) || '.bin').toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
  return { url: `/uploads/${filename}`, publicId: null };
}

async function deleteStoredMedia(publicId: string | null, url: string): Promise<void> {
  try {
    if (publicId && isCloudinaryEnabled()) {
      await cloudinary.uploader.destroy(publicId);
      // Videos/documents may need an explicit resource type on destroy.
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' } as any).catch(() => {});
      await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' } as any).catch(() => {});
    } else if (url.startsWith('/uploads/')) {
      const p = path.join(UPLOAD_DIR, path.basename(url));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch (err) {
    logError('Failed to delete stored media', err);
  }
}

function validateMime(mimeType: string): void {
  const allowed = [...IMAGE_MIMES, ...VIDEO_MIMES, ...DOC_MIMES];
  if (!allowed.includes(mimeType)) {
    throw ApiError.badRequest(
      'Unsupported file format. Allowed: JPEG, PNG, WebP images; MP4/MOV videos; PDF documents.',
    );
  }
}

export async function uploadPhoto(req: Request & { file?: Express.Multer.File }, res: Response) {
  const user = req.user! as AuthUser;
  if (!canManageOperations(user)) throw ApiError.forbidden();

  if (!req.file) throw ApiError.badRequest('Please attach a file.');
  validateMime(req.file.mimetype);

  const { projectId, category, description, durationSeconds } = req.body as {
    projectId: string;
    category?: string;
    description?: string;
    durationSeconds?: string | number;
  };
  await assertProjectAccess(user, projectId);

  const stored = await storeFile(req.file);
  const media = await Photo.create({
    companyId: user.companyId,
    projectId,
    kind: resolveKind(req.file.mimetype),
    mimeType: req.file.mimetype,
    category: category ?? 'progress',
    description: description ?? '',
    durationSeconds:
      durationSeconds != null && Number.isFinite(Number(durationSeconds))
        ? Math.round(Number(durationSeconds))
        : null,
    url: stored.url,
    publicId: stored.publicId,
    uploadedBy: user._id,
    sizeBytes: req.file.size ?? null,
  });
  await media.populate('uploadedBy', 'name role');
  res.status(201).json({ success: true, message: 'Uploaded successfully.', data: media });
}

export async function listPhotos(req: Request & { validatedQuery?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) {
    await assertProjectAccess(user, q.projectId);
    filter.projectId = q.projectId;
  }
  if (q.category) filter.category = q.category;
  if (q.kind) filter.kind = q.kind;

  const page = q.page ?? 1;
  const limit = q.limit ?? 60;
  const [items, total] = await Promise.all([
    Photo.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name')
      .populate('uploadedBy', 'name'),
    Photo.countDocuments(filter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function deletePhoto(req: Request, res: Response) {
  const user = req.user! as AuthUser;
  const photo = await Photo.findById(req.params.id);
  if (!photo || !photo.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('File not found.');
  }
  await deleteStoredMedia(photo.publicId, photo.url);
  await photo.deleteOne();
  sendSuccess(res, { id: photo._id }, 'File deleted.');
}

export { UPLOAD_DIR };
void env;
