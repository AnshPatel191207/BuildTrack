import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View, Pressable, Modal, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback';
import { useTheme } from '@/hooks/useTheme';
import { useResource } from '@/hooks/useResource';
import { propertyService } from '@/services/propertyService';
import { showToast } from '@/components/ui/Toast';
import type { PropertyCustomer } from '@/types';

export default function PropertyCustomersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors, spacing, radius } = theme;

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [address, setAddress] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');

  const {
    data: customers,
    loading,
    error,
    refreshing,
    refresh,
    reload,
  } = useResource<PropertyCustomer[]>(
    () =>
      propertyService.listCustomers({
        search: search.trim() || undefined,
        stage: stageFilter !== 'all' ? stageFilter : undefined,
      }),
    [search, stageFilter],
  );

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Customer full name is required', 'error');
      return;
    }
    if (!phone.trim()) {
      showToast('Contact phone number is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await propertyService.createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        alternatePhone: alternatePhone.trim() || undefined,
        email: email.trim() || undefined,
        pan: panNumber.trim().toUpperCase() || undefined,
        aadhaar: aadhaarNumber.trim() || undefined,
        address: address.trim() || undefined,
        nominee: nomineeName.trim()
          ? {
              name: nomineeName.trim(),
              relation: nomineeRelation.trim() || undefined,
            }
          : undefined,
      });
      showToast('Customer profile created', 'success');
      setModalOpen(false);
      setName('');
      setPhone('');
      setAlternatePhone('');
      setEmail('');
      setPanNumber('');
      setAadhaarNumber('');
      setAddress('');
      setNomineeName('');
      setNomineeRelation('');
      void reload();
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to create customer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStageBadge = (stage?: string) => {
    switch (stage) {
      case 'lead':
      case 'inquiry':
        return <Badge tone="neutral" label="Inquiry" />;
      case 'active':
      case 'visit':
      case 'negotiation':
        return <Badge tone="info" label="Active" />;
      case 'booked':
      case 'booking':
        return <Badge tone="success" label="Booked" />;
      case 'completed':
      case 'possession':
        return <Badge tone="success" label="Possession" />;
      default:
        return <Badge tone="neutral" label={stage || 'Customer'} />;
    }
  };

  const handleDeleteCustomer = (e: any, customer: PropertyCustomer) => {
    e?.stopPropagation?.();
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete customer "${customer.name}"?\n\nAny units booked or purchased by this customer will be released back to available inventory.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Customer',
          style: 'destructive',
          onPress: async () => {
            try {
              await propertyService.deleteCustomer(customer._id);
              showToast('Customer deleted and assigned units released to available', 'success');
              void reload();
            } catch (err: any) {
              showToast(err?.response?.data?.message || 'Failed to delete customer', 'error');
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Customer Directory"
        subtitle="Real estate buyers, investors & lead profiles"
        large
        right={
          <Pressable
            onPress={() => setModalOpen(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.primary,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: radius.md,
            }}
          >
            <Ionicons name="person-add" size={16} color="#fff" style={{ marginRight: 4 }} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Add Buyer</Text>
          </Pressable>
        }
      />
      <OfflineBanner />

      {/* Filter & Search Bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: 12, gap: 10 }}>
        <Input
          placeholder="Search by name, phone, email, PAN..."
          value={search}
          onChangeText={setSearch}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {['all', 'lead', 'active', 'booked', 'completed'].map((st) => {
            const active = stageFilter === st;
            return (
              <Pressable
                key={st}
                onPress={() => setStageFilter(st)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: radius.full,
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: active ? '#fff' : colors.textMuted, textTransform: 'capitalize' }}>
                  {st}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 100, paddingTop: spacing.md }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />
        }
      >
        {loading ? (
          <View style={{ gap: 12 }}>
            <Skeleton height={110} />
            <Skeleton height={110} />
            <Skeleton height={110} />
          </View>
        ) : error ? (
          <ErrorState message={error || 'Failed to load customers'} onRetry={reload} />
        ) : !customers || customers.length === 0 ? (
          <EmptyState
            title="No Customers Found"
            message="Add a new real estate buyer or search with different keywords."
            actionLabel="Add Customer"
            onAction={() => setModalOpen(true)}
          />
        ) : (
          <View style={{ gap: 12 }}>
            {customers.map((c) => (
              <Card
                key={c._id}
                style={{ padding: 16 }}
                onPress={() => router.push(`/property/customer/${c._id}` as any)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>
                        {c.name}
                      </Text>
                      {getStageBadge(c.stage || c.journeyStage)}
                    </View>
                    <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                      📞 {c.phone} {c.email ? `• ✉️ ${c.email}` : ''}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => Linking.openURL(`tel:${c.phone}`)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.surfaceAlt,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="call" size={16} color={colors.primary} />
                  </Pressable>
                </View>

                {/* KYC & Identity info */}
                <View
                  style={{
                    flexDirection: 'row',
                    marginTop: 12,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderColor: colors.border,
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>PAN</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                      {c.pan || c.panNumber || '—'}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Aadhaar</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text, marginTop: 2 }}>
                      {(c.aadhaar || c.aadhaarNumber) ? `•••• ${(c.aadhaar || c.aadhaarNumber)!.slice(-4)}` : '—'}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable
                      onPress={(e) => handleDeleteCustomer(e, c)}
                      hitSlop={8}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: radius.sm,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderWidth: 1,
                        borderColor: colors.danger,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.danger} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.danger }}>Delete</Text>
                    </Pressable>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 11, color: colors.textFaint, textTransform: 'uppercase' }}>Customer 360°</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: 2 }}>
                        View Profile →
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* New Customer Modal */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              maxHeight: '92%',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>Add Real Estate Customer</Text>
              <Pressable onPress={() => setModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <Input
                label="Full Name *"
                placeholder="e.g. Ramesh Kumar Patel"
                value={name}
                onChangeText={setName}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Primary Phone *"
                    placeholder="e.g. 9876543210"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Alternate Phone"
                    placeholder="e.g. 9822334455"
                    keyboardType="phone-pad"
                    value={alternatePhone}
                    onChangeText={setAlternatePhone}
                  />
                </View>
              </View>

              <Input
                label="Email Address"
                placeholder="e.g. ramesh@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="PAN Card Number"
                    placeholder="e.g. ABCDE1234F"
                    autoCapitalize="characters"
                    value={panNumber}
                    onChangeText={setPanNumber}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Aadhaar Number"
                    placeholder="e.g. 1234 5678 9012"
                    keyboardType="number-pad"
                    value={aadhaarNumber}
                    onChangeText={setAadhaarNumber}
                  />
                </View>
              </View>

              <Input
                label="Residential Address"
                placeholder="Complete postal address for legal deeds"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={2}
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Nominee Name"
                    placeholder="e.g. Sangeeta Patel"
                    value={nomineeName}
                    onChangeText={setNomineeName}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    label="Nominee Relation"
                    placeholder="e.g. Spouse, Son"
                    value={nomineeRelation}
                    onChangeText={setNomineeRelation}
                  />
                </View>
              </View>

              <Button
                label={submitting ? 'Saving Buyer...' : 'Save Customer'}
                onPress={handleCreate}
                disabled={submitting}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
