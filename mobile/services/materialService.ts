import { api, cachedGet } from './api';
import type {
  ApiResponse,
  Material,
  MaterialDetail,
  MaterialListResponse,
} from '@/types';

export async function listMaterials(
  filters: { projectId?: string | null; search?: string; lowStock?: boolean } = {},
): Promise<MaterialListResponse> {
  const params: Record<string, string> = {};
  if (filters.projectId) params.projectId = filters.projectId;
  if (filters.search) params.search = filters.search;
  if (filters.lowStock) params.lowStock = 'true';
  return cachedGet<MaterialListResponse>('/materials', params);
}

export async function getMaterial(id: string): Promise<MaterialDetail> {
  const res = await api.get<ApiResponse<MaterialDetail>>(`/materials/${id}`);
  return res.data.data;
}

export async function createMaterial(input: {
  projectId: string;
  name: string;
  category: string;
  unit: string;
  currentStock?: number;
  minimumStock?: number;
  averagePrice?: number;
  supplier?: string;
}): Promise<Material> {
  const res = await api.post<ApiResponse<Material>>('/materials', input);
  return res.data.data;
}

export type TransactionInput = {
  type: 'purchase' | 'usage' | 'adjustment' | 'return';
  quantity: number;
  unitPrice?: number;
  supplier?: string;
  invoiceNumber?: string;
  date?: string;
  notes?: string;
};

/** Stock is adjusted atomically server-side; low-stock alerts fire automatically. */
export async function createTransaction(
  materialId: string,
  input: TransactionInput,
): Promise<Material> {
  const res = await api.post<ApiResponse<Material>>(
    `/materials/${materialId}/transactions`,
    input,
  );
  return res.data.data;
}

export async function deleteMaterial(id: string): Promise<void> {
  await api.delete(`/materials/${id}`);
}

// Namespace-style export used by screens: materialService.xxx(...)
export const materialService = {
  listMaterials,
  getMaterial,
  createMaterial,
  createTransaction,
  deleteMaterial,
};
