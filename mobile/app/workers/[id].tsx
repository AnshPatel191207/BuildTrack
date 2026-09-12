import React from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import { workerService } from '@/services/workerService';
import { ATTENDANCE_TONES } from '@/constants/status';
import { formatDate, formatINR, toISODateString } from '@/lib/format';

export default function WorkerDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const workersVersion = useDataVersionKey(DATA_KEYS.workers);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const fetcher = React.useCallback(() => workerService.getWorker(id!), [id, workersVersion]);
  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource(fetcher, [fetcher]);

  if (!id) return null;

  if (loading && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="" onBack={() => router.back()} />
        <View style={{ paddingHorizontal: spacing.lg, gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={80} style={{ borderRadius: radius.md }} />
          ))}
        </View>
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Worker" onBack={() => router.back()} />
        <View style={{ padding: spacing.lg }}>
          <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
        </View>
      </View>
    );
  }

  if (!data) return null;
  const { worker, attendanceHistory, thisMonth } = data;

  const callWorker = async () => {
    if (!worker.phone) return;
    try {
      const { Linking } = await import('react-native');
      await Linking.openURL(`tel:${worker.phone.replace(/\s+/g, '')}`);
    } catch {
      showToast('Could not open the dialer', 'error');
    }
  };

  /** Saves the worker into the device phonebook (permission asked on tap only). */
  const saveToContacts = async () => {
    try {
      const [{ default: Contacts }, { ensurePermission }] = await Promise.all([
        import('expo-contacts'),
        import('@/lib/permissions'),
      ]);
      const result = await ensurePermission('contacts');
      if (!result.granted) {
        showToast('Contacts permission needed to save', 'info');
        return;
      }
      await Contacts.addContactAsync({
        [Contacts.Fields.FirstName]: worker.name.split(' ')[0] ?? worker.name,
        ...(worker.name.includes(' ')
          ? { [Contacts.Fields.LastName]: worker.name.split(' ').slice(1).join(' ') }
          : {}),
        ...(worker.phone
          ? { [Contacts.Fields.PhoneNumbers]: [{ label: 'mobile', number: worker.phone }] }
          : {}),
        ...(typeof worker.projectId === 'object' && worker.projectId
          ? { [Contacts.Fields.Company]: worker.projectId.name }
          : {}),
      } as any);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`${worker.name} saved to contacts`);
    } catch {
      showToast('Could not save to contacts', 'error');
    }
  };

  const confirmDelete = () => {
    Alert.alert(`Remove ${worker.name}?`, 'Their attendance history stays on record.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          workerService
            .deleteWorker(worker._id)
            .then(() => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              showToast(`${worker.name} removed`);
              router.back();
            })
            .catch((err) =>
              showToast(err instanceof Error ? err.message : 'Could not remove worker', 'error'),
            );
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={worker.name}
        onBack={() => router.back()}
        right={
          <>
            <Pressable
              onPress={() => router.push({ pathname: '/modal/worker', params: { id: worker._id } })}
              accessibilityLabel="Edit worker"
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 8,
              }}
            >
              <Ionicons name="create-outline" size={18} color={colors.text} />
            </Pressable>
            {worker.status !== 'terminated' ? (
              <Pressable
                onPress={confirmDelete}
                accessibilityLabel="Remove worker"
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.dangerSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="trash-outline" size={17} color={colors.danger} />
              </Pressable>
            ) : null}
          </>
        }
      />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {/* Identity */}
        <Card style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm }} padded>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={worker.name} size={56} tone={worker.status === 'active' ? 'navy' : 'muted'} />
            <View style={{ flex: 1, marginLeft: 13 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{worker.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 2, textTransform: 'capitalize' }}>
                {[worker.workerType.replace('_', ' '), worker.skill].filter(Boolean).join(' · ')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 7 }}>
                <Badge
                  label={worker.status[0].toUpperCase() + worker.status.slice(1)}
                  tone={worker.status === 'active' ? 'success' : worker.status === 'inactive' ? 'warning' : 'danger'}
                />
                {typeof worker.projectId === 'object' && worker.projectId ? (
                  <Badge label={worker.projectId.name} tone="info" />
                ) : null}
              </View>
            </View>
          </View>

          <View style={[styles.metaGrid, {}]}>
            <MetaTile icon="cash-outline" label="Daily wage" value={formatINR(worker.dailyWage)} />
            <MetaTile icon="call-outline" label="Phone" value={worker.phone || '—'} />
            <MetaTile icon="calendar-outline" label="Joined" value={formatDate(worker.joiningDate)} />
          </View>

          {(worker.phone || worker.name) && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              {worker.phone ? (
                <Button label="Call" variant="secondary" size="sm" onPress={() => void callWorker()} style={{ flex: 1 }} />
              ) : null}
              <Button label="Save to contacts" size="sm" onPress={() => void saveToContacts()} style={{ flex: 1 }} />
            </View>
          )}
        </Card>

        {/* This month */}
        <SectionTitle text="This month" />
        <Card style={{ marginHorizontal: spacing.lg }} padded>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <MonthStat label="Present" value={thisMonth.present} color={colors.success} />
            <MonthStat label="Half day" value={thisMonth.halfDay} color={colors.warning} />
            <MonthStat label="Absent" value={thisMonth.absent} color={colors.danger} />
            <MonthStat label="Leave" value={thisMonth.leave} color={colors.info} />
          </View>
          <View
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Estimated payout so far</Text>
            <Text style={{ color: colors.primary, fontSize: 17, fontWeight: '800' }}>
              {formatINR(thisMonth.estimatedSalary)}
            </Text>
          </View>
          <Text style={{ color: colors.textFaint, fontSize: 11.5, marginTop: 4 }}>
            Present days × daily wage + half days × 50%
          </Text>
        </Card>

        {/* Attendance history */}
        <SectionTitle text="Recent attendance" />
        <Card style={{ marginHorizontal: spacing.lg }} padded>
          {attendanceHistory.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 13.5, textAlign: 'center', paddingVertical: 10 }}>
              No attendance marked yet.
            </Text>
          ) : (
            <View style={{ gap: 9 }}>
              {attendanceHistory.slice(0, 12).map((a) => (
                <View key={a._id} style={styles.attRow}>
                  <Text style={{ color: colors.text, fontSize: 13.5, flex: 1 }}>{formatDate(a.date)}</Text>
                  {a.checkIn ? (
                    <Text style={{ color: colors.textFaint, fontSize: 12, marginRight: 8 }}>
                      {a.checkIn.slice(11, 16)}
                      {a.checkOut ? `–${a.checkOut.slice(11, 16)}` : ''}
                    </Text>
                  ) : null}
                  <Badge
                    label={a.status.replace('_', ' ')}
                    tone={ATTENDANCE_TONES[a.status]}
                  />
                </View>
              ))}
            </View>
          )}
        </Card>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: 20 }}>
          <Button
            label="Mark attendance for today"
            variant="secondary"
            onPress={() => {
              if (typeof worker.projectId === 'object' && worker.projectId) {
                router.push({
                  pathname: `/project/${worker.projectId._id}/attendance`,
                  params: { date: toISODateString(new Date()) },
                });
              } else {
                showToast('Assign this worker to a project first', 'info');
              }
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function MetaTile({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 10 }}>
      <Ionicons name={icon} size={15} color={colors.textFaint} />
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 12.5, fontWeight: '700', marginTop: 6 }}>
        {value}
      </Text>
      <Text style={{ color: colors.textFaint, fontSize: 10.5 }}>{label}</Text>
    </View>
  );
}

function MonthStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontSize: 19, fontWeight: '800' }}>{value}</Text>
      <LabelText label={label} />
    </View>
  );
}

function LabelText({ label }: { label: string }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>{label}</Text>;
}

function SectionTitle({ text }: { text: string }) {
  const { colors, spacing } = useTheme();
  return (
    <Text
      style={{
        color: colors.text,
        fontSize: 15.5,
        fontWeight: '800',
        paddingHorizontal: spacing.lg,
        marginTop: 22,
        marginBottom: 10,
        letterSpacing: -0.2,
      }}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  metaGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  attRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
