import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { BottomSheet } from './BottomSheet';
import {
  MONTH_NAMES,
  WEEKDAY_LETTERS,
  daysInMonth,
  firstWeekdayOfMonth,
  toISODateString,
} from '@/lib/calendar';

interface DatePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  value: string | null; // YYYY-MM-DD
  onChange: (iso: string) => void;
  title?: string;
  /** Don't allow picking dates after today (e.g. expense/report dates). */
  maxDate?: string;
  minDate?: string;
}

/** Pure-RN month calendar — avoids a native datetimepicker dependency. */
export function DatePickerSheet({
  visible,
  onClose,
  value,
  onChange,
  title = 'Pick a date',
  maxDate,
  minDate,
}: DatePickerSheetProps) {
  const { colors, radius, spacing } = useTheme();

  const initial = useMemo(() => {
    const base = value ?? maxDate ?? toISODateString(new Date());
    const [y, m] = base.split('-').map(Number);
    return { year: y, month: m - 1 };
  }, [value, maxDate]);

  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  useEffect(() => {
    if (visible) {
      setViewYear(initial.year);
      setViewMonth(initial.month);
    }
  }, [visible, initial]);

  const grid = useMemo(() => {
    const total = daysInMonth(viewYear, viewMonth);
    const offset = firstWeekdayOfMonth(viewYear, viewMonth); // 0 = Mon
    const cells: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= total; d++) {
      cells.push(toISODateString(new Date(Date.UTC(viewYear, viewMonth, d))));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const todayISO = toISODateString(new Date());

  const move = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <View style={styles.monthRow}>
          <Pressable onPress={() => move(-1)} hitSlop={10} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 15.5, fontWeight: '700' }}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </Text>
          <Pressable onPress={() => move(1)} hitSlop={10} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAY_LETTERS.map((w, i) => (
            <Text key={i} style={[styles.weekCell, { color: colors.textFaint }]}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {grid.map((iso, idx) => {
            if (!iso) return <View key={`empty-${idx}`} style={styles.dayCell} />;
            const selected = iso === value;
            const disabled = Boolean(
              (maxDate && iso > maxDate) || (minDate && iso < minDate),
            );
            const isToday = iso === todayISO;
            return (
              <Pressable
                key={iso}
                onPress={() => {
                  if (disabled) return;
                  onChange(iso);
                  onClose();
                }}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={iso}
                accessibilityState={{ selected, disabled }}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: selected ? colors.primary : 'transparent',
                    borderRadius: radius.md,
                    height: 38,
                  },
                ]}
              >
                <Text
                  style={{
                    color: selected
                      ? colors.onPrimary
                      : disabled
                        ? colors.textFaint
                        : colors.text,
                    fontSize: 14,
                    fontWeight: selected ? '800' : isToday ? '700' : '500',
                  }}
                >
                  {Number(iso.slice(8))}
                </Text>
                {!selected && isToday ? (
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: colors.primary,
                    }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11.5,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
});
