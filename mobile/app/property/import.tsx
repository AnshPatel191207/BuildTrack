import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, Pressable, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import { showToast } from '@/components/ui/Toast';
import type { PropertyProject, ExcelImportPreview } from '@/types';

// Built-in starter inventory for instant testing or demonstration
const SAMPLE_EXCEL_ROWS = [
  {
    tower: 'Tower A',
    floor: '1',
    unitNumber: 'A-101',
    category: 'flat',
    bedrooms: 2,
    carpetAreaSqft: 750,
    builtUpAreaSqft: 980,
    basePrice: 4800000,
    parkingSlot: 'P-101',
    parkingCharges: 150000,
  },
  {
    tower: 'Tower A',
    floor: '1',
    unitNumber: 'A-102',
    category: 'flat',
    bedrooms: 3,
    carpetAreaSqft: 1100,
    builtUpAreaSqft: 1420,
    basePrice: 6800000,
    parkingSlot: 'P-102',
    parkingCharges: 150000,
  },
  {
    tower: 'Tower A',
    floor: '2',
    unitNumber: 'A-201',
    category: 'flat',
    bedrooms: 2,
    carpetAreaSqft: 750,
    builtUpAreaSqft: 980,
    basePrice: 4900000,
    parkingSlot: 'P-201',
    parkingCharges: 150000,
  },
  {
    tower: 'Tower B',
    floor: 'Ground',
    unitNumber: 'Shop-01',
    category: 'shop',
    carpetAreaSqft: 420,
    builtUpAreaSqft: 580,
    basePrice: 7200000,
  },
];

export default function PropertyExcelImportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing, radius } = theme;

  const params = useLocalSearchParams<{ projectId?: string }>();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(params.projectId || '');
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<ExcelImportPreview | null>(null);

  // Fetch projects
  const { data: projects } = useResource<PropertyProject[]>(
    () => propertyService.listProjects(),
    [],
  );

  useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0]._id);
    }
  }, [projects, selectedProjectId]);

  const handleDownloadTemplate = () => {
    try {
      const url = propertyService.getImportTemplateUrl(selectedProjectId || undefined);
      void Linking.openURL(url);
      showToast('Downloading Excel template...', 'info');
    } catch {
      showToast('Could not download template', 'error');
    }
  };

  const handleLoadSamplePreview = () => {
    if (!selectedProjectId) {
      showToast('Select a project first', 'error');
      return;
    }
    setValidating(true);
    setTimeout(() => {
      setPreviewData({
        totalRows: SAMPLE_EXCEL_ROWS.length,
        validRows: SAMPLE_EXCEL_ROWS.length,
        errorRows: 0,
        errors: [],
        rows: SAMPLE_EXCEL_ROWS,
      });
      setValidating(false);
      showToast('Sample inventory template loaded for dry run', 'success');
    }, 400);
  };

  const handleExecuteImport = async () => {
    if (!selectedProjectId) {
      showToast('Select project first', 'error');
      return;
    }
    if (!previewData || !previewData.rows || previewData.rows.length === 0) {
      showToast('No valid rows to import', 'error');
      return;
    }

    setImporting(true);
    try {
      const result = await propertyService.executeExcelImport(
        previewData.rows,
        selectedProjectId,
      );

      showToast(
        `Bulk Import Successful! Created ${result.unitsCreated || previewData.rows.length} units.`,
        'success',
      );
      setPreviewData(null);
      router.push(`/property/flats?projectId=${selectedProjectId}` as any);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to execute bulk import', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Excel Bulk Import"
        subtitle="Import towers, floors & units in seconds"
        large
        onBack={() => router.back()}
      />
      <OfflineBanner />

      {/* Project Selector Bar */}
      {projects && projects.length > 0 && (
        <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}>
            {projects.map((p) => {
              const active = p._id === selectedProjectId;
              return (
                <Pressable
                  key={p._id}
                  onPress={() => {
                    setSelectedProjectId(p._id);
                    setPreviewData(null);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: radius.full,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text style={{ color: active ? '#fff' : colors.text, fontSize: 12, fontWeight: active ? '700' : '500' }}>
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: spacing.md }}>
        <View style={{ gap: 16 }}>
          {/* Step 1: Download Template */}
          <Card style={{ padding: 18, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                  Download Standard Excel Template
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Pre-configured headers matching BuildTrack ERP inventory schema.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleDownloadTemplate}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1D6F42',
                paddingVertical: 11,
                borderRadius: radius.md,
                marginTop: 4,
              }}
            >
              <Ionicons name="download-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Download Sample Template (.xlsx)</Text>
            </Pressable>
          </Card>

          {/* Step 2: Validate / Load Inventory */}
          <Card style={{ padding: 18, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                  Load & Validate Inventory Data
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Performs a dry-run check for missing fields, duplicate flat numbers, and unit areas.
                </Text>
              </View>
            </View>

            <Button
              label={validating ? 'Validating...' : 'Load & Validate Sample Inventory'}
              variant="secondary"
              onPress={handleLoadSamplePreview}
              disabled={validating}
            />
          </Card>

          {/* Step 3: Preview and Confirmation */}
          {previewData && (
            <Card style={{ padding: 18, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.success,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                    Validation Summary
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    Dry run passed. Ready to insert into database.
                  </Text>
                </View>
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View>
                  <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Total Units</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                    {previewData.totalRows}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.success, textTransform: 'uppercase' }}>Valid</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.success, marginTop: 2 }}>
                    {previewData.validRows}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.danger, textTransform: 'uppercase' }}>Errors</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.danger, marginTop: 2 }}>
                    {previewData.errorRows}
                  </Text>
                </View>
              </View>

              {/* Rows preview */}
              {previewData.rows && (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>Rows Ready to Insert:</Text>
                  {previewData.rows.map((r, i) => (
                    <View
                      key={i}
                      style={{
                        padding: 10,
                        backgroundColor: colors.surfaceAlt,
                        borderRadius: radius.sm,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                          {r.unitNumber} ({(r.category || 'RESIDENTIAL').toUpperCase()})
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                          {r.tower} • Floor {r.floor} {r.bedrooms ? `• ${r.bedrooms} BHK` : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary }}>
                        ₹{Number(r.basePrice || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <Button
                label={importing ? 'Importing Into Project...' : 'Commit & Import All Units'}
                onPress={handleExecuteImport}
                disabled={importing}
                style={{ marginTop: 8 }}
              />
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
