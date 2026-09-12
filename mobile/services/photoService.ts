import { api, cachedGet } from './api';
import type {
  ApiResponse,
  MediaKind,
  Pagination,
  PhotoCategory,
  SiteMedia,
} from '@/types';

export const PHOTO_CATEGORIES: { label: string; value: PhotoCategory }[] = [
  { label: 'Progress', value: 'progress' },
  { label: 'Material', value: 'material' },
  { label: 'Issue / Defect', value: 'issue' },
  { label: 'Safety', value: 'safety' },
  { label: 'Completion', value: 'completion' },
];

/** Client-side upload validation mirrors the server caps. */
export const MEDIA_LIMITS = {
  maxImageBytes: 8 * 1024 * 1024,
  maxVideoBytes: 64 * 1024 * 1024,
  maxDocumentBytes: 10 * 1024 * 1024,
};

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];

export function mediaKindFor(mimeType: string): MediaKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

export function validateMediaFile(file: {
  mimeType: string;
  sizeBytes?: number | null;
}): string | null {
  const kind = mediaKindFor(file.mimeType);
  if (kind === 'image') {
    if (!IMAGE_MIMES.includes(file.mimeType)) {
      return 'Only JPEG, PNG or WebP images are allowed.';
    }
    if ((file.sizeBytes ?? 0) > MEDIA_LIMITS.maxImageBytes) return 'Images must be under 8 MB.';
  } else if (kind === 'video') {
    if (!VIDEO_MIMES.includes(file.mimeType)) {
      return 'Only MP4, MOV or WebM videos are allowed.';
    }
    if ((file.sizeBytes ?? 0) > MEDIA_LIMITS.maxVideoBytes) return 'Videos must be under 64 MB.';
  } else if (file.mimeType !== 'application/pdf') {
    return 'Documents must be PDF files.';
  } else if ((file.sizeBytes ?? 0) > MEDIA_LIMITS.maxDocumentBytes) {
    return 'PDF documents must be under 10 MB.';
  }
  return null;
}

export interface MediaListResult {
  items: SiteMedia[];
  pagination: Pagination | null;
}

export async function listPhotos(filters: {
  projectId?: string | null;
  category?: PhotoCategory | '';
  kind?: MediaKind | '';
  page?: number;
  limit?: number;
}): Promise<SiteMedia[]> {
  const params: Record<string, string> = {};
  if (filters.projectId) params.projectId = filters.projectId;
  if (filters.category) params.category = filters.category;
  if (filters.kind) params.kind = filters.kind;
  return cachedGet<SiteMedia[]>('/photos', {
    ...params,
    ...(filters.page ? { page: String(filters.page) } : {}),
    ...(filters.limit ? { limit: String(filters.limit) } : {}),
  });
}

export async function listPhotosPaged(filters: {
  projectId?: string | null;
  category?: PhotoCategory | '';
  kind?: MediaKind | '';
  page?: number;
  limit?: number;
}): Promise<MediaListResult> {
  const params: Record<string, string> = {};
  if (filters.projectId) params.projectId = filters.projectId;
  if (filters.category) params.category = filters.category;
  if (filters.kind) params.kind = filters.kind;
  if (filters.page) params.page = String(filters.page);
  if (filters.limit) params.limit = String(filters.limit);
  const res = await api.get<ApiResponse<SiteMedia[]>>('/photos', { params });
  return {
    items: res.data.data,
    pagination: res.data.pagination ?? null,
  };
}

/**
 * Multipart upload for images, videos and document scans.
 * `uri` is a local file URI from expo-image-picker / expo-camera.
 * Progress callback receives 0..1; timeout is generous for slow site Wi-Fi.
 */
export async function uploadPhoto(
  file: { uri: string; name?: string; mimeType?: string; durationSeconds?: number },
  fields: { projectId: string; category: PhotoCategory; description?: string },
  onProgress?: (fraction: number) => void,
): Promise<SiteMedia> {
  const mimeType =
    file.mimeType ??
    (file.uri.toLowerCase().endsWith('.png')
      ? 'image/png'
      : file.uri.toLowerCase().match(/\.(mp4|mov|m4v)$/)
        ? file.uri.toLowerCase().endsWith('.mov')
          ? 'video/quicktime'
          : 'video/mp4'
        : file.uri.toLowerCase().endsWith('.pdf')
          ? 'application/pdf'
          : 'image/jpeg');

  const formData = new FormData();
  formData.append('projectId', fields.projectId);
  formData.append('category', fields.category);
  if (fields.description) formData.append('description', fields.description);
  if (file.durationSeconds != null) {
    formData.append('durationSeconds', String(Math.round(file.durationSeconds)));
  }
  formData.append('media', {
    uri: file.uri,
    name:
      file.name ??
      `${mediaKindFor(mimeType)}-${Date.now()}.${mimeType.split('/')[1].replace('quicktime', 'mov')}`,
    type: mimeType,
  } as unknown as Blob);

  const res = await api.post<ApiResponse<SiteMedia>>('/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300_000,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(e.loaded / e.total);
    },
  });
  return res.data.data;
}

export async function deletePhoto(id: string): Promise<void> {
  await api.delete(`/photos/${id}`);
}

/**
 * Generic multipart upload used by ERP modules (e.g. document management).
 * Appends every meta entry as a form field and posts `file` as the part name.
 */
export async function uploadFileGeneric<T>(
  url: string,
  file: { uri: string; name?: string; mimeType?: string },
  fields: Record<string, unknown>,
  onProgress?: (fraction: number) => void,
  partName = 'file',
): Promise<T> {
  const mimeType =
    file.mimeType ??
    (file.uri.toLowerCase().endsWith('.png')
      ? 'image/png'
      : file.uri.toLowerCase().endsWith('.pdf')
        ? 'application/pdf'
        : file.uri.toLowerCase().match(/\.(mp4|mov|m4v)$/)
          ? 'video/mp4'
          : 'image/jpeg');

  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  }
  formData.append(partName, {
    uri: file.uri,
    name:
      file.name ??
      `${mediaKindFor(mimeType)}-${Date.now()}.${mimeType.split('/')[1].replace('quicktime', 'mov')}`,
    type: mimeType,
  } as unknown as Blob);

  const res = await api.post<ApiResponse<T>>(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300_000,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(e.loaded / e.total);
    },
  });
  return res.data.data;
}

// Namespace-style export used by screens: photoService.xxx(...)
export const photoService = {
  listPhotos,
  listPhotosPaged,
  uploadPhoto,
  deletePhoto,
  uploadFileGeneric,
};
