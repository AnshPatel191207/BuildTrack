import React, { useCallback, useMemo, useState } from 'react';
import {
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
import { Button } from '@/components/ui/Button';
import { DatePickerSheet } from '@/components/ui/DatePickerSheet';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import { workerService } from '@/services/workerService';
import { projectService } from '@/services/projectService';
import {
  bulkMarkAttendance,
  getAttendanceForDate,
  type AttendanceEntryInput,
} from '@/services/attendanceService';
import { useLocation } from '@/hooks/useLocation';
import { haversineMeters, formatDistance } from '@/lib/geo';
import type { AttendanceStatus, Worker } from '@/types';
import {
  addDaysISO,
  formatDate,
  formatINR,
  todayISO,
} from '@/lib/format';

const STATUS_CYCLE: AttendanceStatus[] = ['present', 'absent', 'half_day', 'leave'];
const SHORT_LABEL: Record<AttendanceStatus, string> = {
  present: 'P',
  absent: 'A',
  half_day: 'H',
  leave: 'L',
};

interface RowState {
  status: AttendanceStatus | null;
}

export default function AttendanceScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const workersVersion = useDataVersionKey(DATA_KEYS.workers);
  const { id } = useLocalSearchParams<{ id: string }>();
  const initialDate = useLocalSearchParams<{ date?: string }>().date;
  const { colors, spacing, radius } = theme;

  const [date, setDate] = useState<string>(initialDate || todayISO());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [geoWarning, setGeoWarning] = useState<{ distanceM: number } | null>(null);

  const { locateNow } = useLocation();
  const projectRes = useResource(() => projectService.getProject(id!), [id]);
  const project = projectRes.data;
  const siteGeo =
    project?.latitude != null && project?.longitude != null
      ? {
          latitude: project.latitude,
          longitude: project.longitude,
          radius: project.siteRadiusMeters ?? 100,
        }
      : null;

  const fetchDay = useCallback(async () => {
    const [workersRes, records] = await Promise.all([
      workerService.listWorkers({ projectId: id }),
      getAttendanceForDate(id!, date),
    ]);
    const workers = workersRes.items;
    // Seed local row state from server records.
    const seeded: Record<string, RowState> = {};
    for (const w of workers) seeded[w._id] = { status: null };
    for (const r of records) {
      const wid = typeof r.workerId === 'object' ? r.workerId._id : r.workerId;
      if (seeded[wid]) seeded[wid] = { status: r.status };
    }
    setRows(seeded);
    setDirty(false);
    return { workers, records };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, date, workersVersion]);

  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource(fetchDay, [fetchDay]);

  const workers = data?.workers ?? [];

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = { present: 0, absent: 0, half_day: 0, leave: 0 };
    let unmarked = 0;
    for (const w of workers) {
      const st = rows[w._id]?.status;
      if (st) counts[st] += 1;
      else unmarked += 1;
    }
    return { ...counts, unmarked };
  }, [workers, rows]);

  const estimatedCost = useMemo(() => {
    return workers.reduce((sum, w) => {
      const st = rows[w._id]?.status;
      if (st === 'present') return sum + (Number(w.dailyWage) || 0);
      if (st === 'half_day') return sum + (Number(w.dailyWage) || 0) / 2;
      return sum;
    }, 0);
  }, [workers, rows]);

  const cycleStatus = (workerId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDirty(true);
    setRows((prev) => {
      const current = prev[workerId]?.status ?? null;
      const next =
        current == null
          ? STATUS_CYCLE[0]
          : STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
      return { ...prev, [workerId]: { status: next } };
    });
  };

  const saveAll = async (options?: { skipGeo?: boolean }) => {
    const entries: AttendanceEntryInput[] = [];
    for (const w of workers) {
      const st = rows[w._id]?.status;
      if (st) entries.push({ workerId: w._id, status: st });
    }
    if (entries.length === 0) {
      showToast('Tap a worker to mark them first', 'info');
      return;
    }

    // Geofenced check-in: attach GPS to present/half-day marks and verify
    // against the project site radius before sending.
    let geo: AttendanceEntryInput['geo'];
    if (!options?.skipGeo && siteGeo) {
      const fix = await locateNow();
      if (fix) {
        const distanceM = Math.round(
          haversineMeters(
            { latitude: siteGeo.latitude, longitude: siteGeo.longitude },
            { latitude: fix.latitude, longitude: fix.longitude },
          ),
        );
        if (distanceM > siteGeo.radius) {
          setSaving(false);
          setGeoWarning({ distanceM });
          return;
        }
        geo = { latitude: fix.latitude, longitude: fix.longitude, distanceMeters: distanceM };
      }
    }

    const withGeo = entries.map((e) =>
      geo && (e.status === 'present' || e.status === 'half_day') ? { ...e, geo } : e,
    );

    setSaving(true);
    try {
      const result = await bulkMarkAttendance(id!, date, withGeo);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(
        `Saved — ${result.created} new, ${result.updated} updated · est. ${formatINR(estimatedCost)} labor`,
      );
      setDirty(false);
      void reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save attendance', 'error');
    } finally {
      setSaving(false);
    }
  };

  const isToday = date === todayISO();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Attendance"
        subtitle={formatDate(date)}
        onBack={() => router.back()}
        right={
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setDate((d) => addDaysISO(d, -1))}
              accessibilityLabel="Previous day"
              style={dayNavBtn(colors.surfaceAlt)}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityLabel="Pick date"
              style={[dayNavBtn(colors.surfaceAlt), { paddingHorizontal: 10 }]}
            >
              <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: '700' }}>
                {isToday ? 'Today' : 'Date'}
              </Text>
            </Pressable>
            {!isToday ? (
              <Pressable
                onPress={() => setDate(todayISO())}
                accessibilityLabel="Jump to today"
                style={[dayNavBtn(colors.primaryMuted), { paddingHorizontal: 10 }]}
              >
                <Ionicons name="today-outline" size={17} color={colors.primary} />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setDate((d) => addDaysISO(d, 1))}
                disabled={isToday}
                accessibilityLabel="Next day"
                style={[dayNavBtn(colors.surfaceAlt), { opacity: isToday ? 0.4 : 1 }]}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.text} />
              </Pressable>
            )}
          </View>
        }
      />
      <OfflineBanner />

      {/* Summary strip */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={styles.summaryRow}>
          <SummaryChip label="Present" value={summary.present} color={colors.success} bg={colors.successSoft} />
          <SummaryChip label="Absent" value={summary.absent} color={colors.danger} bg={colors.dangerSoft} />
          <SummaryChip label="Half" value={summary.half_day} color={colors.warning} bg={colors.warningSoft} />
          <SummaryChip label="Leave" value={summary.leave} color={colors.info} bg={colors.infoSoft} />
          <SummaryChip label="Unmarked" value={summary.unmarked} color={colors.textMuted} bg={colors.surfaceAlt} />
        </View>
        {summary.present + summary.half_day > 0 ? (
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 6 }}>
            Estimated labor cost: {formatINR(estimatedCost)}
          </Text>
        ) : null}
        {siteGeo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Ionicons
              name="navigate-outline"
              size={13}
              color={geoWarning ? colors.warning : colors.primary}
            />
            <Text style={{ color: colors.textFaint, fontSize: 11.5, flex: 1 }}>
              GPS check-in on · site radius {formatDistance(siteGeo.radius)}
              {saving ? ' · locating…' : ''}
            </Text>
          </View>
        ) : (
          <Text style={{ color: colors.textFaint, fontSize: 11.5, marginTop: 6 }}>
            Pin the site location to enable GPS-verified attendance.
          </Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 130 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {loading && !data ? (
          <View style={{ paddingTop: 8, gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} height={62} style={{ borderRadius: radius.md }} />
            ))}
          </View>
        ) : error && !data ? (
          <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
        ) : workers.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No workers on this site"
            message="Add workers to start marking daily attendance."
            actionLabel="Add worker"
            onAction={() => router.push('/modal/worker')}
          />
        ) : (
          <View style={{ marginTop: 12, gap: 9 }}>
            {workers.map((w) => (
              <WorkerRow key={w._id} worker={w} state={rows[w._id]?.status ?? null} onTap={() => cycleStatus(w._id)} />
            ))}
            <Text style={{ color: colors.textFaint, fontSize: 11.5, textAlign: 'center', marginTop: 4 }}>
              Tap a worker to cycle: Present → Absent → Half day → Leave
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Save bar */}
      {(dirty || !loading) && (
        <View
          style={[
            styles.saveBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 14),
              paddingHorizontal: spacing.lg,
              paddingTop: 12,
            },
          ]}
        >
          <Button
            label={saving ? 'Saving…' : `Save attendance (${Object.values(rows).filter((r) => r.status).length})`}
            loading={saving}
            onPress={() => void saveAll()}
            size="lg"
          />
        </View>
      )}

      <DatePickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={date}
        onChange={(iso) => setDate(iso)}
        title="Attendance date"
        maxDate={todayISO()}
      />

      {/* Off-site warning — supervisor can still save without GPS proof. */}
      <ConfirmDialog
        visible={geoWarning != null}
        title="You seem to be off-site"
        message={
          geoWarning
            ? `Your current location is ${formatDistance(geoWarning.distanceM)} from the pinned site (limit ${formatDistance(siteGeo?.radius ?? 100)}). Attendance will be saved without location verification.`
            : ''
        }
        confirmLabel="Save anyway"
        tone="warning"
        onCancel={() => setGeoWarning(null)}
        onConfirm={() => {
          setGeoWarning(null);
          void saveAll({ skipGeo: true });
        }}
      />
    </View>
  );
}

