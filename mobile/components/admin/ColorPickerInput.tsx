import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/hooks/useTheme';

export interface ThemePreset {
  name: string;
  projectNameExample: string;
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
}

export const BUILDER_THEME_PRESETS: ThemePreset[] = [
  {
    name: 'Santora Terracotta',
    projectNameExample: 'Santora Luxury Enclave',
    primary: '#E8590C',
    secondary: '#17263B',
    accent: '#F59E0B',
    success: '#10B981',
    warning: '#D97706',
  },
  {
    name: 'Sky Heights Royal Blue',
    projectNameExample: 'Sky Heights Towers',
    primary: '#1E40AF',
    secondary: '#0F172A',
    accent: '#38BDF8',
    success: '#059669',
    warning: '#EA580C',
  },
  {
    name: 'Green Valley Eco Emerald',
    projectNameExample: 'Green Valley Estates',
    primary: '#059669',
    secondary: '#064E3B',
    accent: '#84CC16',
    success: '#10B981',
    warning: '#D97706',
  },
  {
    name: 'Regal Gold & Onyx',
    projectNameExample: 'The Imperial Monarch',
    primary: '#D97706',
    secondary: '#18181B',
    accent: '#FBBF24',
    success: '#16A34A',
    warning: '#F59E0B',
  },
  {
    name: 'Crimson Modern High-Rise',
    projectNameExample: 'Grand Central Residences',
    primary: '#DC2626',
    secondary: '#1C1917',
    accent: '#F97316',
    success: '#15803D',
    warning: '#B45309',
  },
];

interface Props {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  onChange: (colors: { primary: string; secondary?: string; accent?: string; success?: string; warning?: string }) => void;
}

export function ColorPickerInput({ primary, secondary, accent, success, warning, onChange }: Props) {
  const { colors, radius, spacing } = useTheme();

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
        1-Click Theme Presets
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BUILDER_THEME_PRESETS.map((p) => {
          const isSelected = p.primary.toLowerCase() === primary.toLowerCase();
          return (
            <Pressable
              key={p.name}
              onPress={() => onChange({
                primary: p.primary,
                secondary: p.secondary,
                accent: p.accent,
                success: p.success,
                warning: p.warning,
              })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: isSelected ? colors.surfaceAlt : colors.surface,
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 2 : 1,
                borderRadius: radius.md,
                paddingHorizontal: 10,
                paddingVertical: 7,
                gap: 6,
              }}
            >
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.primary }} />
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: p.secondary }} />
              <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '500', color: colors.text }}>
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: spacing.xs }}>
        Custom Color Codes (HEX)
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: primary || '#ccc', marginRight: 6 }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Primary Color</Text>
          </View>
          <Input
            value={primary}
            onChangeText={(val) => onChange({ primary: val, secondary, accent, success, warning })}
            placeholder="#E8590C"
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: secondary || '#ccc', marginRight: 6 }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Secondary Color</Text>
          </View>
          <Input
            value={secondary}
            onChangeText={(val) => onChange({ primary, secondary: val, accent, success, warning })}
            placeholder="#17263B"
          />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: accent || '#ccc', marginRight: 6 }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Accent</Text>
          </View>
          <Input
            value={accent}
            onChangeText={(val) => onChange({ primary, secondary, accent: val, success, warning })}
            placeholder="#F59E0B"
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: success || '#ccc', marginRight: 6 }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Success</Text>
          </View>
          <Input
            value={success}
            onChangeText={(val) => onChange({ primary, secondary, accent, success: val, warning })}
            placeholder="#10B981"
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: warning || '#ccc', marginRight: 6 }} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textMuted }}>Warning</Text>
          </View>
          <Input
            value={warning}
            onChangeText={(val) => onChange({ primary, secondary, accent, success, warning: val })}
            placeholder="#D97706"
          />
        </View>
      </View>
    </View>
  );
}
