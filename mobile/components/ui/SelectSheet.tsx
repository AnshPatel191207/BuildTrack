import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { BottomSheet } from './BottomSheet';

export interface Option {
  label: string;
  value: string;
  description?: string;
}

interface SelectProps {
  visible: boolean;
  onClose: () => void;
  options: Option[];
  value?: string | null;
  onSelect: (value: string) => void;
  title?: string;
  /** Optional extra action row, e.g. "Add new worker". */
  actionLabel?: string;
  onAction?: () => void;
}

/** Single-choice picker presented as a bottom sheet. */
export function SelectSheet({
  visible,
  onClose,
  options,
  value,
  onSelect,
  title = 'Select an option',
  actionLabel,
  onAction,
}: SelectProps) {
  const { colors, spacing } = useTheme();

  const handlePick = (v: string) => {
    onSelect(v);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} scroll>
      <View style={{ paddingBottom: spacing.md }}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => handlePick(opt.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 13,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: selected ? colors.primary : colors.text,
                    fontSize: 15,
                    fontWeight: selected ? '700' : '500',
                  }}
                >
                  {opt.label}
                </Text>
                {opt.description ? (
                  <Text style={{ color: colors.textFaint, fontSize: 12.5, marginTop: 2 }}>
                    {opt.description}
                  </Text>
                ) : null}
              </View>
              {selected ? (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              ) : null}
            </Pressable>
          );
        })}
        {actionLabel && onAction ? (
          <Pressable
            onPress={() => {
              onClose();
              onAction();
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingHorizontal: spacing.lg,
              paddingVertical: 14,
              opacity: pressed ? 0.7 : 1,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
              marginTop: 4,
            })}
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
