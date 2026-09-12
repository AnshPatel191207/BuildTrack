import React, { useCallback } from 'react';
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
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useDataVersionKey, DATA_KEYS } from '@/stores/dataVersion';
import { reportService } from '@/services/projectDataService';
import type { DailyReport } from '@/types';
import { formatDate } from '@/lib/format';

const WEATHER_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  sunny: 'sunny-outline',
  cloudy: 'cloud-outline',
  rainy: 'rainy-outline',
  humid: 'water-outline',
  windy: 'leaf-outline',
  other: 'partly-sunny-outline',
};

export default function ReportsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reportsVersion = useDataVersionKey(DATA_KEYS.reports);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing, radius } = theme;

  const fetcher = useCallback(
    () => reportService.listReports(id, { limit: 30 }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, reportsVersion],
  );
  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource(fetcher, [fetcher]);

  const reports = data?.items ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Daily reports"
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => router.push({ pathname: '/modal/report', params: { projectId: id } })}
            accessibilityRole="button"
            accessibilityLabel="New report"
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
            <Text style={{ color: colors.onPrimary, fontWeight: '700', fontSize: 13.5 }}>New</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {loading && !data ? (
          <View style={{ paddingTop: 12, gap: 12 }}>
            {[0, 1].map((i) => (
              <Skeleton key={i} height={170} style={{ borderRadius: radius.lg }} />
            ))}
          </View>
        ) : error && !data ? (
          <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title="No daily reports yet"
            message="End each day with a short site summary — weather, work done and tomorrow's plan."
            actionLabel="Write first report"
            onAction={() => router.push({ pathname: '/modal/report', params: { projectId: id } })}
          />
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            {reports.map((r) => (
              <ReportCard key={r._id} report={r} />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push({ pathname: '/modal/report', params: { projectId: id } })}
        accessibilityRole="button"
        accessibilityLabel="New report"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 20,
          height: 48,
          paddingHorizontal: 18,
          borderRadius: 24,
          backgroundColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 8,
        })}
      >
        <Ionicons name="create" size={19} color={colors.onPrimary} />
        <Text style={{ color: colors.onPrimary, fontWeight: '800', fontSize: 14.5 }}>Today's report</Text>
      </Pressable>
    </View>
  );
}

function ReportCard({ report }: { report: DailyReport }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Card padded style={{ borderRadius: radius.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: colors.primaryMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={WEATHER_ICON[report.weather] ?? 'partly-sunny-outline'} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: 11 }}>
          <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '800' }}>
            {formatDate(report.date)}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
            {report.weather} · {report.workersPresent} workers present
            {typeof report.createdBy === 'object' && report.createdBy ? ` · ${report.createdBy.name}` : ''}
          </Text>
        </View>
        {report.photos.length > 0 || report.videos?.length ? (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {report.photos.length > 0 ? (
              <Badge
                label={`${report.photos.length} ${report.photos.length === 1 ? 'photo' : 'photos'}`}
                tone="info"
              />
            ) : null}
            {report.videos?.length ? (
              <Badge label={`${report.videos.length} video${report.videos.length === 1 ? '' : 's'}`} tone="orange" />
            ) : null}
          </View>
        ) : null}
      </View>

      <SectionBlock label="Work completed" text={report.workCompleted} />
      {report.summary ? <SectionBlock label="Summary" text={report.summary} /> : null}
      {report.materialsUsed ? <SectionBlock label="Materials used" text={report.materialsUsed} /> : null}
      {report.issues ? (
        <View style={[styles.block, { backgroundColor: colors.dangerSoft }]}>
          <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Issues / delays
          </Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, marginTop: 3 }}>{report.issues}</Text>
        </View>
      ) : null}
      {report.safetyNotes ? (
        <View style={[styles.block, { backgroundColor: colors.warningSoft }]}>
          <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Safety notes
          </Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, marginTop: 3 }}>{report.safetyNotes}</Text>
        </View>
      ) : null}
      {report.tomorrowPlan ? <SectionBlock label="Tomorrow's plan" text={report.tomorrowPlan} /> : null}
    </Card>
  );
}

function SectionBlock({ label, text }: { label: string; text?: string }) {
  if (!text) return null;
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.text, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 9,
    padding: 10,
    marginTop: 8,
  },
  section: {
    marginTop: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  text: {
    fontSize: 13.5,
    lineHeight: 19,
  },
});