function dayNavBtn(bg: string): object {
  return {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: bg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
}

function SummaryChip({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 10, alignItems: 'center', paddingVertical: 9 }}>
      <Text style={{ color, fontSize: 16, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
    </View>
  );
}

function WorkerRow({
  worker,
  state,
  onTap,
}: {
  worker: Worker;
  state: AttendanceStatus | null;
  onTap: () => void;
}) {
  const { colors, radius } = useTheme();

  const toneBg =
    state === 'present'
      ? colors.successSoft
      : state === 'absent'
        ? colors.dangerSoft
        : state === 'half_day'
          ? colors.warningSoft
          : state === 'leave'
            ? colors.infoSoft
            : colors.surfaceAlt;

  const toneFg =
    state === 'present'
      ? colors.success
      : state === 'absent'
        ? colors.danger
        : state === 'half_day'
          ? colors.warning
          : state === 'leave'
            ? colors.info
            : colors.textMuted;

  return (
    <Pressable
      onPress={onTap}
      accessibilityRole="button"
      accessibilityLabel={`${worker.name}, mark attendance`}
      accessibilityValue={{ text: state ? state.replace('_', ' ') : 'not marked' }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: 11,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Avatar name={worker.name} size={40} tone={state === 'present' ? 'success' : 'navy'} />
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: '700' }}>
          {worker.name}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12, textTransform: 'capitalize' }}>
          {worker.workerType.replace('_', ' ')} · {formatINR(worker.dailyWage)}/day
        </Text>
      </View>
      <View
        style={{
          minWidth: 74,
          alignItems: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: toneBg,
            borderRadius: radius.sm,
            paddingHorizontal: 12,
            paddingVertical: 7,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Text style={{ color: toneFg, fontWeight: '800', fontSize: 13 }}>
            {state ? SHORT_LABEL[state] : '—'}
          </Text>
          <Text style={{ color: toneFg, fontWeight: '700', fontSize: 11, textTransform: 'uppercase' }}>
            {state ? state.replace('_', ' ') : 'tap'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
