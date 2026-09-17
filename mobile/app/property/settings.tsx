import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { showToast } from '@/components/ui/Toast';
import { useTheme } from '@/hooks/useTheme';
import { useProjectStore } from '@/stores/projectStore';
import { propertyService } from '@/services/propertyService';
import { ColorPickerInput } from '@/components/admin/ColorPickerInput';
import { LiveReceiptCanvas } from '@/components/admin/LiveReceiptCanvas';
import { VariableChipSelector } from '@/components/admin/VariableChipSelector';

type TabKey = 'general' | 'branding' | 'theme' | 'receipts' | 'templates' | 'rules';

export default function ProjectSettingsScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();

  const storeActiveProjectId = useProjectStore((s) => s.activeProjectId);
  const projectId = params.projectId || storeActiveProjectId;

  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const updateThemeColors = useProjectStore((s) => s.updateThemeColors);
  const updateBrandingData = useProjectStore((s) => s.updateBrandingData);

  const [activeTab, setActiveTab] = useState<TabKey>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectData, setProjectData] = useState<any>(null);

  // General & Branding Form State
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [developerName, setDeveloperName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [reraNumber, setReraNumber] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Theme Form State
  const [primary, setPrimary] = useState('#E8590C');
  const [secondary, setSecondary] = useState('#17263B');
  const [accent, setAccent] = useState('#F59E0B');
  const [success, setSuccess] = useState('#10B981');
  const [warning, setWarning] = useState('#D97706');

  // Receipt Config State
  const [showLogo, setShowLogo] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [showGst, setShowGst] = useState(true);
  const [showRera, setShowRera] = useState(true);
  const [showCustomerAddress, setShowCustomerAddress] = useState(true);
  const [showBankDetails, setShowBankDetails] = useState(true);
  const [watermarkText, setWatermarkText] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [tagline, setTagline] = useState('2 BHK PODIUM HOMES');
  const [jurisdiction, setJurisdiction] = useState('Ahmedabad Jurisdiction');

  // Legal Doc Recital Config State (Banakhat & Dastavej)
  const [partnershipFirmName, setPartnershipFirmName] = useState('M/s RUDRA DEVELOPERS');
  const [managingPartners, setManagingPartners] = useState('MANISHBHAI CHHAGANBHAI KAKADIYA, ASHISHKUMAR MANUBHAI PATEL, BHAVESHKUMAR SHAMJIBHAI PATEL');
  const [subRegistrarOffice, setSubRegistrarOffice] = useState('Sub-Registrar Gandhinagar-4 (Khoraj)');
  const [tpScheme, setTpScheme] = useState('T.P. Scheme No. 64 (Tragad-Godhavi)');
  const [surveyNumbers, setSurveyNumbers] = useState('Revenue Survey No. 518/1, 518/2');
  const [finalPlotNumbers, setFinalPlotNumbers] = useState('Final Plot No. 128');
  const [citySurveyNumbers, setCitySurveyNumbers] = useState('City Survey No. 4321');

  // Rules State
  const [minToken, setMinToken] = useState('100000');
  const [tokenDays, setTokenDays] = useState('7');
  const [cancelPenalty, setCancelPenalty] = useState('10');
  const [gstRate, setGstRate] = useState('5');
  const [overdueInterest, setOverdueInterest] = useState('12');

  // Template Clause State
  const [templateType, setTemplateType] = useState<'banakhat' | 'dastavej'>('banakhat');
  const [templateContent, setTemplateContent] = useState('');
  const [clauses, setClauses] = useState<any[]>([]);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    loadConfig();
  }, [projectId]);

  const loadConfig = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const p = await propertyService.getProjectConfiguration(projectId);
      setProjectData(p);
      setName(p.name || '');
      setShortName(p.branding?.shortName || '');
      setDeveloperName(p.branding?.developerName || p.builderName || '');
      setCompanyName(p.branding?.companyName || '');
      setPhone(p.branding?.phone || '');
      setEmail(p.branding?.email || '');
      setWebsite(p.branding?.website || '');
      setOfficeAddress(p.branding?.officeAddress || '');
      setSiteAddress(p.branding?.siteAddress || p.address || '');
      setGstNumber(p.branding?.gstNumber || '');
      setReraNumber(p.branding?.reraNumber || p.reraNumber || '');
      setLogoUrl(p.branding?.logoUrl || null);

      if (p.theme) {
        setPrimary(p.theme.primary || '#E8590C');
        setSecondary(p.theme.secondary || '#17263B');
        setAccent(p.theme.accent || '#F59E0B');
        setSuccess(p.theme.success || '#10B981');
        setWarning(p.theme.warning || '#D97706');
      }

      if (p.receiptConfig) {
        setShowLogo(p.receiptConfig.showLogo ?? true);
        setShowQr(p.receiptConfig.showQr ?? true);
        setShowGst(p.receiptConfig.showGst ?? true);
        setShowRera(p.receiptConfig.showRera ?? true);
        setShowCustomerAddress(p.receiptConfig.showCustomerAddress ?? true);
        setShowBankDetails(p.receiptConfig.showBankDetails ?? true);
        setWatermarkText(p.receiptConfig.watermarkText || '');
        setSignatoryTitle(p.receiptConfig.authorizedSignatoryTitle || '');
        if (p.receiptConfig.tagline) setTagline(p.receiptConfig.tagline);
        if (p.receiptConfig.jurisdiction) setJurisdiction(p.receiptConfig.jurisdiction);
      }

      if (p.legalDocConfig) {
        if (p.legalDocConfig.partnershipFirmName) setPartnershipFirmName(p.legalDocConfig.partnershipFirmName);
        if (Array.isArray(p.legalDocConfig.managingPartners) && p.legalDocConfig.managingPartners.length > 0) {
          setManagingPartners(p.legalDocConfig.managingPartners.join(', '));
        }
        if (p.legalDocConfig.subRegistrarOffice) setSubRegistrarOffice(p.legalDocConfig.subRegistrarOffice);
        if (p.legalDocConfig.tpScheme) setTpScheme(p.legalDocConfig.tpScheme);
        if (p.legalDocConfig.surveyNumbers) setSurveyNumbers(p.legalDocConfig.surveyNumbers);
        if (p.legalDocConfig.finalPlotNumbers) setFinalPlotNumbers(p.legalDocConfig.finalPlotNumbers);
        if (p.legalDocConfig.citySurveyNumbers) setCitySurveyNumbers(p.legalDocConfig.citySurveyNumbers);
        if (p.legalDocConfig.projectTagline && !p.receiptConfig?.tagline) setTagline(p.legalDocConfig.projectTagline);
        if (p.legalDocConfig.jurisdiction && !p.receiptConfig?.jurisdiction) setJurisdiction(p.legalDocConfig.jurisdiction);
      }

      if (p.bookingRules) {
        setMinToken(String(p.bookingRules.minTokenAmount || 100000));
        setTokenDays(String(p.bookingRules.tokenValidityDays || 7));
        setCancelPenalty(String(p.bookingRules.cancellationPenaltyPct || 10));
      }

      if (p.paymentRules) {
        setGstRate(String(p.paymentRules.defaultGstRate || 5));
        setOverdueInterest(String(p.paymentRules.overdueInterestPctPerAnnum || 12));
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to load project configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Logo Upload Handler
  const handleLogoUpload = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 1],
        quality: 0.9,
      });

      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];

      const formData = new FormData();
      formData.append('logo', {
        uri: asset.uri,
        name: asset.fileName || 'project_logo.png',
        type: asset.mimeType || 'image/png',
      } as any);

      setSaving(true);
      const updated = await propertyService.uploadProjectLogo(projectId!, formData);
      setLogoUrl(updated.branding?.logoUrl || null);
      updateBrandingData(updated.branding);
      showToast('Project logo updated successfully');
    } catch (err: any) {
      showToast(err?.message || 'Logo upload failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogoDelete = async () => {
    Alert.alert('Delete Logo', 'Revert to default company logo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await propertyService.deleteProjectLogo(projectId!);
            setLogoUrl(null);
            updateBrandingData({ logoUrl: null });
            showToast('Logo deleted, reverted to default');
          } catch (err: any) {
            showToast('Failed to delete logo', 'error');
          }
        },
      },
    ]);
  };

  // Save All Changes
  const handleSave = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      // 1. Save Branding
      const brandingPayload = {
        shortName: shortName.trim() || undefined,
        developerName: developerName.trim() || undefined,
        companyName: companyName.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        officeAddress: officeAddress.trim() || undefined,
        siteAddress: siteAddress.trim() || undefined,
        gstNumber: gstNumber.trim() || undefined,
        reraNumber: reraNumber.trim() || undefined,
      };
      await propertyService.updateProjectBranding(projectId, brandingPayload);

      // 2. Save Theming
      const themePayload = { primary, secondary, accent, success, warning };
      await propertyService.updateProjectTheme(projectId, themePayload);

      // 3. Save Receipt Config
      const receiptPayload = {
        showLogo,
        showQr,
        showGst,
        showRera,
        showCustomerAddress,
        showBankDetails,
        watermarkText: watermarkText.trim() || undefined,
        authorizedSignatoryTitle: signatoryTitle.trim() || undefined,
        tagline: tagline.trim() || undefined,
        jurisdiction: jurisdiction.trim() || undefined,
      };
      await propertyService.updateReceiptConfig(projectId, receiptPayload);

      // 3b. Save Legal Doc Config (Banakhat & Dastavej)
      const legalDocPayload = {
        partnershipFirmName: partnershipFirmName.trim() || undefined,
        managingPartners: managingPartners.split(',').map((s) => s.trim()).filter(Boolean),
        subRegistrarOffice: subRegistrarOffice.trim() || undefined,
        tpScheme: tpScheme.trim() || undefined,
        surveyNumbers: surveyNumbers.trim() || undefined,
        finalPlotNumbers: finalPlotNumbers.trim() || undefined,
        citySurveyNumbers: citySurveyNumbers.trim() || undefined,
        projectTagline: tagline.trim() || undefined,
        jurisdiction: jurisdiction.trim() || undefined,
      };
      await propertyService.updateLegalDocConfig(projectId, legalDocPayload);

      // 4. Save Rules
      const rulesPayload = {
        bookingRules: {
          minTokenAmount: Number(minToken) || 100000,
          tokenValidityDays: Number(tokenDays) || 7,
          cancellationPenaltyPct: Number(cancelPenalty) || 10,
        },
        paymentRules: {
          defaultGstRate: Number(gstRate) || 5,
          overdueInterestPctPerAnnum: Number(overdueInterest) || 12,
        },
      };
      await propertyService.updateProjectRules(projectId, rulesPayload);

      // Update Live Zustand Store & Theme Engine
      updateThemeColors(themePayload);
      updateBrandingData(brandingPayload);
      if (projectData) {
        await setActiveProject({
          ...projectData,
          name: name.trim() || projectData.name,
          branding: { ...projectData.branding, ...brandingPayload, logoUrl },
          theme: themePayload,
          receiptConfig: receiptPayload,
        });
      }

      showToast('Project configuration saved! Theme & branding updated across ERP.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'general', label: 'General', icon: 'information-circle-outline' },
    { key: 'branding', label: 'Branding & Logo', icon: 'image-outline' },
    { key: 'theme', label: 'Colors & Theme', icon: 'color-palette-outline' },
    { key: 'receipts', label: 'Receipt Builder', icon: 'receipt-outline' },
    { key: 'templates', label: 'Legal Docs', icon: 'document-text-outline' },
    { key: 'rules', label: 'Rules & Tariffs', icon: 'options-outline' },
  ];

  if (!projectId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="business-outline" size={48} color={colors.textMuted} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 12 }}>
          No Project Selected
        </Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 6, marginBottom: 20 }}>
          Please select a property project to configure its branding and document rules.
        </Text>
        <Button label="Go to Projects" onPress={() => router.push('/property/projects' as never)} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Project Configuration"
        subtitle={`${name || 'Project'} • Multi-Project ERP Settings`}
        right={
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: radius.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>Save</Text>
              </>
            )}
          </Pressable>
        }
      />

      {/* Tab Navigation Pill Bar */}
      <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: 8, gap: 8 }}>
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: radius.full,
                  backgroundColor: isSelected ? colors.primary : colors.surfaceAlt,
                  gap: 6,
                }}
              >
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={isSelected ? '#FFFFFF' : colors.textMuted}
                />
                <Text style={{ fontSize: 12.5, fontWeight: isSelected ? '700' : '500', color: isSelected ? '#FFFFFF' : colors.text }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ marginTop: 12, color: colors.textMuted, fontSize: 13 }}>Loading project configuration...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <Card style={{ padding: spacing.lg, gap: spacing.md }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                Project & Developer Identity
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: -8 }}>
                Official developer entity and compliance numbers printed on all receipts and legal deeds.
              </Text>

              <Input label="Project Name *" value={name} onChangeText={setName} placeholder="e.g. Santora Luxury Enclave" />
              <Input label="Project Short Name" value={shortName} onChangeText={setShortName} placeholder="e.g. Santora" />
              <Input label="Developer / Builder Legal Name *" value={developerName} onChangeText={setDeveloperName} placeholder="e.g. Santora Infracon LLP" />
              <Input label="Parent Company Name" value={companyName} onChangeText={setCompanyName} placeholder="e.g. Apex Real Estate Holdings" />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label="RERA Registration No. *" value={reraNumber} onChangeText={setReraNumber} placeholder="PR/GJ/AHMEDABAD/..." />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="GSTIN Number" value={gstNumber} onChangeText={setGstNumber} placeholder="24AAACT1234A1Z5" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label="Office Phone" value={phone} onChangeText={setPhone} placeholder="+91 98250 00000" keyboardType="phone-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Sales Email" value={email} onChangeText={setEmail} placeholder="sales@santora.in" keyboardType="email-address" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input label="Project Tagline" value={tagline} onChangeText={setTagline} placeholder="e.g. 2 BHK PODIUM HOMES" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input label="Legal Jurisdiction" value={jurisdiction} onChangeText={setJurisdiction} placeholder="e.g. Ahmedabad Jurisdiction" />
                </View>
              </View>

              <Input label="Official Website" value={website} onChangeText={setWebsite} placeholder="https://santora.in" />
              <Input label="Corporate Office Address" value={officeAddress} onChangeText={setOfficeAddress} placeholder="10th Floor, Apex Tower, SG Highway..." />
              <Input label="Site Location Address" value={siteAddress} onChangeText={setSiteAddress} placeholder="Opp. Iskcon Temple, Satellite..." />
            </Card>
          )}

          {/* TAB 2: BRANDING & LOGO */}
          {activeTab === 'branding' && (
            <Card style={{ padding: spacing.lg, gap: spacing.md }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                Project Logo Management
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: -8 }}>
                The uploaded logo is rendered on Mobile App Headers, Payment Receipts, Banakhat, and Dastavej documents.
              </Text>

              {/* Logo Preview Canvas */}
              <View
                style={{
                  backgroundColor: colors.surfaceAlt,
                  borderColor: colors.borderStrong,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: 24,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {logoUrl ? (
                  <View style={{ alignItems: 'center' }}>
                    <Image
                      source={{ uri: logoUrl }}
                      style={{ width: 220, height: 80, resizeMode: 'contain', marginBottom: 12 }}
                    />
                    <Badge label="Active Project Logo" tone="success" />
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Ionicons name="image-outline" size={48} color={colors.textFaint} />
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
                      No custom logo uploaded. Using company default.
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={logoUrl ? 'Replace Logo' : 'Upload Logo'}
                    icon="cloud-upload-outline"
                    onPress={() => void handleLogoUpload()}
                  />
                </View>
                {logoUrl ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Delete Logo"
                      variant="danger"
                      icon="trash-outline"
                      onPress={() => void handleLogoDelete()}
                    />
                  </View>
                ) : null}
              </View>

              <Text style={{ fontSize: 11.5, color: colors.textMuted }}>
                Supported Formats: Transparent PNG, SVG, WEBP, JPG. Recommended dimensions: 400x120px.
              </Text>
            </Card>
          )}

          {/* TAB 3: COLORS & THEME */}
          {activeTab === 'theme' && (
            <Card style={{ padding: spacing.lg, gap: spacing.md }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                Project Theming System
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: -8 }}>
                Select a preset or enter hex codes. The entire ERP mobile app & generated PDFs will dynamically skin to these colors.
              </Text>

              <ColorPickerInput
                primary={primary}
                secondary={secondary}
                accent={accent}
                success={success}
                warning={warning}
                onChange={(c) => {
                  setPrimary(c.primary);
                  if (c.secondary) setSecondary(c.secondary);
                  if (c.accent) setAccent(c.accent);
                  if (c.success) setSuccess(c.success);
                  if (c.warning) setWarning(c.warning);
                }}
              />
            </Card>
          )}

          {/* TAB 4: RECEIPT BUILDER */}
          {activeTab === 'receipts' && (
            <View style={{ gap: spacing.md }}>
              <Card style={{ padding: spacing.lg, gap: spacing.md }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                  Receipt Template Builder
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: -8 }}>
                  Toggle elements on or off. Changes reflect immediately in the Live Preview below.
                </Text>

                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13.5, color: colors.text, fontWeight: '600' }}>Show Project Logo</Text>
                    <Switch value={showLogo} onValueChange={setShowLogo} thumbColor="#fff" trackColor={{ true: primary }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13.5, color: colors.text, fontWeight: '600' }}>Show QR Code Verification</Text>
                    <Switch value={showQr} onValueChange={setShowQr} thumbColor="#fff" trackColor={{ true: primary }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13.5, color: colors.text, fontWeight: '600' }}>Show RERA Registration</Text>
                    <Switch value={showRera} onValueChange={setShowRera} thumbColor="#fff" trackColor={{ true: primary }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13.5, color: colors.text, fontWeight: '600' }}>Show GSTIN Number</Text>
                    <Switch value={showGst} onValueChange={setShowGst} thumbColor="#fff" trackColor={{ true: primary }} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13.5, color: colors.text, fontWeight: '600' }}>Show Customer Residence Address</Text>
                    <Switch value={showCustomerAddress} onValueChange={setShowCustomerAddress} thumbColor="#fff" trackColor={{ true: primary }} />
                  </View>
                </View>

                <Input
                  label="Watermark Text (Diagonal overlay)"
                  value={watermarkText}
                  onChangeText={setWatermarkText}
                  placeholder="e.g. SANTORA RESIDENCY"
                />

                <Input
                  label="Authorized Signatory Entity Title"
                  value={signatoryTitle}
                  onChangeText={setSignatoryTitle}
                  placeholder={`For ${developerName || name}`}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Input label="Receipt Tagline" value={tagline} onChangeText={setTagline} placeholder="e.g. 2 BHK PODIUM HOMES" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input label="Jurisdiction Footer" value={jurisdiction} onChangeText={setJurisdiction} placeholder="e.g. Ahmedabad Jurisdiction" />
                  </View>
                </View>
              </Card>

              {/* LIVE RECEIPT CANVAS PREVIEW */}
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 }}>
                  Live Receipt Canvas Preview (8.5 × 5.5 inches)
                </Text>
                <LiveReceiptCanvas
                  projectName={name}
                  developerName={developerName}
                  tagline={tagline}
                  jurisdiction={jurisdiction}
                  officeAddress={officeAddress}
                  phone={phone}
                  email={email}
                  authorizedSignatoryTitle={signatoryTitle}
                  reraNumber={reraNumber}
                  gstNumber={gstNumber}
                  logoUrl={logoUrl}
                  primaryColor={primary}
                  secondaryColor={secondary}
                  watermarkText={watermarkText}
                  showLogo={showLogo}
                  showQr={showQr}
                  showGst={showGst}
                  showRera={showRera}
                  showCustomerAddress={showCustomerAddress}
                  showBankDetails={showBankDetails}
                />
              </View>
            </View>
          )}

          {/* TAB 5: LEGAL DOCS & BANAKHAT */}
          {activeTab === 'templates' && (
            <View style={{ gap: spacing.md }}>
              {/* Card 1: Legal Recital & Registration Configurations */}
              <Card style={{ padding: spacing.lg, gap: spacing.md }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                  Banakhat & Dastavej Legal Recitals
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: -8 }}>
                  These recitals are merged directly into the 27-page Banakhat (Agreement of Sale) and 17-page Legal Dastavej (Sales Deed).
                </Text>

                <Input
                  label="Partnership Firm / Promoter Entity Name *"
                  value={partnershipFirmName}
                  onChangeText={setPartnershipFirmName}
                  placeholder="e.g. M/s RUDRA DEVELOPERS"
                />

                <Input
                  label="Managing Partners (Comma-separated) *"
                  value={managingPartners}
                  onChangeText={setManagingPartners}
                  placeholder="e.g. MANISHBHAI CHHAGANBHAI KAKADIYA, ASHISHKUMAR MANUBHAI PATEL"
                  multiline
                  numberOfLines={3}
                />

                <Input
                  label="Sub-Registrar Registration Office / Zone *"
                  value={subRegistrarOffice}
                  onChangeText={setSubRegistrarOffice}
                  placeholder="e.g. Sub-Registrar Gandhinagar-4 (Khoraj)"
                />

                <Input
                  label="Town Planning (T.P.) Scheme"
                  value={tpScheme}
                  onChangeText={setTpScheme}
                  placeholder="e.g. T.P. Scheme No. 64 (Tragad-Godhavi)"
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Revenue Survey Nos."
                      value={surveyNumbers}
                      onChangeText={setSurveyNumbers}
                      placeholder="Survey No. 518/1, 518/2"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Final Plot (F.P.) Nos."
                      value={finalPlotNumbers}
                      onChangeText={setFinalPlotNumbers}
                      placeholder="F.P. No. 128"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="City Survey No."
                      value={citySurveyNumbers}
                      onChangeText={setCitySurveyNumbers}
                      placeholder="City Survey No. 4321"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Input
                      label="Legal Jurisdiction"
                      value={jurisdiction}
                      onChangeText={setJurisdiction}
                      placeholder="Ahmedabad Jurisdiction"
                    />
                  </View>
                </View>

                <Button
                  label="Save Legal Recitals"
                  icon="shield-checkmark-outline"
                  onPress={async () => {
                    if (!projectId) return;
                    setSaving(true);
                    try {
                      const payload = {
                        partnershipFirmName: partnershipFirmName.trim() || undefined,
                        managingPartners: managingPartners.split(',').map((s) => s.trim()).filter(Boolean),
                        subRegistrarOffice: subRegistrarOffice.trim() || undefined,
                        tpScheme: tpScheme.trim() || undefined,
                        surveyNumbers: surveyNumbers.trim() || undefined,
                        finalPlotNumbers: finalPlotNumbers.trim() || undefined,
                        citySurveyNumbers: citySurveyNumbers.trim() || undefined,
                        projectTagline: tagline.trim() || undefined,
                        jurisdiction: jurisdiction.trim() || undefined,
                      };
                      await propertyService.updateLegalDocConfig(projectId, payload);
                      showToast('Legal doc recitals saved successfully!', 'success');
                    } catch (e: any) {
                      showToast(e?.message || 'Failed to save legal recitals', 'error');
                    } finally {
                      setSaving(false);
                    }
                  }}
                />
              </Card>

              {/* Card 2: Custom Clauses Editor */}
              <Card style={{ padding: spacing.lg, gap: spacing.md }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                  Custom Clauses & Variable Editor
                </Text>
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: -8 }}>
                  Inject customized bylaws, maintenance obligations, or parking rules into document annexures.
                </Text>

                {/* Template Switcher */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={() => setTemplateType('banakhat')}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: radius.md,
                      backgroundColor: templateType === 'banakhat' ? colors.primary : colors.surfaceAlt,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: templateType === 'banakhat' ? '#FFFFFF' : colors.text }}>
                      Banakhat (Sale Agreement)
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setTemplateType('dastavej')}
                    style={{
                      flex: 1,
                      padding: 10,
                      borderRadius: radius.md,
                      backgroundColor: templateType === 'dastavej' ? colors.primary : colors.surfaceAlt,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: templateType === 'dastavej' ? '#FFFFFF' : colors.text }}>
                      Dastavej (Conveyance Deed)
                    </Text>
                  </Pressable>
                </View>

              {/* Variable Chips Inserter */}
              <VariableChipSelector
                onInsert={(token) => {
                  setTemplateContent((prev) => `${prev} ${token}`);
                  showToast(`Inserted ${token}`);
                }}
              />

              <Input
                label="Custom Clauses & Body Template"
                value={templateContent}
                onChangeText={setTemplateContent}
                placeholder="Write custom bylaws, possession terms, and conditions using {{variables}}..."
                multiline
                numberOfLines={8}
                style={{ minHeight: 140, textAlignVertical: 'top' }}
              />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Save Template Clauses"
                      icon="save-outline"
                      onPress={() => {
                        showToast(`${templateType === 'banakhat' ? 'Banakhat' : 'Dastavej'} clauses saved!`);
                      }}
                    />
                  </View>
                </View>
              </Card>
            </View>
          )}

          {/* TAB 6: RULES & TARIFFS */}
          {activeTab === 'rules' && (
            <Card style={{ padding: spacing.lg, gap: spacing.md }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                Commercial Booking & Payment Rules
              </Text>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: -8 }}>
                Automated business policies applied across bookings, payment schedules, and overdue penalties.
              </Text>

              <Input
                label="Minimum Token Booking Amount (₹)"
                value={minToken}
                onChangeText={setMinToken}
                keyboardType="numeric"
                placeholder="100000"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Token Validity (Days)"
                    value={tokenDays}
                    onChangeText={setTokenDays}
                    keyboardType="numeric"
                    placeholder="7"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Cancellation Penalty (%)"
                    value={cancelPenalty}
                    onChangeText={setCancelPenalty}
                    keyboardType="numeric"
                    placeholder="10"
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Default GST Rate (%)"
                    value={gstRate}
                    onChangeText={setGstRate}
                    keyboardType="numeric"
                    placeholder="5"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Overdue Interest (% p.a.)"
                    value={overdueInterest}
                    onChangeText={setOverdueInterest}
                    keyboardType="numeric"
                    placeholder="12"
                  />
                </View>
              </View>
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}
