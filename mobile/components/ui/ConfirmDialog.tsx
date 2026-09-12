import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'warning';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Centered confirmation dialog for destructive actions
 * (delete project / expense / worker / material / report / contact).
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors, radius, spacing } = useTheme();
  const toneColor = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.primary;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={busy ? undefined : onCancel}>
        <Pressable
          onPress={() => {}}
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              padding: spacing.xl,
              marginHorizontal: spacing.xl,
            },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800', textAlign: 'center' }}>
            {title}
          </Text>
          {message ? (
            <Text
              style={{
                color: colors.textMuted,
                fontSize: 13.5,
                lineHeight: 20,
                textAlign: 'center',
                marginTop: spacing.sm,
              }}
            >
              {message}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={[
                styles.btn,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: 14.5 }}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onConfirm}
              style={[
                styles.btn,
                {
                  backgroundColor: toneColor,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14.5 }}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
});
