import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet, Button } from '@/components';
import type { MealSlot } from '@/db/user/schema';
import { slotName } from '@/features/log/names';
import type { EntryView } from '@/features/log/useDayLog';
import { formatQty } from '@/lib/format';
import { thaliItemsFromEntries } from '@/lib/thali';
import { useMyFoodsStore } from '@/stores/myFoods';
import { useTheme } from '@/theme';

type Props = {
  slot: MealSlot;
  /** The meal's entries, in order, with their units in words. */
  entries: EntryView[];
  onClose: () => void;
};

/**
 * *Save as thali* from a meal card (SPEC §2.2, §2.9): the meal's foods and amounts are kept under
 * a name, to log again from Add food → Thalis. Quick adds are left out.
 */
export function SaveThaliSheet({ slot, entries, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius } = useTheme();
  const saveThali = useMyFoodsStore((state) => state.saveThali);
  const [name, setName] = useState(() => t('thali.defaultName', { slot: slotName(t, slot) }));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const rows = entries.flatMap((view) =>
    thaliItemsFromEntries([view.entry]).map((item) => ({ item, unitLabel: view.unitLabel })),
  );
  const items = rows.map((r) => r.item);
  const leftOut = items.length < entries.length;

  const save = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await saveThali(name.trim(), items, t('undo.savedThali', { name: name.trim() }));
      onClose();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      title={t('thali.saveTitle', { slot: slotName(t, slot) })}
      onClose={onClose}
      footer={
        <View style={{ gap: spacing.sm }}>
          {failed && (
            <Text style={{ color: colors.text, fontSize: fontSize.caption, textAlign: 'center' }}>
              {t('entry.saveProblem')}
            </Text>
          )}
          <Button
            label={t('thali.save')}
            onPress={save}
            disabled={busy || items.length === 0 || name.trim() === ''}
          />
        </View>
      }
    >
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: fontSize.caption,
          marginBottom: spacing.xs,
        }}
      >
        {t('thali.name')}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        accessibilityLabel={t('thali.name')}
        placeholder={t('thali.namePlaceholder')}
        placeholderTextColor={colors.iconInactive}
        selectTextOnFocus
        style={{
          minHeight: 48,
          borderRadius: radius.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.background,
          color: colors.text,
          fontSize: fontSize.body,
          paddingHorizontal: spacing.md,
        }}
      />

      {items.length === 0 ? (
        <Text
          style={{ color: colors.textSecondary, fontSize: fontSize.body, marginTop: spacing.lg }}
        >
          {t('thali.nothingToSave')}
        </Text>
      ) : (
        <>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.caption,
              marginTop: spacing.lg,
              marginBottom: spacing.xs,
            }}
          >
            {t('thali.items')}
          </Text>
          {rows.map(({ item, unitLabel }, index) => (
            <View
              key={`${index}-${item.foodId}`}
              style={[
                styles.row,
                {
                  minHeight: 40,
                  gap: spacing.md,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>
                {item.name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                {t('food.portion', {
                  qty: formatQty(item.qty),
                  unit: unitLabel ?? item.unit,
                })}
              </Text>
            </View>
          ))}
          {leftOut && (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: fontSize.caption,
                marginTop: spacing.sm,
              }}
            >
              {t('thali.quickLeftOut')}
            </Text>
          )}
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
