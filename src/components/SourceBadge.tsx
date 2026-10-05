import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Where a food's data comes from. Both USDA datasets show as "USDA"; foods in user.db show
 * their kind (barcode product, the person's own food, recipe), or "Group" when someone in the
 * person's group shared it.
 */
export type SourceKind = 'indb' | 'ifct' | 'usda' | 'product' | 'custom' | 'recipe' | 'group';

export function sourceKind(source: string): SourceKind {
  switch (source) {
    case 'indb':
    case 'ifct':
    case 'product':
    case 'custom':
    case 'recipe':
    case 'group':
      return source;
    default:
      return 'usda';
  }
}

/** A small grey tag with the data source (INDB / IFCT / USDA / Product / My food / Group), SPEC §2.3. */
export function SourceBadge({ source }: { source: string }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const kind = sourceKind(source);

  return (
    <View
      accessible
      accessibilityLabel={t('food.source', { source: t(`sources.long.${kind}`) })}
      style={[
        styles.badge,
        {
          borderColor: colors.border,
          borderRadius: radius.sm,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        },
      ]}
    >
      <Text style={[styles.text, { color: colors.textSecondary }]}>
        {t(`sources.short.${kind}`)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
