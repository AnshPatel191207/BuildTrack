import React, { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { customerService } from '@/services/erpService';
import { CUSTOMER_STAGE_OPTIONS, LEAD_SOURCE_OPTIONS, optionLabel } from '@/constants/options';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { Customer } from '@/types';

export default function CustomersScreen() {
  const router = useRouter();
  const [stage, setStage] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 350);
  const version = useDataVersionKey(DATA_KEYS.customers);

  const fetchPage = useCallback(
    async (page: number) =>
      customerService.list({
        journeyStage: stage || undefined,
        search: debounced || undefined,
        page,
        limit: 20,
      }),
    [stage, debounced, version],
  );

  return (
    <ErpListScreen<Customer>
      title="Customers"
      subtitle="Your buyer relationships"
      fetchPage={fetchPage}
      deps={[stage, debounced, version]}
      keyExtractor={(c) => c._id}
      addRoute="/modal/customer"
      addLabel="Add"
      searchPlaceholder="Search name or phone…"
      searchValue={search}
      onSearchChange={setSearch}
      chips={[
        { label: 'All', value: '' },
        ...CUSTOMER_STAGE_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      ]}
      chipValue={stage}
      onChipChange={setStage}
      renderItem={(customer) => (
        <RowCard
          icon="person-outline"
          title={`${customer.name} · ${customer.phone}`}
          subtitle={[
            optionLabel(LEAD_SOURCE_OPTIONS, customer.leadSource),
            customer.city ?? undefined,
            `via ${optionLabel(LEAD_SOURCE_OPTIONS, customer.leadSource)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          right={
            <Badge
              label={optionLabel(CUSTOMER_STAGE_OPTIONS, customer.journeyStage)}
              tone={
                customer.journeyStage === 'possession' || customer.journeyStage === 'payment'
                  ? 'success'
                  : customer.journeyStage === 'booking'
                    ? 'orange'
                    : 'info'
              }
            />
          }
          onPress={() => router.push(`/business/customer/${customer._id}` as never)}
        />
      )}
      emptyTitle="No customers yet"
      emptyMessage="Add buyers as enquiries come in and track their journey to possession."
    />
  );
}

