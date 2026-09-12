import React, { useCallback, useState } from 'react';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { vendorService } from '@/services/erpService';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { Vendor } from '@/types';

export default function VendorsScreen() {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 350);
  const version = useDataVersionKey(DATA_KEYS.vendors);

  const fetchPage = useCallback(
    async (page: number) =>
      vendorService.list({ search: debounced || undefined, page }),
    [debounced, version],
  );

  return (
    <ErpListScreen<Vendor>
      title="Vendors"
      subtitle="Material & service suppliers"
      fetchPage={fetchPage}
      deps={[debounced, version]}
      keyExtractor={(v) => v._id}
      addRoute="/modal/vendor"
      addLabel="Add"
      searchPlaceholder="Search vendors or GST…"
      searchValue={search}
      onSearchChange={setSearch}
      renderItem={(vendor) => (
        <RowCard
          icon="storefront-outline"
          title={vendor.companyName ?? vendor.name}
          subtitle={[
            vendor.gstNumber ? `GST ${vendor.gstNumber}` : undefined,
            vendor.phone,
            vendor.orderCount != null
              ? `${vendor.orderCount} orders (${vendor.deliveredCount} delivered)`
              : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      )}
      emptyTitle="No vendors yet"
      emptyMessage="Add suppliers to raise purchase orders against them."
    />
  );
}
