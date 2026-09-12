import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FormModalShell } from '@/components/erp/FormModalShell';
import { FormInput } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useDataVersion, DATA_KEYS } from '@/stores/dataVersion';
import { poService, vendorService } from '@/services/erpService';
import { projectService } from '@/services/projectService';
import { formatCompactINR } from '@/lib/format';

interface ItemRow {
  materialName: string;
  quantity: string;
  rate: string;
}

export default function PurchaseOrderModal() {
  const theme = useTheme();
  const showToast = useUIStore((s) => s.showToast);
  const bump = useDataVersion((s) => s.bump);
  const router = useRouter();
  const { colors } = theme;
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<{ label: string; value: string }[]>([]);
  const [vendors, setVendors] = useState<{ label: string; value: string }[]>([]);
  const [projectId, setProjectId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ materialName: '', quantity: '', rate: '' }]);

  useEffect(() => {
    projectService
      .listProjects({})
      .then((list) => setProjects(list.items.map((p) => ({ label: p.name, value: p._id }))))
      .catch(() => {});
    vendorService
      .options()
      .then((list) => setVendors(list.map((v) => ({ label: v.name, value: v._id }))))
      .catch(() => {});
  }, []);

  const total = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.rate) || 0),
    0,
  );

  const updateItem = (index: number, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const onSubmit = async () => {
    if (!projectId) {
      showToast('Choose a project', 'error');
      return;
    }
    if (!vendorId) {
      showToast('Choose a vendor', 'error');
      return;
    }
    const cleaned = items
      .filter((item) => item.materialName.trim())
      .map((item) => ({
        materialName: item.materialName.trim(),
        quantity: Number(item.quantity),
        rate: Number(item.rate),
      }));
    if (cleaned.length === 0 || cleaned.some((i) => !i.quantity || i.rate === undefined)) {
      showToast('Fill in material, quantity and rate rows', 'error');
      return;
    }
    setSaving(true);
    try {
      await poService.create({ projectId, vendorId, items: cleaned, submitForApproval: true });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('PO created — sent for approval');
      bump(DATA_KEYS.purchaseOrders);
      bump(DATA_KEYS.approvals);
      bump(DATA_KEYS.vendors);
      router.back();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create PO', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalShell
      title="New purchase order"
      subtitle="Requirement → Approval → Delivery"
      submitting={saving}
      submitLabel={`Create PO${total > 0 ? ` · ${formatCompactINR(total)}` : ''}`}
      onSubmit={onSubmit}
    >
      <SelectField
        label="Project"
        options={projects}
        value={projectId}
        onChange={(v) => setProjectId(v)}
        required
      />
      <SelectField
        label="Vendor"
        placeholder={vendors.length ? 'Choose a vendor' : 'Loading vendors…'}
        options={vendors}
        value={vendorId}
        onChange={(v) => setVendorId(v)}
        required
      />

      <View style={{ gap: 10 }}>
        {items.map((item, index) => (
          <View key={String(index)} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 2.2 }}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                Material {items.length > 1 ? index + 1 : ''}
              </Text>
              <TextInputBar
                value={item.materialName}
                onChangeText={(t) => updateItem(index, { materialName: t })}
                placeholder="e.g. OPC Cement"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Qty</Text>
              <TextInputBar value={item.quantity} onChangeText={(t) => updateItem(index, { quantity: t })} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Rate ₹</Text>
              <TextInputBar value={item.rate} onChangeText={(t) => updateItem(index, { rate: t })} keyboardType="numeric" />
            </View>
            {items.length > 1 ? (
              <Pressable onPress={() => setItems((prev) => prev.filter((_, i) => i !== index))} hitSlop={8} accessibilityLabel="Remove row">
                <Ionicons name="close-circle" size={20} color={colors.danger} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable
          onPress={() => setItems((prev) => [...prev, { materialName: '', quantity: '', rate: '' }])}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Add another material</Text>
        </Pressable>
      </View>
    </FormModalShell>
  );
}

function TextInputBar({
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  const theme = useTheme();
  const { colors } = theme;
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderRadius: 9,
        paddingHorizontal: 11,
        paddingVertical: 9,
        marginTop: 4,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType ?? 'default'}
        placeholderTextColor={colors.textFaint}
        style={{ color: colors.text, fontSize: 14, paddingVertical: 0 }}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  fieldLabel: { fontSize: 12, fontWeight: '700' },
});

