import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { SelectField } from '@/components/ui/SelectField';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore, type ThemeMode } from '@/stores/uiStore';
import { useSyncStore } from '@/stores/syncStore';
import { useNetworkStore } from '@/stores/networkStore';
import { authService } from '@/services/authService';
import { companyService } from '@/services/companyService';

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useUIStore((s) => s.showToast);
  const themeMode = useUIStore((s) => s.themeMode);
  const setThemeMode = useUIStore((s) => s.setThemeMode);
  const notifPrefs = useUIStore((s) => s.notifPrefs);
  const setNotifPref = useUIStore((s) => s.setNotifPref);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const flushing = useSyncStore((s) => s.flushing);
  const refreshCount = useSyncStore((s) => s.refreshCount);
  const flushOutbox = useSyncStore((s) => s.flushOutbox);
  const discardAll = useSyncStore((s) => s.discardAll);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { colors, spacing, radius } = theme;

  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    void refreshCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profilePhone, setProfilePhone] = useState(user?.phone ?? '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  if (!user) return null;

  const companyName =
    typeof user.companyId === 'object' && user.companyId ? user.companyId.name : null;

  const saveProfile = async () => {
    if (profileName.trim().length < 2) {
      showToast('Enter your full name', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await authService.updateProfile({
        name: profileName.trim(),
        phone: profilePhone.trim() || undefined,
      });
      setUser(updated);
      setEditProfileOpen(false);
      showToast('Profile updated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!currentPw || !newPw || newPw.length < 8) {
      showToast('New password needs at least 8 characters', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      showToast("Passwords don't match", 'error');
      return;
    }
    setChangingPw(true);
    try {
      await authService.changePassword(currentPw, newPw);
      setChangePwOpen(false);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast('Password changed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not change password', 'error');
    } finally {
      setChangingPw(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You will need your password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void logout().then(() => router.replace('/(auth)/login'));
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Profile" large />
      <OfflineBanner />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}>
        {/* Identity card */}
        <View
          style={{
            backgroundColor: colors.navy,
            marginHorizontal: spacing.lg,
            borderRadius: radius.lg,
            padding: 18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={user.name} size={54} tone="primary" />
            <View style={{ flex: 1, marginLeft: 13 }}>
              <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
                {user.name}
              </Text>
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 }}>
                {user.email}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 }}>
            <Badge label={user.role[0].toUpperCase() + user.role.slice(1)} tone="orange" />
            {companyName ? (
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5, flexShrink: 1 }}>
                {companyName}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Actions */}
        <SectionLabel label="Account" />
        <ActionRow icon="person-outline" label="Edit profile" onPress={() => setEditProfileOpen(true)} />
        <ActionRow icon="key-outline" label="Change password" onPress={() => setChangePwOpen(true)} />
        <ActionRow
          icon="people-outline"
          label={user.role === 'owner' ? 'Team & roles' : 'Team'}
          onPress={() => router.push('/team')}
        />
        <ActionRow
          icon="business-outline"
          label="Company details"
          onPress={() => {
            if (typeof user.companyId === 'object' && user.companyId) {
              router.push({
                pathname: '/company/edit',
                params: { id: user.companyId._id },
              });
            } else {
              showToast('No company found on your account', 'info');
            }
          }}
        />

        <SectionLabel label="Appearance" />
        <View style={{ paddingHorizontal: spacing.lg }}>
          <SelectField
            label="Theme"
            options={[
              { label: 'Follow system', value: 'system' },
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
            ]}
            value={themeMode}
            onChange={(v) => setThemeMode(v as ThemeMode)}
          />
        </View>

        {/* Offline & sync */}
        <SectionLabel label="Offline & sync" />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            marginHorizontal: spacing.lg,
            marginBottom: 8,
            paddingVertical: 14,
            paddingHorizontal: spacing.lg + 4,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="cloud-offline-outline" size={19} color={pendingCount > 0 ? colors.warning : colors.primary} />
            <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '600', marginLeft: 12, flex: 1 }}>
              Queued changes
            </Text>
            {pendingCount > 0 ? (
              <Badge label={`${pendingCount} pending`} tone="warning" />
            ) : (
              <Badge label="All synced" tone="success" />
            )}
          </View>
          <Text style={{ color: colors.textFaint, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
            Work you save without internet is stored on this phone and synced automatically when
            you're back online{isOnline ? '' : ' — currently offline'}.
          </Text>
          {pendingCount > 0 ? (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button
                label={flushing ? 'Syncing…' : 'Sync now'}
                size="sm"
                disabled={!isOnline || flushing}
                loading={flushing}
                onPress={() => {
                  void flushOutbox().then((ok) => {
                    if (ok) showToast('All queued changes synced');
                  });
                }}
                style={{ flex: 1 }}
              />
              <Button
                label="Discard"
                size="sm"
                variant="secondary"
                onPress={() => setDiscardOpen(true)}
                style={{ flex: 1 }}
              />
            </View>
          ) : null}
        </View>

        {/* Notification preferences */}
        <SectionLabel label="Notifications" />
        <PrefRow
          icon="sunny-outline"
          label="Daily report reminder"
          description="Evening nudge to log the day's progress"
          value={notifPrefs.dailyReportReminder}
          onChange={(v) => setNotifPref('dailyReportReminder', v)}
        />
        <PrefRow
          icon="wallet-outline"
          label="Expense alerts"
          description="Confirmations when expenses are logged"
          value={notifPrefs.expenseAlerts}
          onChange={(v) => setNotifPref('expenseAlerts', v)}
        />
        <PrefRow
          icon="cube-outline"
          label="Low stock alerts"
          description="Warn when materials fall below reorder level"
          value={notifPrefs.lowStockAlerts}
          onChange={(v) => setNotifPref('lowStockAlerts', v)}
        />

        <SectionLabel label="About" />
        <ActionRow icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
        <ActionRow
          icon="information-circle-outline"
          label="About BuildTrack"
          onPress={() =>
            showToast('BuildTrack v1.0 · Built for Indian construction sites', 'info')
          }
        />

        <View style={{ paddingHorizontal: spacing.lg, marginTop: 28 }}>
          <Button label="Log out" variant="danger" onPress={confirmLogout} loading={false} />
          <Text style={{ textAlign: 'center', color: colors.textFaint, fontSize: 11.5, marginTop: 14 }}>
            BuildTrack · v1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Edit profile sheet */}
      <BottomSheet visible={editProfileOpen} onClose={() => setEditProfileOpen(false)} title="Edit profile">
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
          <FormInputFree label="Full name" value={profileName} onChangeText={setProfileName} placeholder="Your name" autoCapitalize="words" />
          <FormInputFree
            label="Phone"
            value={profilePhone}
            onChangeText={setProfilePhone}
            placeholder="9876543210"
            keyboardType="phone-pad"
          />
          <Button label={savingProfile ? 'Saving…' : 'Save changes'} onPress={() => void saveProfile()} disabled={savingProfile} />
        </View>
      </BottomSheet>

      {/* Change password sheet */}
      <BottomSheet visible={changePwOpen} onClose={() => setChangePwOpen(false)} title="Change password">
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }}>
          <FormInputFree label="Current password" value={currentPw} onChangeText={setCurrentPw} placeholder="••••••••" secureTextEntry />
          <FormInputFree label="New password" value={newPw} onChangeText={setNewPw} placeholder="At least 8 characters" secureTextEntry />
          <FormInputFree label="Confirm new password" value={confirmPw} onChangeText={setConfirmPw} placeholder="Repeat new password" secureTextEntry />
          <Button
            label={changingPw ? 'Updating…' : 'Update password'}
            onPress={() => void changePassword()}
            disabled={changingPw}
            loading={changingPw}
          />
        </View>
      </BottomSheet>

      {/* Discard queued changes */}
      <ConfirmDialog
        visible={discardOpen}
        title={`Discard ${pendingCount} queued change${pendingCount === 1 ? '' : 's'}?`}
        message="These edits were made offline and haven't reached the server yet. They will be lost."
        confirmLabel="Discard"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          void discardAll().then(() => {
            setDiscardOpen(false);
            showToast('Queued changes discarded');
          });
        }}
      />
    </View>
  );
}

