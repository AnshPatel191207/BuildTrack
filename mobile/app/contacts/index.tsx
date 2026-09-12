import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Avatar } from '@/components/ui/Avatar';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { PermissionState } from '@/components/ui/PermissionState';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores/uiStore';
import { useContacts, type ContactPerson } from '@/hooks/useContacts';

/**
 * Device phonebook browser. One-tap "Add as worker" hands a contact's
 * name + phone to the worker form so site crew can be onboarded fast.
 */
export default function ContactsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const showToast = useUIStore((s) => s.showToast);
  const { colors, spacing, radius } = theme;
  const contactsApi = useContacts();

  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contactsApi.contacts;
    return contactsApi.contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q),
    );
  }, [contactsApi.contacts, search]);

  const addToWorkers = (contact: ContactPerson) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: '/modal/worker',
      params: {
        prefillName: contact.name,
        ...(contact.phone ? { prefillPhone: contact.phone } : {}),
      },
    });
  };

  const callContact = async (phone: string | null) => {
    if (!phone) return;
    try {
      const { Linking } = await import('react-native');
      await Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`);
    } catch {
      showToast('Could not open the dialer', 'error');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Contacts" subtitle="Import workers from your phone book" onBack={() => router.back()} />
      <OfflineBanner />

      {contactsApi.granted === false ? (
        <PermissionState area="contacts" onRequest={() => void contactsApi.reload()} />
      ) : (
        <>
          <View style={{ paddingHorizontal: spacing.lg }}>
            <SearchBar value={search} onChangeText={setSearch} placeholder="Search name or number" />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(c) => `${c.id}-${c.name}`}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: insets.bottom + 40,
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              contactsApi.loading ? (
                <View style={{ paddingTop: 14, gap: 10 }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} height={60} style={{ borderRadius: radius.md }} />
                  ))}
                </View>
              ) : contactsApi.error ? (
                <ErrorState message={contactsApi.error} onRetry={() => void contactsApi.reload()} />
              ) : (
                <EmptyState
                  icon="people-outline"
                  title={search ? 'No matching contacts' : 'No contacts found'}
                  message={search ? 'Try a different search.' : 'Your phone book looks empty.'}
                />
              )
            }
            renderItem={({ item }) => (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: colors.border,
                  padding: 11,
                  marginTop: 8,
                  gap: 10,
                }}
              >
                <Avatar name={item.name} size={40} tone="navy" />
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text numberOfLines={1} style={{ color: colors.text, fontSize: 14.5, fontWeight: '700' }}>
                    {item.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: 12.5, marginTop: 2 }}>
                    {item.phone ?? 'No number'}
                  </Text>
                </View>
                {item.phone ? (
                  <Pressable
                    onPress={() => void callContact(item.phone)}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${item.name}`}
                    hitSlop={6}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.successSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="call-outline" size={17} color={colors.success} />
                  </Pressable>
                ) : null}
                <Button label="Add" size="sm" variant="secondary" onPress={() => addToWorkers(item)} />
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}
