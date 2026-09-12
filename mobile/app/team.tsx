import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { SelectField } from '@/components/ui/SelectField';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { companyService } from '@/services/companyService';
import type { User, UserRole } from '@/types';

const ROLE_OPTIONS = [
  { label: 'Project Manager — runs sites, approvals', value: 'project_manager' },
  { label: 'Site Engineer — site operations', value: 'site_engineer' },
  { label: 'Accountant — finance & payables', value: 'accountant' },
  { label: 'Sales Manager — CRM & bookings', value: 'sales_manager' },
  { label: 'Supervisor — attendance & crew', value: 'supervisor' },
  { label: 'Worker — view own data', value: 'worker' },
];

export default function TeamScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const { colors, spacing, radius } = theme;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePhone, setInvitePhone] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('site_engineer');
  const [inviting, setInviting] = useState(false);

  const isOwner = me?.role === 'owner';
  const canManage = isOwner || me?.role === 'manager' || me?.role === 'project_manager';

  const { data, loading, error, offlineData, refreshing, refresh, reload } =
    useResource(() => companyService.listTeam(), []);

  const members = data ?? [];

  const sendInvite = async () => {
    if (inviteName.trim().length < 2 || !inviteEmail.includes('@') || invitePassword.length < 8) {
      showToast('Name, valid email and 8+ char password required', 'error');
      return;
    }
    setInviting(true);
    try {
      await companyService.inviteTeamMember({
        name: inviteName.trim(),
        email: inviteEmail.toLowerCase().trim(),
        phone: invitePhone.trim() || undefined,
        password: invitePassword,
        role: inviteRole as UserRole,
        assignedProjects: [],
      });
      showToast(`${inviteName.trim()} added to the team`);
      setInviteOpen(false);
      setInviteName('');
      setInviteEmail('');
      setInvitePhone('');
      setInvitePassword('');
      void reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add member', 'error');
    } finally {
      setInviting(false);
    }
  };

  const changeRole = (member: User) => {
    if (!canManage) return;
    Alert.alert(`Change role for ${member.name}`, undefined, [
      ...ROLE_OPTIONS.map((r) => ({
        text: r.label.split('—')[0].trim(),
        onPress: () => {
          companyService
            .updateTeamMember(member._id, { role: r.value as UserRole })
            .then(() => {
              showToast(`${member.name} is now a ${r.value}`);
              void reload();
            })
            .catch((err) =>
              showToast(err instanceof Error ? err.message : 'Could not update role', 'error'),
            );
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const removeMember = (member: User) => {
    if (!isOwner) return;
    if (member._id === me?._id) {
      showToast("You can't remove yourself", 'info');
      return;
    }
    Alert.alert(
      `Remove ${member.name}?`,
      'They will immediately lose access to BuildTrack.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            companyService
              .updateTeamMember(member._id, { isActive: false })
              .then(() => {
                showToast(`${member.name} removed`);
                void reload();
              })
              .catch((err) =>
                showToast(err instanceof Error ? err.message : 'Could not remove member', 'error'),
              );
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Team" onBack={() => router.back()} />
      <FlatList
        data={members}
        keyExtractor={(m) => m._id}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              {members.length} member{members.length === 1 ? '' : 's'} in your company
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: 10 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={64} style={{ borderRadius: radius.md }} />
              ))}
            </View>
          ) : error && !data ? (
            <ErrorState message={error} offline={offlineData} onRetry={() => void reload()} />
          ) : (
            <EmptyState icon="people-outline" title="No team members yet" message="Add your first teammate below." />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => changeRole(item)}
            accessibilityRole="button"
            accessibilityLabel={`Member ${item.name}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
              padding: 12,
              marginBottom: 8,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Avatar name={item.name} size={42} />
            <View style={{ flex: 1, marginLeft: 11 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: '700', flexShrink: 1 }}>
                  {item.name}
                  {item._id === me?._id ? ' (you)' : ''}
                </Text>
                {!item.isActive ? <Badge label="Disabled" tone="danger" /> : null}
              </View>
              <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12.5, marginTop: 2 }}>
                {item.email}
              </Text>
            </View>
            <Badge label={item.role[0].toUpperCase() + item.role.slice(1)} tone="orange" />
            {isOwner && item._id !== me?._id && item.role !== 'owner' ? (
              <Pressable onPress={() => removeMember(item)} hitSlop={10} accessibilityLabel={`Remove ${item.name}`}>
                <Ionicons name="remove-circle-outline" size={22} color={colors.danger} style={{ marginLeft: 8 }} />
              </Pressable>
            ) : null}
          </Pressable>
        )}
      />

      {canManage ? (
        <View style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + 20 }}>
          <Button
            label="Add team member"
            size="lg"
            icon={<Ionicons name="person-add" size={18} color={colors.onPrimary} />}
            onPress={() => setInviteOpen(true)}
          />
        </View>
      ) : null}

      <BottomSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} title="Add a team member" scroll>
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md }}>
          <Input label="Full name" value={inviteName} onChangeText={setInviteName} placeholder="e.g. Amit Patel" autoCapitalize="words" required />
          <Input
            label="Work email"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="amit@company.com"
            keyboardType="email-address"
            autoCapitalize="none"
            required
          />
          <Input label="Phone (optional)" value={invitePhone} onChangeText={setInvitePhone} placeholder="9876543210" keyboardType="phone-pad" />
          <Input
            label="Temporary password"
            value={invitePassword}
            onChangeText={setInvitePassword}
            placeholder="Min 8 characters"
            secureTextEntry
            hint="Share this with them privately; they should change it after first login."
            required
          />
          <SelectField
            label="Role"
            options={ROLE_OPTIONS}
            value={inviteRole}
            onChange={setInviteRole}
            required
          />
          <Button label={inviting ? 'Adding…' : 'Add to team'} loading={inviting} onPress={() => void sendInvite()} />
        </View>
      </BottomSheet>
    </View>
  );
}


