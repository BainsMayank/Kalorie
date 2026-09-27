import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  title: string;
  message: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

/** A simple "coming soon" screen used by tabs that aren't built yet. */
export function PlaceholderScreen({ title, message, icon }: Props) {
  const { colors, spacing, fontSize } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, padding: spacing.xl }]}>
      <Ionicons name={icon} size={48} color={colors.textSecondary} />
      <Text
        accessibilityRole="header"
        style={{
          color: colors.text,
          fontSize: fontSize.headline,
          fontWeight: '600',
          marginTop: spacing.lg,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.body,
          textAlign: 'center',
          marginTop: spacing.sm,
        }}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
