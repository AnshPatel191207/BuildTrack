import React, { useCallback, useMemo, useState } from 'react';
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
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import { taskService } from '@/services/projectDataService';
import { TASK_STATUS_TONES, PRIORITY_TONES } from '@/constants/status';
import type { Task, TaskStatus } from '@/types';
import { daysUntil, formatDate } from '@/lib/format';

const SECTIONS: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'completed', label: 'Completed' },
];

export default function TasksScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const tasksVersion = useDataVersionKey(DATA_KEYS.tasks);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const fetcher = useCallback(
    () => taskService.listTasks(id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, tasksVersion],
  );
  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource(fetcher, [fetcher]);

  const [selected, setSelected] = useState<Task | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>(SECTIONS.map((s) => [s.key, []]));
    for (const t of data ?? []) map.get(t.status)?.push(t);
    // Overdue first inside each group.
    for (const [, list] of map) {
      list.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
    }
    return map;
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const [k, list] of grouped) c[k] = list.length;
    return c;
  }, [grouped]);

  const cycleStatus = async (task: Task) => {
    const order: TaskStatus[] = ['todo', 'in_progress', 'completed'];
    if (task.status === 'blocked') return; // blocked requires explicit action via edit
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      await taskService.updateTask(task._id, { status: next });
      void reload();
      if (next === 'completed') {
        showToast('Task completed');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update task', 'error');
    }
  };

  const markBlocked = async (task: Task) => {
    try {
      await taskService.updateTask(task._id, {
        status: task.status === 'blocked' ? 'in_progress' : 'blocked',
      });
      void reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update task', 'error');
    }
  };

  const deleteTask = (task: Task) => {
    Alert.alert(`Delete "${task.title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          taskService
            .deleteTask(task._id)
            .then(() => {
              setSelected(null);
              showToast('Task deleted');
              void reload();
            })
            .catch((err) =>
              showToast(err instanceof Error ? err.message : 'Could not delete task', 'error'),
            );
        },
      },
    ]);
  };

  const totalOpen = (counts.todo ?? 0) + (counts.in_progress ?? 0) + (counts.blocked ?? 0);
  const donePct = data && data.length > 0 ? (counts.completed ?? 0) / data.length : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Tasks"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push({ pathname: '/modal/task', params: { projectId: id } })}
            accessibilityRole="button"
            accessibilityLabel="Add task"
            hitSlop={6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              paddingHorizontal: 13,
              paddingVertical: 8,
            }}
          >
            <Ionicons name="add" size={17} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 13.5 }}>Add</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      {/* Progress strip */}
      <View style={{ paddingHorizontal: spacing.lg }}>
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: '600' }}>
              {totalOpen} open · {counts.completed ?? 0} done
            </Text>
            <Text style={{ color: colors.text, fontSize: 12.5, fontWeight: '800' }}>
              {Math.round(donePct * 100)}%
            </Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
            <View
              style={{
                width: `${Math.round(donePct * 100)}%`,
                height: '100%',
                borderRadius: 3,
                backgroundColor: colors.success,
              }}
            />
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {loading && !data ? (
          <View style={{ paddingTop: 12, gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={64} style={{ borderRadius: radius.md }} />
            ))}
          </View>
        ) : error && !data ? (
          <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon="checkbox-outline"
            title="No tasks yet"
            message="Break the site work into trackable tasks."
            actionLabel="Add task"
            onAction={() => router.push({ pathname: '/modal/task', params: { projectId: id } })}
          />
        ) : (
          SECTIONS.map((section) => {
            const list = grouped.get(section.key)!;
            if (list.length === 0 && section.key !== 'todo') return null;
            return (
              <View key={section.key} style={{ marginTop: 18 }}>
                <Text style={{ color: colors.textMuted, fontSize: 12.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  {section.label} ({list.length})
                </Text>
                {list.length === 0 ? (
                  <Text style={{ color: colors.textFaint, fontSize: 13 }}>Nothing here.</Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    {list.map((t) => (
                      <TaskRow
                        key={t._id}
                        task={t}
                        onTap={() => void cycleStatus(t)}
                        onLongPress={() => setSelected(t)}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
        {!loading && data && data.length > 0 ? (
          <Text style={{ color: colors.textFaint, fontSize: 11.5, textAlign: 'center', marginTop: 16 }}>
            Tap to advance status · long-press for options
          </Text>
        ) : null}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => router.push({ pathname: '/modal/task', params: { projectId: id } })}
        accessibilityRole="button"
        accessibilityLabel="Add task"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 8,
        })}
      >
        <Ionicons name="add" size={28} color={colors.onPrimary} />
      </Pressable>

      {/* Task options sheet */}
      <BottomSheet visible={selected != null} onClose={() => setSelected(null)} title={selected?.title}>
        {selected ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
            {selected.description ? (
              <Text style={{ color: colors.textMuted, fontSize: 13.5, lineHeight: 19 }}>{selected.description}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <Badge label={`Priority: ${selected.priority}`} tone={PRIORITY_TONES[selected.priority]} />
              <Badge label={selected.status.replace('_', ' ')} tone={TASK_STATUS_TONES[selected.status]} />
              {selected.dueDate ? <Badge label={`Due ${formatDate(selected.dueDate)}`} tone="neutral" /> : null}
            </View>
            <Button
              label={selected.status === 'blocked' ? 'Unblock task' : 'Mark as blocked'}
              variant="secondary"
              onPress={() => {
                void markBlocked(selected);
                setSelected(null);
              }}
            />
            <Button
              label="Edit task"
              variant="secondary"
              onPress={() => {
                const tid = selected._id;
                setSelected(null);
                router.push({ pathname: '/modal/task', params: { projectId: id!, id: tid } });
              }}
            />
            <Button label="Delete task" variant="danger" onPress={() => deleteTask(selected)} />
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
}

function TaskRow({
  task,
  onTap,
  onLongPress,
}: {
  task: Task;
  onTap: () => void;
  onLongPress?: () => void;
}) {
  const { colors, radius } = useTheme();
  const overdue =
    task.status !== 'completed' && task.dueDate != null && (daysUntil(task.dueDate) ?? 0) < 0;
  const isDone = task.status === 'completed';

  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`Task ${task.title}, ${task.status}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: overdue ? colors.warningSoft : colors.border,
        padding: 13,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 2,
          borderColor: isDone ? colors.success : overdue ? colors.warning : colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDone ? colors.successSoft : 'transparent',
        }}
      >
        {isDone ? <Ionicons name="checkmark" size={15} color={colors.success} /> : null}
      </View>
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Text
          numberOfLines={2}
          style={{
            color: isDone ? colors.textFaint : colors.text,
            fontSize: 14,
            fontWeight: '600',
            textDecorationLine: isDone ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, flexWrap: 'wrap' }}>
          {task.assignedTo ? (
            <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12, flexShrink: 1 }}>
              {task.assignedTo.name}
            </Text>
          ) : null}
          {task.dueDate ? (
            <Text style={{ color: overdue ? colors.warning : colors.textFaint, fontSize: 12, fontWeight: overdue ? '700' : '400' }}>
              Due {formatDate(task.dueDate)}
            </Text>
          ) : null}
          {task.status === 'blocked' ? <Badge label="Blocked" tone="danger" /> : null}
        </View>
      </View>
      <Badge label={task.priority} tone={PRIORITY_TONES[task.priority]} />
    </Pressable>
  );
}
