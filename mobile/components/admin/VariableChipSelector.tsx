import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export interface VariableItem {
  key: string;
  label: string;
  category?: string;
  example?: string;
}

const DEFAULT_VARIABLES: VariableItem[] = [
  { key: 'project_name', label: 'Project Name' },
  { key: 'project_logo', label: 'Logo' },
  { key: 'developer_name', label: 'Developer' },
  { key: 'rera_number', label: 'RERA No' },
  { key: 'gst_number', label: 'GSTIN' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'customer_mobile', label: 'Mobile' },
  { key: 'customer_address', label: 'Customer Address' },
  { key: 'customer_pan', label: 'Customer PAN' },
  { key: 'tower_name', label: 'Tower' },
  { key: 'floor_name', label: 'Floor' },
  { key: 'flat_number', label: 'Flat / Unit' },
  { key: 'unit_type', label: 'Unit Type' },
  { key: 'unit_area', label: 'Area (Sq. Ft.)' },
  { key: 'parking_slot', label: 'Parking' },
  { key: 'total_amount', label: 'Total Consideration' },
  { key: 'total_amount_in_words', label: 'Amount in Words' },
  { key: 'booking_amount', label: 'Booking Amount' },
  { key: 'paid_amount', label: 'Paid Till Date' },
  { key: 'pending_amount', label: 'Pending Balance' },
  { key: 'receipt_number', label: 'Receipt No' },
  { key: 'booking_date', label: 'Booking Date' },
  { key: 'current_date', label: 'Current Date' },
];

interface Props {
  onInsert: (token: string) => void;
  variables?: VariableItem[];
}

export function VariableChipSelector({ onInsert, variables = DEFAULT_VARIABLES }: Props) {
  const { colors, radius } = useTheme();

  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Click chip to insert dynamic variable
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 2, gap: 6 }}>
        {variables.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => onInsert(`{{${item.key}}}`)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.primary : colors.surfaceAlt,
              borderColor: colors.borderStrong,
              borderWidth: 1,
              borderRadius: radius.full,
              paddingHorizontal: 10,
              paddingVertical: 5,
              flexDirection: 'row',
              alignItems: 'center',
            })}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary, marginRight: 2 }}>+</Text>
            <Text style={{ fontSize: 11.5, fontWeight: '500', color: colors.text }}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
