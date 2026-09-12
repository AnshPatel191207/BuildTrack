import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ApiError, sendCreated, sendSuccess } from '../utils/apiResponse';
import { DocumentFile } from '../models/DocumentFile';
import { assertProjectAccess } from '../utils/accessControl';
import { hasPermission } from '../utils/permissions';
import { utcDay, escapeRegex } from '../utils/dates';
import { logAudit } from '../utils/audit';
import { isCloudinaryEnabled, cloudinary } from '../config/cloudinary';
import { logError } from '../utils/logger';
import type { AuthUser } from '../types';
import type { Request, Response } from 'express';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

const ALLOWED_MIMES = [
  ...['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  ...['video/mp4', 'video/quicktime', 'video/webm'],
  'application/pdf',
];

function resolveKind(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

async function storeFile(file: Express.Multer.File): Promise<{ url: string; publicId: string | null }> {
  if (isCloudinaryEnabled()) {
    const resourceType = resolveKind(file.mimetype) === 'image' ? 'image' : resolveKind(file.mimetype) === 'video' ? 'video' : 'raw';
    return new Promise((resolve, reject) => {
      const stream = (cloudinary.uploader.upload_stream as any)(
        { folder: 'buildtrack-docs', resource_type: resourceType },
        (error: any, result: any) => {
          if (error) {
            logError('Document upload failed', error);
            reject(ApiError.badRequest('Upload failed. Please try again.'));
          } else {
            resolve({ url: result.secure_url, publicId: result.public_id });
          }
        },
      );
      stream.end(file.buffer);
    });
  }
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const ext = (path.extname(file.originalname) || '.bin').toLowerCase();
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
  return { url: `/uploads/${filename}`, publicId: null };
}

export async function uploadDocument(req: Request & { file?: Express.Multer.File; validatedBody?: any }, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageDocuments')) {
    throw ApiError.forbidden('You cannot manage documents.');
  }
  if (!req.file) throw ApiError.badRequest('Please attach a file.');
  if (!ALLOWED_MIMES.includes(req.file.mimetype)) {
    throw ApiError.badRequest('Supported formats: JPEG/PNG/WebP images, MP4/MOV videos and PDF files.');
  }

  const body = req.validatedBody;
  if (body.projectId) await assertProjectAccess(user, body.projectId);

  const stored = await storeFile(req.file);
  const doc = await DocumentFile.create({
    companyId: user.companyId,
    projectId: body.projectId || null,
    customerId: body.customerId || null,
    title: body.title,
    category: body.category ?? 'other',
    url: stored.url,
    publicId: stored.publicId,
    mimeType: req.file.mimetype,
    kind: resolveKind(req.file.mimetype),
    sizeBytes: req.file.size ?? null,
    expiryDate: body.expiryDate ? utcDay(body.expiryDate) : null,
    notes: body.notes,
    uploadedBy: user._id,
  });
  await doc.populate('uploadedBy', 'name');
  await doc.populate('projectId', 'name');

  await logAudit(req, {
    action: 'create',
    module: 'documents',
    entityType: 'document',
    entityId: doc._id,
    description: `${user.name} uploaded "${doc.title}"`,
    meta: { projectId: doc.projectId },
  });
  sendCreated(res, doc, `"${doc.title}" uploaded.`);
}

export async function listDocuments(req: Request & { validatedQuery?: any }, res: Response) {
  const user = req.user! as AuthUser;
  const q = req.validatedQuery ?? {};
  const filter: Record<string, unknown> = { companyId: user.companyId };
  if (q.projectId) filter.projectId = q.projectId;
  if (q.customerId) filter.customerId = q.customerId;
  if (q.category) filter.category = q.category;
  if (q.expiring === 'true') {
    const soon = new Date(Date.now() + 30 * 86_400_000);
    filter.expiryDate = { $ne: null, $lte: soon };
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i');
    filter.$or = [{ title: rx }, { notes: rx }];
  }

  const page = q.page ?? 1;
  const limit = Math.min(q.limit ?? 30, 100);
  const [items, total] = await Promise.all([
    DocumentFile.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('projectId', 'name')
      .populate('uploadedBy', 'name'),
    DocumentFile.countDocuments(filter),
  ]);
  sendSuccess(res, items, 'Success', {
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function deleteDocument(req: Request & { validatedBody?: any }, res: Response) {
  const user = req.user! as AuthUser;
  if (!hasPermission(user.role as string, 'canManageDocuments')) {
    throw ApiError.forbidden('You cannot manage documents.');
  }
  const doc = await DocumentFile.findById(req.params.id);
  if (!doc || !doc.companyId.equals(user.companyId!)) {
    throw ApiError.notFound('Document not found.');
  }
  try {
    if (doc.publicId && isCloudinaryEnabled()) {
      await cloudinary.uploader.destroy(doc.publicId);
      await cloudinary.uploader.destroy(doc.publicId, { resource_type: 'raw' } as any).catch(() => {});
      await cloudinary.uploader.destroy(doc.publicId, { resource_type: 'video' } as any).catch(() => {});
    } else if (doc.url.startsWith('/uploads/')) {
      const p = path.join(UPLOAD_DIR, path.basename(doc.url));
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  } catch (err) {
    logError('Failed to delete document file', err);
  }
  await doc.deleteOne();
  await logAudit(req, {
    action: 'delete',
    module: 'documents',
    entityType: 'document',
    entityId: doc._id,
    description: `${user.name} deleted "${doc.title}"`,
  });
  sendSuccess(res, { id: doc._id }, 'Document deleted.');
}
