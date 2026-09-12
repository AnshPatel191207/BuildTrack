import { api, cachedGet, mutateWithOfflineQueue } from './api';
import type { ApiResponse, AttendanceRecord, AttendanceStatus } from '@/types';

export interface AttendanceEntryInput {
  workerId: string;
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  overtimeHours?: number;
  remarks?: string;
  geo?: { latitude: number; longitude: number; distanceMeters?: number } | null;
}

/**
 * Idempotent upsert — re-marking a worker for a day updates their record,
 * so accidental duplicates are impossible.
 */
export async function bulkMarkAttendance(
  projectId: string,
  date: string,
  entries: AttendanceEntryInput[],
): Promise<{ created: number; updated: number }> {
  return mutateWithOfflineQueue<{ created: number; updated: number }>(
    {
      method: 'POST',
      url: '/attendance/bulk',
      data: { projectId, date, entries },
    },
    'Attendance',
  );
}

export async function markAttendance(
  projectId: string,
  date: string,
  entry: AttendanceEntryInput,
): Promise<void> {
  await bulkMarkAttendance(projectId, date, [entry]);
}

export async function getAttendanceForDate(
  projectId: string,
  date: string,
): Promise<AttendanceRecord[]> {
  return cachedGet<AttendanceRecord[]>('/attendance', { projectId, date });
}
