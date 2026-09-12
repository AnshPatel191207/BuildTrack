import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import { notificationService } from '@/services/notificationService';
import type { AppNotification } from '@/types';
import { relativeTime } from '@/lib/format';

const TYPE_ICONS: Record<AppNotification['type'], keyof typeof Ionicons.glyphMap> = {
  low_stock: 'cube-outline',
  overdue_task: 'alarm-outline',
  expense: 'cash-outline',
  attendance: 'people-outline',
  milestone: 'flag-outline',
  report_reminder: 'document-text-outline',
  general: 'notifications-outline',
  payment_overdue: 'hand-left-outline',
  milestone_delay: 'alert-circle-outline',
  contractor_bill: 'hammer-outline',
  purchase_approval: 'cart-outline',
  expense_approval: 'checkmark-done-outline',
  new_booking: 'file-tray-full-outline',
  pending_task: 'checkbox-outline',
  document_expiry: 'folder-open-outline',
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setUnread = useUIStore((s) => s.setUnread);
  const showToast = useUIStore((s) => s.showToast);
  const notifVersion = useDataVersionKey(DATA_KEYS.notifications);
  const { colors, spacing, radius } = theme;
  const [markingAll, setMarkingAll] = useState(false);

  const fetcher = useCallback(async () => {
    const res = await notificationService.listNotifications();
    return res.items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifVersion]);

  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource(fetcher, [notifVersion]);

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  React.useEffect(() => {
    setUnread(unreadCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  const markRead = async (n: AppNotification) => {
    if (n.isRead) return;
    try {
      await notificationService.markNotificationRead(n._id);
      void reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update notification', 'error');
    }
  };

  const markAll = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await notificationService.markAllNotificationsRead();
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not mark all read', 'error');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Notifications"
        onBack={() => router.back()}
        right={
          unreadCount > 0 ? (
            <Button label="Mark all read" variant="ghost" size="sm" loading={markingAll} onPress={() => void markAll()} />
          ) : undefined
        }
      />
      <FlatList
        data={notifications}
        keyExtractor={(n) => n._id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={70} style={{ borderRadius: radius.md }} />
              ))}
            </View>
          ) : error && !data ? (
            <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
          ) : (
            <EmptyState
              icon="notifications-off-outline"
              title="You're all caught up"
              message="Low stock alerts and task reminders will appear here."
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              void markRead(item);
              if (item.relatedProjectId && typeof item.relatedProjectId === 'object') {
                router.push(`/project/${item.relatedProjectId._id}`);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.message}`}
            style={{
              flexDirection: 'row',
              backgroundColor: item.isRead ? colors.surface : colors.primaryMuted,
              borderRadius: radius.md,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              padding: 13,
              marginBottom: 8,
              gap: 11,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={TYPE_ICONS[item.type] ?? 'notifications-outline'} size={17} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14, fontWeight: item.isRead ? '600' : '800' }}>
                {item.title}
              </Text>
              <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: 12.5, marginTop: 2, lineHeight: 17 }}>
                {item.message}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 11, marginTop: 4 }}>
                {relativeTime(item.createdAt)}
                {!item.isRead ? ' · new' : ''}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
