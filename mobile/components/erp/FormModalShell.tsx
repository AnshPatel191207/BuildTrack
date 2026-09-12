import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';

interface FormModalShellProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  submitting?: boolean;
  submitLabel: string;
  deleteLabel?: string;
  onDelete?: () => void;
  onSubmit?: () => void;
  children: React.ReactNode;
}

/** Shared chrome for ERP create/edit modal screens. */
export function FormModalShell({
  title,
  subtitle,
  loading,
  submitting,
  submitLabel,
  deleteLabel,
  onDelete,
  onSubmit,
  children,
}: FormModalShellProps) {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing } = theme;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView bounces={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <ScreenHeader title={title} subtitle={subtitle} onBack={() => router.back()} />
        {loading ? (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={48} style={{ borderRadius: 10 }} />
            ))}
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}>
            <View style={{ gap: spacing.md }}>{children}</View>
            {onSubmit ? (
              <Button
                label={submitLabel}
                size="lg"
                loading={submitting}
                disabled={submitting}
                onPress={onSubmit}
                style={{ marginTop: spacing.md }}
              />
            ) : null}
            {onDelete ? (
              <Button label={deleteLabel ?? 'Delete'} variant="ghost" onPress={onDelete} />
            ) : null}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

