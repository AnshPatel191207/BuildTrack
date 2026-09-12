import React, { useCallback, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { milestoneService } from '@/services/erpService';
import { MILESTONE_STATUS_TONES } from '@/constants/status';
import { formatDateShort } from '@/lib/format';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { Milestone } from '@/types';

const VIEW_CHIPS = [
  { label: 'All', value: '' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Delayed', value: 'delayed' },
  { label: 'Completed', value: 'completed' },
];

export default function MilestonesScreen() {
  const [view, setView] = useState('');
  const version = useDataVersionKey(DATA_KEYS.milestones);

  const fetchPage = useCallback(
    async (page: number) =>
      milestoneService.list({ view: view || undefined, page }),
    [view, version],
  );

  return (
    <ErpListScreen<Milestone>
      title="Milestones"
      subtitle="Key project checkpoints"
      fetchPage={fetchPage}
      deps={[view, version]}
      keyExtractor={(m) => m._id}
      addRoute="/modal/milestone"
      addLabel="Add"
      chips={VIEW_CHIPS}
      chipValue={view}
      onChipChange={setView}
      renderItem={(milestone) => {
        const projectName =
          typeof milestone.projectId === 'object' ? milestone.projectId?.name : undefined;
        return (
          <RowCard
            icon={
              milestone.effectiveStatus === 'delayed'
                ? 'alert-circle-outline'
                : milestone.effectiveStatus === 'completed'
                  ? 'checkmark-circle-outline'
                  : 'flag-outline'
            }
            title={`${milestone.name}${projectName ? ` · ${projectName}` : ''}`}
            subtitle={[
              `Due ${formatDateShort(milestone.dueDate)}`,
              milestone.daysOverdue ? `${milestone.daysOverdue} days late` : undefined,
              milestone.completedAt ? `Completed ${formatDateShort(milestone.completedAt)}` : undefined,
            ]
              .filter(Boolean)
              .join(' · ')}
            right={
              <Badge
                label={milestone.effectiveStatus ?? milestone.status}
                tone={MILESTONE_STATUS_TONES[milestone.effectiveStatus ?? milestone.status]}
              />
            }
          />
        );
      }}
      emptyTitle="No milestones"
      emptyMessage="Track foundation, structure, finishing and handover checkpoints."
    />
  );
}
