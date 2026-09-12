import React, { useState } from 'react';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type RegisterOptions,
} from 'react-hook-form';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface InputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  secureTextEntry?: boolean | undefined;
  prefix?: string;
}

export function Input({
  label,
  error,
  hint,
  required,
  secureTextEntry,
  prefix,
  style,
  ...rest
}: InputProps) {
  const { colors, spacing, radius } = useTheme();
  const [focused, setFocused] = useState(false);
  const [obscured, setObscured] = useState(Boolean(secureTextEntry));

  return (
    <View style={styles.container}>
      {label ? (
        <Text
          accessibilityLabel={label}
          style={[styles.label, { color: colors.textMuted, marginBottom: spacing.xs + 2 }]}
        >
          {label}
          {required ? <Text style={{ color: colors.danger }}> *</Text> : null}
        </Text>
      ) : null}
      <View
        style={[
          styles.fieldRow,
          {
            borderColor: error ? colors.danger : focused ? colors.primary : colors.borderStrong,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
          },
          focused && !error && { borderWidth: 1.5 },
        ]}
      >
        {prefix ? (
          <Text style={{ color: colors.textMuted, fontSize: 15, marginRight: 6 }}>{prefix}</Text>
        ) : null}
        <TextInput
          {...rest}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          secureTextEntry={obscured}
          placeholderTextColor={colors.textFaint}
          style={[
            styles.input,
            { color: colors.text },
            style as TextStyle,
          ]}
        />
        {secureTextEntry ? (
          <Pressable
            onPress={() => setObscured((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={obscured ? 'Show password' : 'Hide password'}
            hitSlop={10}
          >
            <Ionicons
              name={obscured ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.errorText, { color: colors.danger, marginTop: spacing.xs }]}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: spacing.xs }}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** Controlled Input wired to react-hook-form. */
export function FormInput<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  rules,
  ...inputProps
}: InputProps & {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  rules?: RegisterOptions<TFieldValues>;
}) {
  return (
    <Controller<TFieldValues>
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <Input
          {...inputProps}
          value={value == null ? '' : String(value)}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error?.message}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {},
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 12,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
