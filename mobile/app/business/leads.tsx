import React, { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { leadService } from '@/services/erpService';
import { LEAD_STAGE_OPTIONS, optionLabel } from '@/constants/options';
import { LEAD_STAGE_TONES } from '@/constants/status';
import { formatDateShort } from '@/lib/format';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { Lead } from '@/types';

const PIPELINE_CHIPS = [
  { label: 'All', value: '' },
  ...LEAD_STAGE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
];

export default function LeadsScreen() {
  const router = useRouter();
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 350);
  const version = useDataVersionKey(DATA_KEYS.leads);

  const fetchPage = useCallback(
    async (page: number) =>
      leadService.list({
        stage: (stage || undefined) as never,
        search: debounced || undefined,
        page,
        limit: 20,
      }),
    [stage, debounced, version],
  );

  return (
    <ErpListScreen<Lead>
      title="Leads"
      subtitle="Sales pipeline"
      fetchPage={fetchPage}
      deps={[stage, debounced, version]}
      keyExtractor={(l) => l._id}
      addRoute="/modal/lead"
      addLabel="Add"
      searchPlaceholder="Search leads…"
      searchValue={search}
      onSearchChange={setSearch}
      chips={PIPELINE_CHIPS}
      chipValue={stage}
      onChipChange={setStage}
      renderItem={(lead) => (
        <RowCard
          icon="trending-up-outline"
          title={lead.name}
          subtitle={[
            `via ${optionLabel(LEAD_STAGE_OPTIONS, lead.stage).replace('Lead', '').trim()}`,
            lead.interestedIn ?? undefined,
            lead.nextFollowUpDate && lead.stage !== 'booked' && lead.stage !== 'lost'
              ? `Follow-up ${formatDateShort(lead.nextFollowUpDate)}`
              : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
          right={
            <Badge
              label={optionLabel(LEAD_STAGE_OPTIONS, lead.stage)}
              tone={LEAD_STAGE_TONES[lead.stage]}
            />
          }
          onPress={() => router.push(`/business/lead/${lead._id}` as never)}
        />
      )}
      emptyTitle="No leads here"
      emptyMessage="New enquiries land in the pipeline — move them towards a booking."
    />
  );
}
