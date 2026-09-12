import React, { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { auditService } from '@/services/erpService';
import { useTheme } from '@/hooks/useTheme';
import { relativeTime } from '@/lib/format';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { AuditLogEntry } from '@/types';

const MODULE_CHIPS = [
  { label: 'All', value: '' },
  { label: 'Projects', value: 'projects' },
  { label: 'Bookings', value: 'bookings' },
  { label: 'Payments', value: 'payments' },
  { label: 'Procurement', value: 'procurement' },
  { label: 'Contractors', value: 'contractors' },
  { label: 'Progress', value: 'progress' },
  { label: 'Documents', value: 'documents' },
  { label: 'Inventory', value: 'inventory' },
];

export default function AuditLogsScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const [moduleFilter, setModuleFilter] = useState('');
  const version = useDataVersionKey(DATA_KEYS.dashboard);

  const fetchPage = useCallback(
    async (page: number) => auditService.list({ module: moduleFilter || undefined, page }),
    [moduleFilter],
  );

  return (
    <ErpListScreen<AuditLogEntry>
      title="Audit Logs"
      subtitle="Complete activity trail"
      fetchPage={fetchPage}
      deps={[moduleFilter]}
      keyExtractor={(entry) => entry._id}
      chips={MODULE_CHIPS}
      chipValue={moduleFilter}
      onChipChange={setModuleFilter}
      renderItem={(log) => (
        <RowCard
          icon={
            log.action.includes('delete')
              ? 'trash-outline'
              : log.action.includes('approve')
                ? 'checkmark-circle-outline'
                : log.action.includes('create')
                  ? 'add-circle-outline'
                  : 'create-outline'
          }
          iconBg={
            log.action.includes('delete')
              ? colors.dangerSoft
              : log.action.includes('approve')
                ? colors.successSoft
                : colors.surfaceAlt
          }
          iconColor={
            log.action.includes('delete')
              ? colors.danger
              : log.action.includes('approve')
                ? colors.success
                : colors.textMuted
          }
          title={log.description}
          subtitle={[
            log.userName ?? (typeof log.userId === 'object' ? log.userId?.name : undefined),
            `${log.module} · ${log.action}`,
            relativeTime(log.createdAt),
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      )}
      emptyTitle="No audit entries"
      emptyMessage="Actions across modules are recorded here automatically."
    />
  );
}