function PrefRow({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        paddingVertical: 12,
        paddingHorizontal: spacing.lg + 4,
        marginHorizontal: spacing.lg,
        marginBottom: 8,
      }}
    >
      <Ionicons name={icon} size={19} color={colors.primary} />
      <View style={{ flex: 1, marginLeft: 12, marginRight: 10 }}>
        <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: colors.textFaint, fontSize: 11.5, marginTop: 2 }}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceAlt, true: `${colors.primary}55` }}
        thumbColor={value ? colors.primary : colors.textFaint}
        accessibilityLabel={label}
      />
    </View>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { colors, spacing } = useTheme();
  return (
    <Text
      style={{
        color: colors.textFaint,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        paddingHorizontal: spacing.lg,
        marginTop: 24,
        marginBottom: 8,
      }}
    >
      {label}
    </Text>
  );
}

function ActionRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress?: () => void }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        paddingVertical: 14,
        paddingHorizontal: spacing.lg + 4,
        marginHorizontal: spacing.lg,
        marginBottom: 8,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Ionicons name={icon} size={19} color={colors.primary} />
      <Text style={{ color: colors.text, fontSize: 14.5, fontWeight: '600', marginLeft: 12, flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </Pressable>
  );
}

/** Lightweight input for sheets that don't need full RHF wiring. */
function FormInputFree(props: React.ComponentProps<typeof Input>) {
  return <Input {...props} />;
}
