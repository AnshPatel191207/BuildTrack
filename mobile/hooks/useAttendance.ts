import { useCallback, useState } from 'react';
import {
  bulkMarkAttendance,
  getAttendanceForDate,
  type AttendanceEntryInput,
} from '@/services/attendanceService';
import { DATA_KEYS, useDataVersion, useDataVersionKey } from '@/stores/dataVersion';
import { useResource } from './useResource';
import type { AttendanceRecord } from '@/types';

/**
 * Attendance records for a project + date, with the bulk-save action
 * (which supports GPS-verified entries) and cache invalidation.
 */
export function useAttendance(projectId: string | null | undefined, date: string) {
  const version = useDataVersionKey(DATA_KEYS.dashboard);
  const [saving, setSaving] = useState(false);

  const resource = useResource<AttendanceRecord[]>(
    () => getAttendanceForDate(projectId!, date),
    [projectId, date, version],
    { enabled: Boolean(projectId) },
  );

  const saveBulk = useCallback(
    async (entries: AttendanceEntryInput[]) => {
      setSaving(true);
      try {
        const result = await bulkMarkAttendance(projectId!, date, entries);
        useDataVersion.getState().bump(DATA_KEYS.dashboard);
        await resource.refresh();
        return result;
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, date],
  );

  return { ...resource, saving, saveBulk };
}

export type UseAttendanceResult = ReturnType<typeof useAttendance>;
