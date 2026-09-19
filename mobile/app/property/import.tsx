import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, Pressable, Linking, StyleSheet, Alert, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import { showToast } from '@/components/ui/Toast';
import type { PropertyProject, ExcelImportPreview } from '@/types';

function formatDecimal(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '0.00';
  const n = Number(val);
  if (isNaN(n)) return '0.00';
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Built-in starter inventory matching exact 11 columns from user's Excel file
const DEMO_EXCEL_ROWS = [
  {
    rowNumber: 2,
    projectName: 'Santora',
    towerName: 'A',
    floorName: '1st floor',
    unitNumber: 'A-101',
    category: 'flat',
    unitType: 'Residential Flat',
    plotAreaSqmt: 25.85,
    builtUpAreaSqmt: 68.80,
    carpetAreaSqmt: 60.35,
    balconyAreaSqmt: 4.59,
    terraceAreaSqmt: 43.18,
    saleDeedAmount: 4040000,
    carpetArea: 649.62,
    builtUpArea: 740.56,
    superBuiltupArea: 740.56,
    basePrice: 4040000,
    totalValue: 4040000,
    status: 'available',
  },
  {
    rowNumber: 3,
    projectName: 'Santora',
    towerName: 'A',
    floorName: '1st floor',
    unitNumber: 'A-102',
    category: 'flat',
    unitType: 'Residential Flat',
    plotAreaSqmt: 25.94,
    builtUpAreaSqmt: 69.02,
    carpetAreaSqmt: 60.35,
    balconyAreaSqmt: 4.59,
    terraceAreaSqmt: 109.32,
    saleDeedAmount: 4400000,
    carpetArea: 649,
    builtUpArea: 743,
    superBuiltupArea: 743,
    basePrice: 4400000,
    totalValue: 4400000,
    status: 'available',
  },
  {
    rowNumber: 4,
    projectName: 'Santora',
    towerName: 'A',
    floorName: '2nd floor',
    unitNumber: 'A-201',
    category: 'flat',
    unitType: 'Residential Flat',
    plotAreaSqmt: 25.85,
    builtUpAreaSqmt: 68.80,
    carpetAreaSqmt: 60.35,
    balconyAreaSqmt: 4.59,
    terraceAreaSqmt: 0,
    saleDeedAmount: 3800000,
    carpetArea: 649,
    builtUpArea: 740,
    superBuiltupArea: 740,
    basePrice: 3800000,
    totalValue: 3800000,
    status: 'available',
  },
  {
    rowNumber: 5,
    projectName: 'Santora',
    towerName: 'Commercial',
    floorName: 'Ground floor',
    unitNumber: 'SHOP-01',
    category: 'shop',
    unitType: 'Commercial Shop',
    plotAreaSqmt: 18.50,
    builtUpAreaSqmt: 45.00,
    carpetAreaSqmt: 38.20,
    balconyAreaSqmt: 0,
    terraceAreaSqmt: 0,
    saleDeedAmount: 5200000,
    carpetArea: 411,
    builtUpArea: 484,
    superBuiltupArea: 484,
    basePrice: 5200000,
    totalValue: 5200000,
    status: 'available',
  },
];

export default function PropertyExcelImportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing, radius } = theme;

  const params = useLocalSearchParams<{ projectId?: string }>();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(params.projectId || '');
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(true);
  const [previewData, setPreviewData] = useState<ExcelImportPreview | null>(null);
  const [showFormatGuide, setShowFormatGuide] = useState(false);

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

  const selectedProject = projects?.find((p) => p._id === selectedProjectId);

  // ── Download Template (.xlsx) with auth token & prefilled project ──
  const handleDownloadTemplate = () => {
    try {
      const url = propertyService.getImportTemplateUrl(selectedProjectId || undefined);
      void Linking.openURL(url);
      showToast('Downloading comprehensive Excel template (.xlsx)…', 'info');
    } catch {
      showToast('Could not initiate template download', 'error');
    }
  };

  // ── Clear All Units in Currently Selected Project ──
  const handleClearProjectUnits = () => {
    if (!selectedProjectId) {
      showToast('Select a project first', 'error');
      return;
    }
    const pName = selectedProject?.name || 'this project';
    Alert.alert(
      'Clear All Units in Project',
      `Are you sure you want to delete all flats and shops in "${pName}"? This permanently deletes inventory units (including booked & sold). This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setClearing(true);
            try {
              const res = await propertyService.deleteAllUnits({
                projectId: selectedProjectId,
                category: 'all',
                includeBookedSold: true,
              });
              showToast(res.message || `Deleted all ${res.deletedCount} units in ${pName}.`, 'success');
              setPreviewData(null);
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to clear units', 'error');
            } finally {
              setClearing(false);
            }
          },
        },
      ],
    );
  };

  // ── Pick Real File from Device (.xlsx, .xls, .csv) ──
  const handlePickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/octet-stream',
        ],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        setSelectedFile(file);
        setPreviewData(null);
        showToast(`Selected file: ${file.name}`, 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to select document', 'error');
    }
  };

  // ── Upload & Validate Real File on Server ──
  const handleValidateUploadedFile = async () => {
    if (!selectedFile) {
      showToast('Please select a spreadsheet file first', 'error');
      return;
    }
    if (!selectedProjectId) {
      showToast('Please select a project first', 'error');
      return;
    }

    setValidating(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any);
      formData.append('projectId', selectedProjectId);
      formData.append('overwriteExisting', String(overwriteExisting));

      const preview = await propertyService.previewExcelImport(formData, selectedProjectId, overwriteExisting);
      setPreviewData(preview);

      const validCount = preview.validCount ?? (Array.isArray(preview.validRows) ? preview.validRows.length : 0);
      const errorCount = preview.errorCount ?? preview.errorRows ?? 0;
      const updateCount = preview.updateCount ?? 0;

      if (errorCount > 0) {
        showToast(`Parsed with ${errorCount} issue(s). Review summary below.`, 'info');
      } else if (updateCount > 0) {
        showToast(`Parsed ${validCount} units (${updateCount} updates to existing units).`, 'success');
      } else {
        showToast(`Parsed ${validCount} units successfully!`, 'success');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to parse Excel file';
      showToast(msg, 'error');
    } finally {
      setValidating(false);
    }
  };

  // ── Load Sample Demo Preview ──
  const handleLoadSamplePreview = () => {
    if (!selectedProjectId) {
      showToast('Select a project first', 'error');
      return;
    }
    setValidating(true);
    setTimeout(() => {
      setPreviewData({
        totalRows: DEMO_EXCEL_ROWS.length,
        validRows: DEMO_EXCEL_ROWS,
        validCount: DEMO_EXCEL_ROWS.length,
        errorRows: 0,
        errorCount: 0,
        errors: [],
        rows: DEMO_EXCEL_ROWS,
      });
      setSelectedFile(null);
      setValidating(false);
      showToast('Loaded 4 demo units (2 Flats + 2 Shops)', 'success');
    }, 350);
  };

  // ── Commit & Import Validated Units ──
  const handleExecuteImport = async () => {
    if (!selectedProjectId) {
      showToast('Select project first', 'error');
      return;
    }

    const rowsToImport = Array.isArray(previewData?.validRows)
      ? previewData.validRows
      : previewData?.rows || [];

    if (!rowsToImport || rowsToImport.length === 0) {
      showToast('No valid units to import', 'error');
      return;
    }

    setImporting(true);
    try {
      const result = await propertyService.executeExcelImport(rowsToImport, selectedProjectId, overwriteExisting);

      const count = result.unitsCreated ?? (result as any).insertedUnits ?? rowsToImport.length;
      const updated = result.updatedUnits ?? 0;
      showToast(
        updated > 0
          ? `Bulk Import Complete! Created ${count} new, updated ${updated} existing units.`
          : `Bulk Import Complete! Created ${count} units successfully.`,
        'success',
      );

      setPreviewData(null);
      setSelectedFile(null);
      router.push(`/property/flats?projectId=${selectedProjectId}` as any);
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to execute bulk import', 'error');
    } finally {
      setImporting(false);
    }
  };

  // Normalize preview row list
  const previewRows = Array.isArray(previewData?.validRows)
    ? previewData.validRows
    : previewData?.rows || [];

  const validCount = previewData?.validCount ?? previewRows.length;
  const errorCount = previewData?.errorCount ?? previewData?.errorRows ?? (previewData?.errors?.length || 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Excel Bulk Import"
        subtitle="Import towers, floors & property units"
        large
        onBack={() => router.back()}
        right={
          <Pressable
            onPress={() => setShowFormatGuide(!showFormatGuide)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: radius.full,
            }}
          >
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>
              {showFormatGuide ? 'Hide Format' : 'Format Guide'}
            </Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      {/* Project Selector Bar */}
      {projects && projects.length > 0 && (
        <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.border }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8 }}
          >
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
                    paddingHorizontal: 13,
                    paddingVertical: 7,
                    borderRadius: radius.full,
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: active ? '#fff' : colors.text,
                      fontSize: 12.5,
                      fontWeight: active ? '700' : '500',
                    }}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 120,
          paddingTop: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 16 }}>
          {/* ── EXPANDABLE FORMAT GUIDE & SPECIFICATION ── */}
          {showFormatGuide ? (
            <Card style={{ padding: 16, borderColor: colors.primary, borderWidth: 1.5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="document-text" size={18} color={colors.primary} />
                  <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
                    .XLSX Format Specification
                  </Text>
                </View>
                <Badge label="RERA Compatible" tone="success" />
              </View>

              <Text style={{ fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: 12 }}>
                Your spreadsheet can have any order of columns. The importer automatically matches the headers below for residential Flats and commercial Shops:
              </Text>

              {/* Column list */}
              <View style={{ gap: 8 }}>
                {[
                  { col: '1. Sr.No.', req: 'Optional', desc: 'Serial number (e.g. 1, 2, 3).' },
                  { col: '2. Project Name', req: 'Optional', desc: 'Project name (e.g. Santora). Uses selected project if omitted.' },
                  { col: '3. Block', req: 'Required', desc: 'Block / Tower / Wing name (e.g. A, B, Commercial).' },
                  { col: '4. Floor', req: 'Required', desc: 'Floor level (e.g. 1st floor, 2nd floor, Ground floor).' },
                  { col: '5. Flat No.', req: 'Required', desc: 'Unit / Flat / Shop number (e.g. A-101, A-102, SHOP-01).' },
                  { col: '6. Prop. Plot Area In Sqmt', req: 'Optional', desc: 'Proportionate Plot Area in Sq. Meters (e.g. 25.85).' },
                  { col: '7. Unit Built up Area In Sqmt', req: 'Optional', desc: 'Unit Built-up Area in Sq. Meters (e.g. 68.80). Auto-converted to SqFt.' },
                  { col: '8. Rera Carpet Area In Sqmt', req: 'Required', desc: 'RERA Carpet Area in Sq. Meters (e.g. 60.35). Auto-converted to SqFt.' },
                  { col: '9. Wash & Balcony Area In Sqmt', req: 'Optional', desc: 'Wash & Balcony Area in Sq. Meters (e.g. 4.59).' },
                  { col: '10. Open Terrace In Sqmt', req: 'Optional', desc: 'Open Terrace Area in Sq. Meters (e.g. 43.18, 109.32).' },
                  { col: '11. Sale deed Amount', req: 'Required', desc: 'Sale deed Amount in ₹ (e.g. 40,40,000, 44,00,000). Sets unit price.' },
                ].map((f) => (
                  <View
                    key={f.col}
                    style={{
                      padding: 8,
                      backgroundColor: colors.surfaceAlt,
                      borderRadius: radius.sm,
                    }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.text }}>{f.col}</Text>
                      <Badge
                        label={f.req}
                        tone={f.req === 'Required' ? 'orange' : 'neutral'}
                      />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 3 }}>
                      {f.desc}
                    </Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => setShowFormatGuide(false)}
                style={{
                  marginTop: 12,
                  paddingVertical: 8,
                  alignItems: 'center',
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.sm,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>Close Guide</Text>
              </Pressable>
            </Card>
          ) : null}

          {/* ── STEP 1: DOWNLOAD OFFICIAL TEMPLATE ── */}
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
                  Download Complete Excel Template
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Pre-configured with all Flat & Shop columns, BHKs, areas, rates, and parking.
                  {selectedProject ? ` (Pre-filled for: ${selectedProject.name})` : ''}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleDownloadTemplate}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#1D6F42',
                paddingVertical: 12,
                borderRadius: radius.md,
                marginTop: 4,
                gap: 6,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="download-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 13.5, fontWeight: '700' }}>
                Download Template (.xlsx)
              </Text>
            </Pressable>
          </Card>

          {/* ── STEP 2: SELECT & UPLOAD REAL EXCEL FILE ── */}
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
                  Select Spreadsheet File (.xlsx, .xls, .csv)
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                  Pick your property spreadsheet from your device or cloud storage.
                </Text>
              </View>
            </View>

            {/* File Picker Action */}
            <Pressable
              onPress={handlePickFile}
              style={({ pressed }) => ({
                borderWidth: 1.5,
                borderColor: selectedFile ? colors.success : colors.border,
                borderStyle: selectedFile ? 'solid' : 'dashed',
                backgroundColor: selectedFile ? colors.successSoft : colors.surfaceAlt,
                borderRadius: radius.md,
                padding: 16,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons
                name={selectedFile ? 'document-attach' : 'cloud-upload-outline'}
                size={28}
                color={selectedFile ? colors.success : colors.primary}
              />
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                {selectedFile ? selectedFile.name : 'Tap to Browse & Select File'}
              </Text>
              <Text style={{ color: colors.textFaint, fontSize: 11.5 }}>
                {selectedFile
                  ? `${((selectedFile.size || 0) / 1024).toFixed(1)} KB • Tap to change file`
                  : 'Supports Microsoft Excel (.xlsx, .xls) and CSV'}
              </Text>
            </Pressable>

            {/* Overwrite / Update Existing Units Toggle */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: colors.surfaceAlt,
                padding: 12,
                borderRadius: radius.md,
                marginTop: 4,
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                  Overwrite / Update Existing Units
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  When enabled, units matching unit number will be updated in-place with spreadsheet values instead of being skipped.
                </Text>
              </View>
              <Switch
                value={overwriteExisting}
                onValueChange={setOverwriteExisting}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {/* Clear All Project Units Option */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: colors.surfaceAlt,
                padding: 12,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>
                  Clear All Units in this Project
                </Text>
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                  Delete all units (flats & shops) in {selectedProject?.name || 'this project'} to start fresh.
                </Text>
              </View>
              <Pressable
                onPress={handleClearProjectUnits}
                disabled={clearing}
                style={{
                  backgroundColor: colors.dangerSoft,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: colors.danger,
                }}
              >
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>
                  {clearing ? 'Clearing…' : 'Clear All'}
                </Text>
              </Pressable>
            </View>

            {/* Action Buttons */}
            {selectedFile ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Button
                  label={validating ? 'Uploading & Validating…' : 'Validate & Preview Selected File'}
                  onPress={handleValidateUploadedFile}
                  disabled={validating}
                  loading={validating}
                />
                <Pressable
                  onPress={() => {
                    setSelectedFile(null);
                    setPreviewData(null);
                  }}
                  style={{ alignItems: 'center', paddingVertical: 4 }}
                >
                  <Text style={{ color: colors.danger, fontSize: 12.5, fontWeight: '600' }}>
                    Remove Selected File
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ marginTop: 4 }}>
                <Pressable
                  onPress={handleLoadSamplePreview}
                  disabled={validating}
                  style={{
                    paddingVertical: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12.5, fontWeight: '600' }}>
                    Or try instant 4-unit demo preview (without uploading)
                  </Text>
                </Pressable>
              </View>
            )}
          </Card>

          {/* ── STEP 3: PREVIEW, VALIDATION & COMMIT ── */}
          {previewData ? (
            <Card style={{ padding: 18, gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: errorCount > 0 && validCount === 0 ? colors.danger : colors.success,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={errorCount > 0 && validCount === 0 ? 'close' : 'checkmark'}
                    size={18}
                    color="#fff"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                    Validation Summary
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    {errorCount === 0
                      ? `All ${validCount} rows verified successfully.${(previewData.updateCount || 0) > 0 ? ` (${previewData.updateCount} existing units will be updated)` : ''} Ready to import.`
                      : `Found ${validCount} valid units and ${errorCount} issue(s).`}
                  </Text>
                </View>
              </View>

              {/* KPI metrics row */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 10.5, color: colors.textFaint, textTransform: 'uppercase' }}>
                    Total In Sheet
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                    {previewData.totalRows}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 10.5, color: colors.success, textTransform: 'uppercase' }}>
                    New Units
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.success, marginTop: 2 }}>
                    {Math.max(0, validCount - (previewData.updateCount || 0))}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 10.5, color: colors.primary, textTransform: 'uppercase' }}>
                    Updating
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary, marginTop: 2 }}>
                    {previewData.updateCount || 0}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 10.5, color: errorCount > 0 ? colors.danger : colors.textFaint, textTransform: 'uppercase' }}>
                    Issues
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: errorCount > 0 ? colors.danger : colors.textFaint, marginTop: 2 }}>
                    {errorCount}
                  </Text>
                </View>
              </View>

              {/* Error messages if any */}
              {previewData.errors && previewData.errors.length > 0 ? (
                <View style={{ gap: 6, backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <Ionicons name="alert-circle" size={16} color={colors.danger} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>
                      Row Validation Warnings ({previewData.errors.length})
                    </Text>
                  </View>
                  {previewData.errors.slice(0, 10).map((err, idx) => (
                    <Text key={idx} style={{ fontSize: 11.5, color: colors.danger, lineHeight: 16 }}>
                      • Row {err.rowNumber || '?'}{err.unitNumber ? ` (${err.unitNumber})` : ''}: {err.reason || err.message}
                    </Text>
                  ))}
                  {previewData.errors.length > 10 ? (
                    <Text style={{ fontSize: 11, color: colors.danger, fontStyle: 'italic' }}>
                      + {previewData.errors.length - 10} more rows with warnings
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {/* Valid rows preview list */}
              {previewRows.length > 0 ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                    Units Ready to Process ({previewRows.length}):
                  </Text>
                  {previewRows.slice(0, 20).map((r: any, i: number) => {
                    const isShop = (r.category || '').toLowerCase() === 'shop';
                    const isUpdate = Boolean(r.isUpdate || r.isExisting);
                    return (
                      <View
                        key={i}
                        style={{
                          padding: 12,
                          backgroundColor: colors.surfaceAlt,
                          borderRadius: radius.md,
                          borderLeftWidth: 3,
                          borderLeftColor: isUpdate ? colors.primary : colors.success,
                          gap: 4,
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 14.5, fontWeight: '800', color: colors.text }}>
                              {r.unitNumber}
                            </Text>
                            <Badge
                              label={isShop ? 'SHOP' : 'FLAT'}
                              tone={isShop ? 'orange' : 'info'}
                            />
                            {isUpdate ? (
                              <Badge
                                label="UPDATE"
                                tone="orange"
                              />
                            ) : null}
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>
                              {r.unitType || (isShop ? 'Commercial' : 'Residential')}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.primary }}>
                            ₹{formatDecimal(r.saleDeedAmount || r.totalValue || r.price || r.basePrice)}
                          </Text>
                        </View>

                        {/* All 11 columns in clean 2-decimal format */}
                        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                          <Text style={{ fontSize: 11.5, color: colors.textFaint }}>
                            Block: {r.towerName || r.tower || '-'} • Floor: {r.floorName || r.floor || '-'}
                          </Text>
                          {r.carpetAreaSqmt !== undefined && r.carpetAreaSqmt !== null ? (
                            <Text style={{ fontSize: 11.5, color: colors.text }}>
                              RERA Carpet: <Text style={{ fontWeight: '700' }}>{formatDecimal(r.carpetAreaSqmt)} sqmt</Text> ({formatDecimal(r.carpetAreaSqft || r.carpetArea)} sqft)
                            </Text>
                          ) : (
                            <Text style={{ fontSize: 11.5, color: colors.text }}>
                              Carpet: {formatDecimal(r.carpetAreaSqft || r.carpetArea)} sqft
                            </Text>
                          )}
                          {r.builtUpAreaSqmt !== undefined && r.builtUpAreaSqmt !== null ? (
                            <Text style={{ fontSize: 11.5, color: colors.text }}>
                              Built-Up: <Text style={{ fontWeight: '700' }}>{formatDecimal(r.builtUpAreaSqmt)} sqmt</Text> ({formatDecimal(r.builtUpAreaSqft || r.builtUpArea)} sqft)
                            </Text>
                          ) : r.builtUpAreaSqft || r.builtUpArea ? (
                            <Text style={{ fontSize: 11.5, color: colors.text }}>
                              Built-Up: {formatDecimal(r.builtUpAreaSqft || r.builtUpArea)} sqft
                            </Text>
                          ) : null}
                          {r.plotAreaSqmt !== undefined && r.plotAreaSqmt !== null && Number(r.plotAreaSqmt) > 0 ? (
                            <Text style={{ fontSize: 11.5, color: colors.textFaint }}>
                              Plot: <Text style={{ fontWeight: '700', color: colors.text }}>{formatDecimal(r.plotAreaSqmt)} sqmt</Text>
                            </Text>
                          ) : null}
                          {r.balconyAreaSqmt !== undefined && r.balconyAreaSqmt !== null && Number(r.balconyAreaSqmt) > 0 ? (
                            <Text style={{ fontSize: 11.5, color: colors.textFaint }}>
                              Wash/Balc: <Text style={{ fontWeight: '700', color: colors.text }}>{formatDecimal(r.balconyAreaSqmt)} sqmt</Text>
                            </Text>
                          ) : null}
                          {r.terraceAreaSqmt !== undefined && r.terraceAreaSqmt !== null && Number(r.terraceAreaSqmt) > 0 ? (
                            <Text style={{ fontSize: 11.5, color: colors.textFaint }}>
                              Terrace: <Text style={{ fontWeight: '700', color: colors.text }}>{formatDecimal(r.terraceAreaSqmt)} sqmt</Text>
                            </Text>
                          ) : null}
                          {r.saleDeedAmount !== undefined && r.saleDeedAmount !== null && Number(r.saleDeedAmount) > 0 ? (
                            <Text style={{ fontSize: 11.5, color: colors.primary, fontWeight: '700' }}>
                              Sale Deed: ₹{formatDecimal(r.saleDeedAmount)}
                            </Text>
                          ) : null}
                          {r.facing ? (
                            <Text style={{ fontSize: 11.5, color: colors.textFaint }}>
                              Facing: {r.facing}
                            </Text>
                          ) : null}
                          {r.parkingSlot ? (
                            <Text style={{ fontSize: 11.5, color: colors.textFaint }}>
                              Parking: {r.parkingSlot}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  {previewRows.length > 20 ? (
                    <Text style={{ fontSize: 12, color: colors.textFaint, textAlign: 'center', marginVertical: 4 }}>
                      + {previewRows.length - 20} more units in spreadsheet
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {validCount > 0 ? (
                <Button
                  label={
                    importing
                      ? 'Importing Into Project…'
                      : (previewData.updateCount || 0) > 0
                        ? `Commit & Import (${validCount - (previewData.updateCount || 0)} New, ${previewData.updateCount} Updates)`
                        : `Commit & Import All ${validCount} Units`
                  }
                  onPress={handleExecuteImport}
                  disabled={importing}
                  loading={importing}
                  style={{ marginTop: 8 }}
                />
              ) : null}
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
