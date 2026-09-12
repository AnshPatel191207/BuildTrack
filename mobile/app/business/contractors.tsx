import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { contractorService } from '@/services/erpService';
import { WORK_TYPE_OPTIONS } from '@/constants/options';
import { useTheme } from '@/hooks/useTheme';
import { formatCompactINR } from '@/lib/format';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { Contractor } from '@/types';

export default function ContractorsScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 350);
  const version = useDataVersionKey(DATA_KEYS.contractors);

  const fetchPage = useCallback(
    async (page: number) => contractorService.list({ search: debounced || undefined, page }),
    [debounced, version],
  );

  return (
    <ErpListScreen<Contractor>
      title="Contractors"
      subtitle="Contracts & payments"
      fetchPage={fetchPage}
      deps={[debounced, version]}
      keyExtractor={(c) => c._id}
      addRoute="/modal/contractor"
      addLabel="Add"
      searchPlaceholder="Search contractors…"
      searchValue={search}
      onSearchChange={setSearch}
      renderItem={(contractor) => {
        const pending = contractor.pendingAmount ?? 0;
        return (
          <RowCard
            icon="hammer-outline"
            title={contractor.companyName ?? contractor.name}
            subtitle={[
              contractor.workTypes
                .map((w) => WORK_TYPE_OPTIONS.find((o) => o.value === w)?.label ?? w)
                .slice(0, 3)
                .join(', '),
              contractor.phone,
              `${contractor.contractCount ?? 0} contracts · paid ${formatCompactINR(contractor.paidAmount ?? 0)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
            right={
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge label={`Due ${formatCompactINR(pending)}`} tone={pending > 0 ? 'warning' : 'success'} />
                <Text style={{ color: colors.textFaint, fontSize: 11 }}>
                  of {formatCompactINR(contractor.totalContractValue ?? 0)}
                </Text>
              </View>
            }
          />
        );
      }}
      emptyTitle="No contractors yet"
      emptyMessage="Add work contractors and manage their contract values and bills."
    />
  );
}
