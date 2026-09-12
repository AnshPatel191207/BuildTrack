import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { SelectSheet, type Option } from './SelectSheet';

interface SelectFieldProps {
  label?: string;
  placeholder?: string;
  options: Option[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

/** Form field that opens a SelectSheet — the app-wide replacement for native pickers. */
export function SelectField({
  label,
  placeholder = 'Select…',
  options,
  value,
  onChange,
  error,
  hint,
  required,
  disabled,
  actionLabel,
  onAction,
}: SelectFieldProps) {
  const { colors, radius, spacing } = useTheme();
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? null,
    [options, value],
  );

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs + 2 }}>
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <Pressable
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select'}
        accessibilityState={{ disabled }}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.borderStrong,
            borderRadius: radius.md,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            fontSize: 15,
            color: selectedLabel ? colors.text : colors.textFaint,
          }}
        >
          {selectedLabel ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '500', marginTop: spacing.xs }}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: spacing.xs }}>
          {hint}
        </Text>
      ) : null}
      <SelectSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={label ?? placeholder}
        options={options}
        value={value ?? undefined}
        onSelect={onChange}
        actionLabel={actionLabel}
        onAction={onAction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    gap: 8,
  },
});
