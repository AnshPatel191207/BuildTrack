import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { Badge } from '@/components/ui/Badge';
import { ErpListScreen, RowCard } from '@/components/erp/ListScreenKit';
import { approvalService } from '@/services/erpService';
import { APPROVAL_STATUS_TONES } from '@/constants/status';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { formatCompactINR, relativeTime } from '@/lib/format';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import type { Approval, ApprovalStatus } from '@/types';

const STATUS_CHIPS = [
  { label: 'Pending', value: 'pending' },
  { label: 'Mine', value: 'mine' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function ApprovalsScreen() {
  const { colors } = useTheme();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const [status, setStatus] = useState('pending');
  const [acting, setActing] = useState(false);

  const fetchPage = useCallback(
    async (page: number) => {
      if (status === 'mine') {
        return approvalService.list({ mine: true, page });
      }
      return approvalService.list({ status: status as never, page });
    },
    [status],
  );

  const act = (approval: Approval, decision: 'approve' | 'reject' | 'request_changes') => {
    setActing(true);
    (async () => {
      try {
        await approvalService.act(approval._id, decision);
        showToast(
          decision === 'approve'
            ? 'Approved'
            : decision === 'reject'
              ? 'Rejected'
              : 'Changes requested',
        );
        bump(DATA_KEYS.approvals);
        bump(DATA_KEYS.purchaseOrders);
        bump(DATA_KEYS.expenses);
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Action failed', 'error');
      } finally {
        setActing(false);
      }
    })();
  };

  const confirmAct = (approval: Approval) => {
    Alert.alert('Approval action', `"${approval.title}"`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => act(approval, 'approve') },
      { text: 'Request Changes', onPress: () => act(approval, 'request_changes') },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: () => act(approval, 'reject'),
      },
    ]);
  };

  return (
    <ErpListScreen<Approval>
      title="Approvals"
      subtitle="Expense · Purchase · Booking chains"
      fetchPage={fetchPage}
      deps={[status]}
      keyExtractor={(a) => a._id}
      chips={STATUS_CHIPS}
      chipValue={status}
      onChipChange={setStatus}
      renderItem={(approval) => {
        const requester =
          typeof approval.requestedBy === 'object' ? approval.requestedBy?.name : undefined;
        const current = approval.currentStep;
        return (
          <RowCard
            icon={
              approval.entityType === 'purchase_order'
                ? 'cart-outline'
                : approval.entityType === 'booking'
                  ? 'file-tray-full-outline'
                  : 'cash-outline'
            }
            iconBg={approval.canAct ? colors.warningSoft : colors.surfaceAlt}
            iconColor={approval.canAct ? colors.warning : colors.textFaint}
            title={approval.title}
            subtitle={[
              requester ? `by ${requester}` : undefined,
              approval.amount != null ? formatCompactINR(approval.amount) : undefined,
              current
                ? `Waiting on ${String(current.label ?? current.role).replace(/_/g, ' ')}`
                : approval.status.replace(/_/g, ' '),
              relativeTime((approval as any).createdAt),
            ]
              .filter(Boolean)
              .join(' · ')}
            right={
              approval.canAct && !acting ? (
                <Badge label="ACT" tone="warning" dot />
              ) : (
                <Badge
                  label={approval.status.replace(/_/g, ' ')}
                  tone={APPROVAL_STATUS_TONES[approval.status as ApprovalStatus]}
                />
              )
            }
            onPress={approval.canAct ? () => confirmAct(approval) : undefined}
          />
        );
      }}
      emptyTitle="Nothing to approve"
      emptyMessage="Requests waiting on you or your team appear here."
    />
  );
}



