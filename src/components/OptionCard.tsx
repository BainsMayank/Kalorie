import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  title: string;
  /** A plain example under the title, e.g. "walks, housework". */
  detail?: string;
  selected: boolean;
  onPress: () => void;
  /** Shown inside the card when it is selected (e.g. pace chips under "Lose weight"). */
  children?: ReactNode;
};

/** A big tappable card for one answer of a question; one per answer, picked like a radio. */
export function OptionCard({ title, detail, selected, onPress, children }: Props) {
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  return (
    <View
      style={{
        borderRadius: radius.md,
        borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        borderColor: selected ? colors.text : colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={detail ? `${title}, ${detail}` : title}
        onPress={onPress}
        style={[
          styles.row,
          { minHeight: minTapTarget + 8, paddingHorizontal: spacing.lg, gap: spacing.md },
        ]}
      >
        <View style={[styles.flex, { paddingVertical: spacing.md }]}>
          <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
            {title}
          </Text>
          {detail !== undefined && (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 2 }}>
              {detail}
            </Text>
          )}
        </View>
        <Ionicons
          name={selected ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={selected ? colors.text : colors.iconInactive}
        />
      </Pressable>
      {selected && children !== undefined && (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
