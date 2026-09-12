import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { bookingService } from '@/services/erpService';
import { BOOKING_STATUS_OPTIONS } from '@/constants/options';
import { BOOKING_STATUS_TONES } from '@/constants/status';
import { useTheme } from '@/hooks/useTheme';
import { formatCompactINR, formatDateShort } from '@/lib/format';
import { useDebouncedValue } from '@/hooks/useDebounce';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import type { Booking } from '@/types';

export default function BookingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { colors } = theme;
  const [status, setStatus] = useState('');
  const version = useDataVersionKey(DATA_KEYS.bookings);

  const fetchPage = useCallback(
    async (page: number) => bookingService.list({ status: (status || undefined) as never, page, limit: 20 }),
    [status, version],
  );

  return (
    <ErpListScreen<Booking>
      title="Bookings"
      subtitle="Lead → Booking → Payment → Sale"
      fetchPage={fetchPage}
      deps={[status, version]}
      keyExtractor={(b) => b._id}
      addRoute="/modal/booking"
      addLabel="Add"
      chips={[
        { label: 'All', value: '' },
        ...BOOKING_STATUS_OPTIONS.map((o) => ({ label: o.label, value: o.value })),
      ]}
      chipValue={status}
      onChipChange={setStatus}
      renderItem={(booking) => {
        const unitNumber =
          typeof booking.unitId === 'object' ? booking.unitId?.unitNumber : undefined;
        const customerName =
          typeof booking.customerId === 'object' ? booking.customerId?.name : undefined;
        return (
          <RowCard
            icon="file-tray-full-outline"
            title={`${booking.bookingNumber}${unitNumber ? ` · ${unitNumber}` : ''}`}
            subtitle={[
              customerName,
              formatDateShort(booking.bookingDate),
              `Booked ${formatCompactINR(booking.bookingAmount)}`,
              `Paid ${formatCompactINR(booking.paidAmount ?? 0)} of ${formatCompactINR(booking.totalValue)}`,
            ]
              .filter(Boolean)
              .join(' · ')}
            right={
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge label={booking.status} tone={BOOKING_STATUS_TONES[booking.status]} />
                {(booking.outstanding ?? 0) > 0 && booking.status !== 'cancelled' ? (
                  <Text style={{ color: colors.warning, fontSize: 11.5, fontWeight: '700' }}>
                    Due {formatCompactINR(booking.outstanding)}
                  </Text>
                ) : null}
              </View>
            }
            onPress={() => router.push(`/business/booking/${booking._id}` as never)}
          />
        );
      }}
      emptyTitle="No bookings yet"
      emptyMessage="Create a booking from a confirmed lead to start the sale."
    />
  );
}

