import React, { useState, useEffect } from 'react';
import { ScrollView, Text, View, Pressable, Linking, StyleSheet } from 'react-native';
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

// Built-in starter inventory for instant dry-run testing
const DEMO_EXCEL_ROWS = [
  {
    tower: 'Tower A',
    floor: '1st Floor',
    unitNumber: 'A-101',
    category: 'flat',
    unitType: '2BHK',
    bedrooms: 2,
    bathrooms: 2,
    balconies: 1,
    carpetAreaSqft: 750,
    builtUpAreaSqft: 950,
    superBuiltupAreaSqft: 1150,
    ratePerSqft: 5000,
    basePrice: 4750000,
    parkingSlot: 'P-101',
    parkingCharges: 150000,
    clubhouseCharges: 50000,
    gstPercentage: 5,
    totalValue: 4950000,
    status: 'available',
    facing: 'East',
    notes: 'Garden facing 2BHK flat',
  },
  {
    tower: 'Tower A',
    floor: '2nd Floor',
    unitNumber: 'A-201',
    category: 'flat',
    unitType: '3BHK',
    bedrooms: 3,
    bathrooms: 3,
    balconies: 2,
    carpetAreaSqft: 1050,
    builtUpAreaSqft: 1350,
    superBuiltupAreaSqft: 1600,
    ratePerSqft: 5200,
    basePrice: 7020000,
    parkingSlot: 'P-201 (Covered)',
    parkingCharges: 200000,
    clubhouseCharges: 50000,
    gstPercentage: 5,
    totalValue: 7270000,
    status: 'available',
    facing: 'North-East',
    notes: 'Corner 3BHK flat with cross-ventilation',
  },
  {
    tower: 'Commercial Wing',
    floor: 'Ground Floor',
    unitNumber: 'SHOP-01',
    category: 'shop',
    unitType: 'Retail Shop',
    bedrooms: 0,
    bathrooms: 1,
    balconies: 0,
    carpetAreaSqft: 420,
    builtUpAreaSqft: 520,
    superBuiltupAreaSqft: 600,
    ratePerSqft: 12000,
    basePrice: 6240000,
    parkingSlot: 'Open-01',
    parkingCharges: 100000,
    clubhouseCharges: 0,
    gstPercentage: 12,
    totalValue: 6340000,
    status: 'available',
    facing: 'Main Road',
    notes: 'High-footfall prime road-facing commercial retail shop',
  },
  {
    tower: 'Commercial Wing',
    floor: 'Ground Floor',
    unitNumber: 'SHOP-02',
    category: 'shop',
    unitType: 'Showroom',
    bedrooms: 0,
    bathrooms: 1,
    balconies: 0,
    carpetAreaSqft: 650,
    builtUpAreaSqft: 800,
    superBuiltupAreaSqft: 950,
    ratePerSqft: 12500,
    basePrice: 10000000,
    parkingSlot: 'Covered-C1',
    parkingCharges: 150000,
    clubhouseCharges: 0,
    gstPercentage: 12,
    totalValue: 10150000,
    status: 'available',
    facing: 'Main Road',
    notes: 'Corner commercial showroom with double glass frontage',
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

      const preview = await propertyService.previewExcelImport(formData, selectedProjectId);
      setPreviewData(preview);

      const validCount = preview.validCount ?? (Array.isArray(preview.validRows) ? preview.validRows.length : 0);
      const errorCount = preview.errorCount ?? preview.errorRows ?? 0;

      if (errorCount > 0) {
        showToast(`Parsed with ${errorCount} issue(s). Review summary below.`, 'info');
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
      const result = await propertyService.executeExcelImport(rowsToImport, selectedProjectId);

      const count = result.unitsCreated ?? (result as any).insertedUnits ?? rowsToImport.length;
      showToast(`Bulk Import Complete! Created ${count} units successfully.`, 'success');

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
                  { col: 'Project', req: 'Optional', desc: 'Project name (e.g. Orchid Heights). Uses selected project if omitted.' },
                  { col: 'Tower', req: 'Required', desc: 'Tower / Wing / Block name (e.g. Tower A, Wing B, Commercial Wing).' },
                  { col: 'Floor', req: 'Required', desc: 'Floor level or name (e.g. 1st Floor, Ground Floor, 2, 10).' },
                  { col: 'Unit Number', req: 'Required', desc: 'Flat No or Shop No (e.g. A-101, SHOP-01, 204).' },
                  { col: 'Category', req: 'Required', desc: '"flat" for residential, "shop" for commercial (also office, penthouse).' },
                  { col: 'Unit Type', req: 'Required', desc: 'Specification (e.g. 2BHK, 3BHK, Retail Shop, Showroom).' },
                  { col: 'Carpet Area', req: 'Required', desc: 'RERA Carpet Area in SqFt (e.g. 750 for flat, 420 for shop).' },
                  { col: 'BuiltUp Area', req: 'Optional', desc: 'Built-Up Area in SqFt (e.g. 950). Auto-estimated if omitted.' },
                  { col: 'Super BuiltUp Area', req: 'Optional', desc: 'Super Built-Up Area in SqFt (e.g. 1150).' },
                  { col: 'Bedrooms', req: 'Optional', desc: 'Bedroom count (e.g. 2, 3 for flats; 0 for shops).' },
                  { col: 'Bathrooms', req: 'Optional', desc: 'Bathroom count (e.g. 2 for flats; 1 for shops).' },
                  { col: 'Balconies', req: 'Optional', desc: 'Balcony count (e.g. 1, 2 for flats; 0 for shops).' },
                  { col: 'Facing', req: 'Optional', desc: 'Orientation (e.g. East, North-East, Main Road, Garden Facing).' },
                  { col: 'Rate Per SqFt', req: 'Optional', desc: 'Rate in ₹ per SqFt (e.g. 5000 for flat, 12000 for shop).' },
                  { col: 'Base Price', req: 'Required', desc: 'Base cost in ₹ (e.g. 4750000). Auto-calculated if Rate is given.' },
                  { col: 'Parking Slot', req: 'Optional', desc: 'Parking identifier (e.g. P-101, Covered-C1, None).' },
                  { col: 'Parking Charges', req: 'Optional', desc: 'Parking cost in ₹ (e.g. 150000).' },
                  { col: 'Clubhouse Charges', req: 'Optional', desc: 'Amenities fee in ₹ (e.g. 50000).' },
                  { col: 'GST %', req: 'Optional', desc: 'GST rate (default 5% for flats, 12% for shops).' },
                  { col: 'Total Value', req: 'Optional', desc: 'Total unit cost in ₹. Auto-sums Base + Parking + Clubhouse.' },
                  { col: 'Status', req: 'Optional', desc: '"available" (default), "reserved", "booked", "sold", "blocked".' },
                  { col: 'Notes', req: 'Optional', desc: 'Custom remarks, elevation or view details.' },
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
                      ? 'All rows verified successfully. Ready to insert into database.'
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
                  <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>
                    Total In Sheet
                  </Text>
                  <Text style={{ fontSize: 19, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                    {previewData.totalRows}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 11, color: colors.success, textTransform: 'uppercase' }}>
                    Valid Units
                  </Text>
                  <Text style={{ fontSize: 19, fontWeight: '800', color: colors.success, marginTop: 2 }}>
                    {validCount}
                  </Text>
                </View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={{ fontSize: 11, color: errorCount > 0 ? colors.danger : colors.textFaint, textTransform: 'uppercase' }}>
                    Issues
                  </Text>
                  <Text style={{ fontSize: 19, fontWeight: '800', color: errorCount > 0 ? colors.danger : colors.textFaint, marginTop: 2 }}>
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
                    Units Ready to Create ({previewRows.length}):
                  </Text>
                  {previewRows.slice(0, 15).map((r: any, i: number) => {
                    const isShop = (r.category || '').toLowerCase() === 'shop';
                    return (
                      <View
                        key={i}
                        style={{
                          padding: 12,
                          backgroundColor: colors.surfaceAlt,
                          borderRadius: radius.md,
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
                            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>
                              {r.unitType || (isShop ? 'Commercial' : 'Residential')}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: colors.primary }}>
                            ₹{Number(r.totalValue || r.price || r.basePrice || 0).toLocaleString('en-IN')}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                          <Text style={{ fontSize: 11.5, color: colors.textFaint }}>
                            {r.towerName || r.tower} • {r.floorName || r.floor}
                          </Text>
                          <Text style={{ fontSize: 11.5, color: colors.textFaint }}>
                            Carpet: {r.carpetArea || r.carpetAreaSqft || '-'} sqft
                          </Text>
                          <Text style={{ fontSize: 11.5, color: colors.textFaint }}>
                            BuiltUp: {r.builtUpArea || r.builtUpAreaSqft || r.area || '-'} sqft
                          </Text>
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

                  {previewRows.length > 15 ? (
                    <Text style={{ fontSize: 12, color: colors.textFaint, textAlign: 'center', marginVertical: 4 }}>
                      + {previewRows.length - 15} more units
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {validCount > 0 ? (
                <Button
                  label={importing ? 'Importing Into Project…' : `Commit & Import All ${validCount} Units`}
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
