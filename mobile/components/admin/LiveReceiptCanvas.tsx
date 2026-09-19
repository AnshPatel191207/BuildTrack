import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  projectName: string;
  developerName?: string;
  tagline?: string;
  jurisdiction?: string;
  officeAddress?: string;
  phone?: string;
  email?: string;
  authorizedSignatoryTitle?: string;
  reraNumber?: string;
  gstNumber?: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  watermarkText?: string | null;
  showLogo?: boolean;
  showGst?: boolean;
  showRera?: boolean;
  showCustomerAddress?: boolean;
  showBankDetails?: boolean;
}

export function LiveReceiptCanvas({
  projectName,
  developerName = 'RUDRA DEVELOPERS',
  tagline = '2 BHK PODIUM HOMES',
  jurisdiction = 'Ahmedabad Jurisdiction',
  officeAddress = 'Santora, Opp. Veltis Respair, Tragad Underpass, Ahmedabad-382421',
  phone = '+91 75749 98888',
  email = 'santorabyclover@gmail.com',
  authorizedSignatoryTitle,
  reraNumber,
  gstNumber,
  logoUrl,
  primaryColor = '#7A1C1C', // Default Santora receipt maroon accent
  secondaryColor = '#1F2937',
  watermarkText,
  showLogo = true,
  showGst = true,
  showRera = true,
  showCustomerAddress = true,
  showBankDetails = true,
}: Props) {
  const { colors, radius } = useTheme();

  return (
    <View
      style={{
        backgroundColor: '#FFFDF9', // Warm premium ivory receipt paper tone
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        marginVertical: 10,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        flexDirection: 'row',
        aspectRatio: 614 / 398, // Exact 8.5 x 5.5 inch proportions
      }}
    >
      {/* Watermark overlay */}
      {watermarkText ? (
        <View
          style={{
            position: 'absolute',
            top: '35%',
            left: -30,
            right: -30,
            transform: [{ rotate: '-22deg' }],
            alignItems: 'center',
            opacity: 0.06,
            zIndex: 0,
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 30, fontWeight: '900', color: primaryColor, textTransform: 'uppercase' }}>
            {watermarkText}
          </Text>
        </View>
      ) : null}

      {/* ── LEFT PERFORATED COUNTERFOIL / STUB (25% width) ── */}
      <View
        style={{
          width: '24%',
          borderRightWidth: 1,
          borderRightColor: '#9CA3AF',
          borderStyle: 'dashed',
          padding: 8,
          backgroundColor: '#FBFBFB',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 8.5, fontWeight: '800', color: primaryColor }}>STUB</Text>
            <Text style={{ fontSize: 8, fontWeight: '700', color: '#4B5563' }}>No: 101</Text>
          </View>
          <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: 4 }} />
          <Text style={{ fontSize: 7.5, color: '#6B7280' }}>Date: <Text style={{ fontWeight: '700', color: '#111827' }}>17/09/2026</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#6B7280', marginTop: 3 }}>Name: <Text style={{ fontWeight: '700', color: '#111827' }}>Rajesh Patel</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#6B7280', marginTop: 3 }}>Flat No: <Text style={{ fontWeight: '700', color: '#111827' }}>A-402</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#6B7280', marginTop: 3 }}>Mode: <Text style={{ fontWeight: '700', color: '#111827' }}>RTGS</Text></Text>
          <Text style={{ fontSize: 7.5, color: '#6B7280', marginTop: 3 }}>Chq/Txn: <Text style={{ fontWeight: '700', color: '#111827' }}>HDFC98765</Text></Text>
        </View>

        <View>
          <View
            style={{
              borderWidth: 1,
              borderColor: '#111827',
              paddingVertical: 3,
              paddingHorizontal: 4,
              borderRadius: 3,
              backgroundColor: '#FFFFFF',
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 8, fontWeight: '800', color: '#111827', textAlign: 'center' }}>
              Rs. 5,00,000/-
            </Text>
          </View>
          <Text style={{ fontSize: 6.5, color: '#9CA3AF', textAlign: 'center' }}>Receiver's Sign</Text>
        </View>
      </View>

      {/* ── MAIN RECEIPT RIGHT BODY (76% width) ── */}
      <View style={{ flex: 1, padding: 10, justifyContent: 'space-between' }}>
        {/* Header Section */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Logo / Brand Details */}
            <View style={{ flex: 1, paddingRight: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {showLogo && logoUrl ? (
                  <Image
                    source={{ uri: logoUrl }}
                    style={{ width: 60, height: 24, resizeMode: 'contain' }}
                  />
                ) : null}
                <View>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: primaryColor, letterSpacing: 0.5 }}>
                    {projectName || 'SANTORA'}
                  </Text>
                  <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#4B5563', textTransform: 'uppercase' }}>
                    {tagline}
                  </Text>
                </View>
              </View>

              <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#111827', marginTop: 3 }}>
                {developerName}
              </Text>
              <Text style={{ fontSize: 6.5, color: '#6B7280' }} numberOfLines={1}>
                {officeAddress}
              </Text>
              <Text style={{ fontSize: 6.5, color: '#6B7280' }}>
                Mo.: {phone} • {email}
              </Text>
            </View>

            {/* RECEIPT BADGE */}
            <View style={{ alignItems: 'flex-end' }}>
              <View
                style={{
                  backgroundColor: primaryColor,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 3,
                  marginBottom: 3,
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.8 }}>
                  RECEIPT
                </Text>
              </View>
              <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#111827' }}>
                No. <Text style={{ color: primaryColor }}>101</Text>
              </Text>
              <Text style={{ fontSize: 7.5, color: '#4B5563' }}>
                Date: <Text style={{ fontWeight: '700', color: '#111827' }}>17/09/2026</Text>
              </Text>
            </View>
          </View>

          {/* Solid separator line */}
          <View style={{ height: 1, backgroundColor: '#D1D5DB', marginTop: 4, marginBottom: 6 }} />

          {/* Underlined Legal Statement Body */}
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 7.5, color: '#374151' }}>Received with thanks from </Text>
              <View style={{ flex: 1, borderBottomWidth: 0.8, borderBottomColor: '#6B7280', paddingBottom: 1 }}>
                <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#111827' }}>
                  RAJESHBHAI MOHANBHAI PATEL
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 7.5, color: '#374151' }}>the sum of Rupees </Text>
              <View style={{ flex: 1, borderBottomWidth: 0.8, borderBottomColor: '#6B7280', paddingBottom: 1 }}>
                <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#111827' }}>
                  FIVE LAKH RUPEES ONLY
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
              <Text style={{ fontSize: 7.5, color: '#374151' }}>by Cheque / D.D. / Cash / RTGS No. </Text>
              <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#111827', textDecorationLine: 'underline' }}>HDFC987654321</Text>
              <Text style={{ fontSize: 7.5, color: '#374151' }}> Dt. </Text>
              <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#111827', textDecorationLine: 'underline' }}>17/09/2026</Text>
              <Text style={{ fontSize: 7.5, color: '#374151' }}> Bank </Text>
              <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#111827', textDecorationLine: 'underline' }}>HDFC Bank, SG Highway</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
              <Text style={{ fontSize: 7.5, color: '#374151' }}>on a/c of Flat No. </Text>
              <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#111827', textDecorationLine: 'underline' }}>A-402</Text>
              <Text style={{ fontSize: 7.5, color: '#374151' }}> Floor </Text>
              <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#111827', textDecorationLine: 'underline' }}>4th</Text>
              <Text style={{ fontSize: 7.5, color: '#374151' }}> Tower </Text>
              <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#111827', textDecorationLine: 'underline' }}>Tower A</Text>
              <Text style={{ fontSize: 7.5, color: '#374151' }}> Area </Text>
              <Text style={{ fontSize: 7.5, fontWeight: '700', color: '#111827', textDecorationLine: 'underline' }}>1450 Sq.Ft.</Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 7.5, color: '#374151' }}>as Booking / Part / Full Payment</Text>
            </View>
          </View>
        </View>

        {/* Bottom Row: Rupee Box, Notes, Signatory */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
          {/* Rupee Amount Box */}
          <View>
            <View
              style={{
                borderWidth: 1.5,
                borderColor: '#111827',
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 3,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#111827' }}>
                Rs. 5,00,000/-
              </Text>
            </View>
            <Text style={{ fontSize: 6.5, color: '#6B7280', marginTop: 2 }}>
              *Subject to {jurisdiction}
            </Text>
            <Text style={{ fontSize: 6, color: '#9CA3AF' }}>
              *Cheque subject to realization
            </Text>
          </View>

          {/* Authorized Signatory */}
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#111827' }}>
              {authorizedSignatoryTitle || `FOR, ${developerName}`}
            </Text>
            <View style={{ height: 16 }} />
            <View style={{ width: 90, height: 0.8, backgroundColor: '#4B5563' }} />
            <Text style={{ fontSize: 6.5, color: '#4B5563', marginTop: 1 }}>Authorised Signatory</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
