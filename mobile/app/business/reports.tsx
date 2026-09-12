import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Button } from '@/components/ui/Button';
import { SelectField } from '@/components/ui/SelectField';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useResource } from '@/hooks/useResource';
import { useTheme } from '@/hooks/useTheme';
import { projectService } from '@/services/projectService';
import { reportService } from '@/services/erpService';
import { REPORT_TYPE_OPTIONS } from '@/constants/options';
import { formatCompactINR } from '@/lib/format';

export default function ReportsScreen() {
  const theme = useTheme();
  const { colors, spacing } = theme;
  const [type, setType] = useState('project');
  const [projectId, setProjectId] = useState('');

  const projectsRes = useResource(() => projectService.listProjects({}), []);
  const projectOptions = useMemo(
    () => [
      { label: 'All projects', value: '' },
      ...(projectsRes.data?.items ?? []).map((p) => ({ label: p.name, value: p._id })),
    ],
    [projectsRes.data],
  );

  const reportRes = useResource(
    () => reportService.generate(type, { projectId: projectId || null }),
    [type, projectId],
  );

  const report = reportRes.data;
  void Share;

  const summaryRows = useMemo(() => {
    if (!report) return [];
    const out: { label: string; value: string }[] = [];
    if (report.rows) {
      out.push({ label: 'Entries', value: String(report.rows.length) });
    }
    for (const [key, value] of Object.entries(report.totals ?? {})) {
      if (typeof value === 'number') {
        const isMoney =
          /budget|spent|amount|value|wages|paid|collected|inventory/i.test(key);
        out.push({
          label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
          value: isMoney ? formatCompactINR(value) : String(value),
        });
      }
    }
    return out;
  }, [report]);

  const firstRows = (report?.rows ?? []).slice(0, 30) as any[];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Reports" subtitle="Generate on-demand report packs" large />
      <OfflineBanner />
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 60 }}>
        <SelectField
          label="Report type"
          options={[...REPORT_TYPE_OPTIONS]}
          value={type}
          onChange={setType}
        />
        <SelectField
          label="Project"
          options={projectOptions}
          value={projectId}
          onChange={setProjectId}
          placeholder="All projects"
        />

        {reportRes.loading && !report ? (
          <Skeleton height={180} style={{ borderRadius: 14, marginTop: spacing.md }} />
        ) : reportRes.error && !report ? (
          <ErrorState
            message={reportRes.error}
            offline={reportRes.offlineData}
            onRetry={() => void reportRes.reload()}
          />
        ) : report ? (
          <View style={{ marginTop: spacing.md }}>
            <View
              style={{
                backgroundColor: colors.navy,
                borderRadius: 14,
                padding: spacing.md,
              }}
            >
              <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' }}>
                {REPORT_TYPE_OPTIONS.find((r) => r.value === type)?.label}
              </Text>
              {summaryRows.map((row) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    marginTop: 6,
                  }}
                >
                  <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{row.label}</Text>
                  <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>

            <Button
              label="Share as text"
              variant="secondary"
              icon="share-outline"
              style={{ marginTop: spacing.md }}
              onPress={() => {
                const lines: string[] = [];
                lines.push(`${REPORT_TYPE_OPTIONS.find((r) => r.value === type)?.label} — BuildTrack`);
                for (const row of summaryRows) lines.push(`${row.label}: ${row.value}`);
                lines.push('');
                for (const row of firstRows.slice(0, 15)) {
                  lines.push(`• ${row.name ?? row.title ?? row.workerName ?? row.bookingNumber ?? row.contractorName ?? row.unitNumber ?? row._id}`);
                }
                void Share.share({ message: lines.join('\n') });
              }}
            />

            {firstRows.length > 0 ? (
              <View style={{ marginTop: spacing.md, gap: 8 }}>
                {firstRows.map((row, index) => (
                  <View
                    key={String(row._id ?? index)}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 12,
                    }}
                  >
                    <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 13.5 }}>
                      {row.name ??
                        row.title ??
                        row.workerName ??
                        row.bookingNumber ??
                        row.contractorName ??
                        row.unitNumber ??
                        `${row.stage ?? ''} ${row.projectName ? `· ${row.projectName}` : ''}`}
                    </Text>
                    <Text numberOfLines={2} style={{ color: colors.textFaint, fontSize: 12, marginTop: 3 }}>
                      {Object.entries(row)
                        .filter(([k, v]) =>
                          typeof v === 'number' || typeof v === 'string'
                            ? !['_id', '__v'].includes(k)
                            : false,
                        )
                        .slice(0, 5)
                        .map(
                          ([k, v]) =>
                            `${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${
                              typeof v === 'number' && v > 9999 ? formatCompactINR(v) : v
                            }`,
                        )
                        .join(' · ')}
                    </Text>
                  </View>
                ))}
                {(report.rows?.length ?? 0) > 30 ? (
                  <Text style={{ color: colors.textFaint, fontSize: 12, textAlign: 'center' }}>
                    Showing first 30 of {report.rows!.length} rows.
                  </Text>
                ) : null}
              </View>
            ) : (
              <EmptyState title="No data in this period" message="Try a different project or date range." />
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
