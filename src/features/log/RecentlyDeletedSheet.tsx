import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet, PillButton } from '@/components';
import { formatQty } from '@/lib/format';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { useKcalText } from './DayTimeline';
import { entryName } from './names';
import type { EntryView } from './useDayLog';

/**
 * *Recently deleted* for the day on the Log tab (SPEC §2.10): what was deleted in the last 30
 * days, each with *Bring back*. Closes itself when nothing is left.
 */
export function RecentlyDeletedSheet({
  entries,
  onClose,
}: {
  entries: EntryView[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const restoreEntry = useLogStore((state) => state.restoreEntry);
  const kcalText = useKcalText();

  const restore = (view: EntryView) => {
    const name = entryName(t, view.entry);
    if (entries.length === 1) onClose();
    restoreEntry(view.entry.id, t('undo.restored', { name })).catch(() => {});
  };

  return (
    <BottomSheet title={t('deleted.title')} onClose={onClose}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.caption,
          marginBottom: spacing.sm,
        }}
      >
        {t('deleted.note')}
      </Text>
      {entries.map((view) => {
        const { entry } = view;
        const name = entryName(t, entry);
        const amount =
          entry.qty !== null && view.unitLabel !== null
            ? t('food.portion', { qty: formatQty(entry.qty), unit: view.unitLabel })
            : null;
        return (
          <View
            key={entry.id}
            style={[
              styles.row,
              {
                minHeight: minTapTarget + spacing.sm,
                gap: spacing.md,
                paddingVertical: spacing.sm,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              },
            ]}
          >
            <View style={styles.flex}>
              <Text style={{ color: colors.text, fontSize: fontSize.body }} numberOfLines={2}>
                {name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                {[amount, kcalText(view.nutrients.energy_kcal)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <PillButton
              label={t('deleted.restore')}
              accessibilityLabel={t('deleted.restoreLabel', { name })}
              onPress={() => restore(view)}
            />
          </View>
        );
      })}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
