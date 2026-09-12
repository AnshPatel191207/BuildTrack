import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { equipmentService } from '@/services/erpService';
import { EQUIPMENT_STATUS_OPTIONS } from '@/constants/options';
import { EQUIPMENT_STATUS_TONES } from '@/constants/status';
import { formatCompactINR } from '@/lib/format';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import { useTheme } from '@/hooks/useTheme';
import type { Equipment } from '@/types';

export default function EquipmentScreen() {
  const { colors } = useTheme();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 350);
  const version = useDataVersionKey(DATA_KEYS.equipment);

  const fetchPage = useCallback(
    async (page: number) =>
      equipmentService.list({
        status: status || undefined,
        search: debounced || undefined,
        page,
      }),
    [status, debounced, version],
  );

  return (
    <ErpListScreen<Equipment>
      title="Equipment"
      subtitle="Machinery fleet & costs"
      fetchPage={fetchPage}
      deps={[status, debounced, version]}
      keyExtractor={(e) => e._id}
      addRoute="/modal/equipment"
      addLabel="Add"
      searchPlaceholder="Search name or number…"
      searchValue={search}
      onSearchChange={setSearch}
      chips={[
        { label: 'All', value: '' },
        ...EQUIPMENT_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      ]}
      chipValue={status}
      onChipChange={setStatus}
      renderItem={(equipment) => (
        <RowCard
          icon="cog-outline"
          title={`${equipment.name} (${equipment.equipmentNumber})`}
          subtitle={[
            `${equipment.ownership === 'owned' ? `Bought ${formatCompactINR(equipment.purchaseCost)}` : `Rent ${formatCompactINR(equipment.rentalCostPerDay)}/day`}`,
            `${Math.round(equipment.operatingHours)}h used`,
            `Fuel ${formatCompactINR(equipment.fuelCostTotal)} · Maint ${formatCompactINR(equipment.maintenanceCostTotal)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          right={
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Badge label={equipment.status} tone={EQUIPMENT_STATUS_TONES[equipment.status]} />
              {equipment.utilizationPercent != null ? (
                <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>
                  Util {equipment.utilizationPercent}%
                </Text>
              ) : null}
            </View>
          }
        />
      )}
      emptyTitle="No equipment yet"
      emptyMessage="Track owned and rented machinery with running cost totals."
    />
  );
}



