import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { SelectSheet } from '@/components/ui/SelectSheet';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { customerService } from '@/services/erpService';
import {
  CUSTOMER_STAGE_OPTIONS,
  LEAD_SOURCE_OPTIONS,
  optionLabel,
} from '@/constants/options';
import { formatDateShort } from '@/lib/format';

export default function CustomerDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const { colors, spacing } = theme;

  const [detail, setDetail] = useState<Awaited<ReturnType<typeof customerService.get>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageSheet, setStageSheet] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await customerService.get(id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load customer.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const changeStage = (stage: string) => {
    setBusy(true);
    (async () => {
      try {
        await customerService.addTimeline(id, stage);
        showToast(`Journey moved to ${stage}`);
        bump(DATA_KEYS.customers);
        await load();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed', 'error');
      } finally {
        setBusy(false);
      }
    })();
  };

  if (loading && !detail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Customer" onBack={() => router.back()} />
        <View style={{ padding: spacing.lg, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} style={{ borderRadius: 14 }} />
          ))}
        </View>
      </View>
    );
  }
  if (error && !detail) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Customer" onBack={() => router.back()} />
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );
  }
  if (!detail) return null;

  const { customer, bookings } = detail;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={customer.name}
        subtitle={[customer.phone, customer.city].filter(Boolean).join(' · ')}
        onBack={() => router.back()}
        right={
          <Badge
            label={optionLabel(CUSTOMER_STAGE_OPTIONS, customer.journeyStage)}
            tone="info"
          />
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.md,
            marginTop: spacing.md,
          }}
        >
          {[
            ['Phone', customer.phone],
            ['Email', customer.email ?? undefined],
            ['City', customer.city ?? undefined],
            ['State', customer.state ?? undefined],
            ['Occupation', customer.occupation ?? undefined],
            ['PAN', customer.pan ?? undefined],
            ['Aadhaar', customer.aadhaar ? `XXXX XXXX ${customer.aadhaar.slice(-4)}` : undefined],
            ['Lead Source', optionLabel(LEAD_SOURCE_OPTIONS, customer.leadSource)],
          ]
            .filter(([, v]) => Boolean(v))
            .map(([label, value], index, arr) => (
              <View
                key={label as string}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 8,
                  borderBottomWidth: index === arr.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textFaint, fontSize: 13 }}>{label}</Text>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>{value}</Text>
              </View>
            ))}
        </View>

        <Button
          label="Advance journey stage"
          variant="secondary"
          disabled={busy}
          onPress={() => setStageSheet(true)}
          style={{ marginTop: spacing.md }}
        />

        <Text
          style={{
            color: colors.textFaint,
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginTop: spacing.lg,
          }}
        >
          Bookings ({bookings.length})
        </Text>
        {bookings.length === 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 13.5, marginTop: 6 }}>
            No bookings yet for this customer.
          </Text>
        ) : (
          bookings.map((booking) => (
            <PressableRow
              key={booking._id}
              title={`${booking.bookingNumber} · ${
                booking.unitId && typeof booking.unitId === 'object' ? booking.unitId.unitNumber : ''
              }`}
              subtitle={`${formatDateShort(booking.bookingDate)} · ${booking.status}`}
              right={
                <Badge label={String(booking.status)} tone={booking.status === 'sold' ? 'success' : 'orange'} />
              }
              onPress={() =>
                router.push({ pathname: '/business/booking/[id]', params: { id: String(booking._id) } } as never)
              }
            />
          ))
        )}

        <Text
          style={{
            color: colors.textFaint,
            fontSize: 12,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.8,
            marginTop: spacing.lg,
          }}
        >
          Journey timeline
        </Text>
        {[...customer.timeline].reverse().map((event, index) => (
          <View
            key={`${event.stage}-${index}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 9,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }}
          >
            <Badge label={optionLabel(CUSTOMER_STAGE_OPTIONS, event.stage)} tone="neutral" />
            <Text style={{ flex: 1, color: colors.textMuted, fontSize: 12.5 }} numberOfLines={1}>
              {event.note ?? ''}
            </Text>
            <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>
              {formatDateShort(event.date)}
            </Text>
          </View>
        ))}
      </ScrollView>

      <SelectSheet
        visible={stageSheet}
        onClose={() => setStageSheet(false)}
        title="Set journey stage"
        options={CUSTOMER_STAGE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
        value={customer.journeyStage}
        onSelect={(v) => {
          setStageSheet(false);
          changeStage(v);
        }}
      />
    </View>
  );
}

function PressableRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: 13,
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 14 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}



