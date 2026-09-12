import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { poService } from '@/services/erpService';
import { PO_STATUS_TONES } from '@/constants/status';
import { formatINR, formatDateShort } from '@/lib/format';

export default function PurchaseOrderDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const { colors, spacing } = theme;

  const [data, setData] = useState<Awaited<ReturnType<typeof poService.get>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await poService.get(id));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load PO.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const transition = (action: string, extra: Record<string, unknown> = {}) => {
    const doIt = () =>
      (async () => {
        setBusy(true);
        try {
          await poService.transition(id, action, extra);
          showToast(`PO ${action.replace(/_/g, ' ')}`);
          bump(DATA_KEYS.purchaseOrders);
          bump(DATA_KEYS.materials);
          bump(DATA_KEYS.expenses);
          bump(DATA_KEYS.dashboard);
          await load();
        } catch (err) {
          showToast(err instanceof Error ? err.message : 'Failed', 'error');
        } finally {
          setBusy(false);
        }
      })();

    if (action === 'deliver') {
      Alert.alert(
        'Record delivery?',
        'Stock will be posted into materials and the invoice value added to project spend automatically.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delivered',
            onPress: () => doIt(),
          },
        ],
      );
      return;
    }
    doIt();
  };

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Purchase Order" onBack={() => router.back()} />
        <View style={{ padding: spacing.lg, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={72} style={{ borderRadius: 14 }} />
          ))}
        </View>
      </View>
    );
  }
  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Purchase Order" onBack={() => router.back()} />
        <ErrorState message={error} onRetry={() => void load()} />
      </View>
    );
  }
  if (!data) return null;

  const { purchaseOrder: po, approval } = data;
  const vendorName = typeof po.vendorId === 'object' ? po.vendorId?.name : undefined;
  const outstanding = Math.max(po.totalAmount - po.paidAmount, 0);

  const actions: { label: string; action: string; disabled: boolean; destructive?: boolean }[] = [
    { label: 'Submit for approval', action: 'submit_approval', disabled: po.status !== 'draft' },
    { label: 'Place order', action: 'order', disabled: po.status !== 'approved' },
    { label: 'Mark delivered', action: 'deliver', disabled: po.status !== 'ordered' },
    { label: 'Close PO', action: 'close', disabled: !['delivered', 'ordered'].includes(po.status) },
    { label: 'Cancel PO', action: 'cancel', disabled: ['delivered', 'closed'].includes(po.status), destructive: true },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={po.poNumber}
        subtitle={vendorName}
        onBack={() => router.back()}
        right={<Badge label={po.status} tone={PO_STATUS_TONES[po.status]} />}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
          <StatBox label="PO Value" value={formatINR(po.totalAmount)} />
          <StatBox label="Paid" value={formatINR(po.paidAmount)} />
          <StatBox label="Outstanding" value={formatINR(outstanding)} danger={outstanding > 0} />
        </View>

        <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
          Items
        </Text>
        {po.items.map((item, index) => (
          <View
            key={index}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              backgroundColor: colors.surface,
              borderRadius: 10,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              padding: 11,
              marginTop: 7,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600', fontSize: 13.5 }}>
                {item.materialName}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2 }}>
                {item.quantity} {item.unit ?? ''} × {formatINR(item.rate)}
              </Text>
            </View>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13.5 }}>
              {formatINR(item.amount)}
            </Text>
          </View>
        ))}

        {/* Approval trail */}
        {approval ? (
          <>
            <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
              Approval chain
            </Text>
            {approval.steps.map((step) => (
              <Row key={String(step.level)} title={`${String(step.role).replace(/_/g, ' ')}`} status={step.status} />
            ))}
          </>
        ) : null}

        <Text style={{ color: colors.textFaint, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.lg }}>
          Workflow actions
        </Text>
        {actions.map((a) => (
          <Button
            key={a.action}
            label={a.label}
            variant={a.destructive ? 'ghost' : 'secondary'}
            size="sm"
            loading={busy}
            disabled={a.disabled || busy}
            onPress={() => transition(a.action)}
            style={{ marginTop: 8 }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 11,
      }}
    >
      <Text style={{ color: colors.textMuted, fontSize: 11.5, fontWeight: '600' }}>{label}</Text>
      <Text
        numberOfLines={1}
        style={{
          color: danger ? colors.danger : colors.text,
          fontWeight: '800',
          fontSize: 15,
          marginTop: 3,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Row({ title, status }: { title: string; status: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingVertical: 9,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}
    >
      <Badge
        label={status.replace(/_/g, ' ')}
        tone={
          status === 'approved'
            ? 'success'
            : status === 'rejected'
              ? 'danger'
              : status === 'changes_requested'
                ? 'orange'
                : 'warning'
        }
      />
      <Text style={{ flex: 1, color: colors.textMuted, fontSize: 13, textTransform: 'capitalize' }}>
        {title}
      </Text>
    </View>
  );
}


