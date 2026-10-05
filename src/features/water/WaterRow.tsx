import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, Button, NumberField } from '@/components';
import { useWaterForDay } from '@/features/history/useHistory';
import { loggedTick } from '@/features/log/haptics';
import { formatWhole } from '@/lib/format';
import { parseAmount } from '@/lib/parse';
import { CUSTOM_ML_RANGE, glasses, goalGlasses } from '@/lib/water';
import { useSettingsStore } from '@/stores/settings';
import { useWaterStore } from '@/stores/water';
import { useTheme } from '@/theme';

/**
 * The water row on Today (SPEC §2.2): a glass icon for each glass of the day's goal, filled as
 * they are drunk, with − and + (one glass). Long-press + for a different amount. Read-only for a
 * past day opened from the calendar.
 */
export function WaterRow({ day, readOnly = false }: { day: string; readOnly?: boolean }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  const ml = useWaterForDay(day);
  const glassMl = useSettingsStore((state) => state.waterGlassMl);
  const goalMl = useSettingsStore((state) => state.waterGoalMl);
  const add = useWaterStore((state) => state.add);
  const removeLast = useWaterStore((state) => state.removeLast);
  const [custom, setCustom] = useState(false);

  const icons = goalGlasses(goalMl, glassMl);
  const filled = Math.min(icons, Math.floor(ml / glassMl));
  const count = glasses(ml, glassMl);
  const amount = t('water.amount', { ml: formatWhole(ml), goal: formatWhole(goalMl) });
  const glassesText = t('water.glasses', { count, value: count });

  const addGlass = () => {
    loggedTick();
    add(day, glassMl).catch(() => {});
  };

  const roundButton = (
    icon: 'add' | 'remove',
    label: string,
    onPress: () => void,
    extra: { hint?: string; onLongPress?: () => void; disabled?: boolean } = {},
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={extra.hint}
      accessibilityState={{ disabled: extra.disabled ?? false }}
      disabled={extra.disabled}
      onPress={onPress}
      onLongPress={extra.onLongPress}
      style={({ pressed }) => [
        styles.center,
        {
          width: minTapTarget,
          height: minTapTarget,
          borderRadius: minTapTarget / 2,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          opacity: extra.disabled ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          padding: spacing.lg,
          gap: spacing.sm,
        },
      ]}
    >
      <View style={[styles.row, { gap: spacing.sm }]}>
        <View style={styles.flex}>
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}
          >
            {t('water.title')}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 2 }}>
            {`${amount} · ${glassesText}`}
          </Text>
        </View>
        {!readOnly && (
          <>
            {roundButton('remove', t('water.remove'), () => removeLast(day).catch(() => {}), {
              disabled: ml <= 0,
            })}
            {roundButton('add', t('water.add', { ml: glassMl }), addGlass, {
              hint: t('water.addHint'),
              onLongPress: () => setCustom(true),
            })}
          </>
        )}
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('water.progressLabel', { amount, glasses: glassesText })}
        style={[styles.row, styles.wrap, { gap: spacing.xs }]}
      >
        {Array.from({ length: icons }, (_, i) => (
          <Ionicons
            key={i}
            name={i < filled ? 'water' : 'water-outline'}
            size={22}
            color={i < filled ? colors.water : colors.iconInactive}
          />
        ))}
      </View>
      {ml >= goalMl && (
        <Text style={{ color: colors.text, fontSize: fontSize.caption }}>
          {t('water.goalReached')}
        </Text>
      )}

      {custom && (
        <CustomWaterSheet
          onClose={() => setCustom(false)}
          onAdd={(customMl) => {
            loggedTick();
            add(day, customMl).catch(() => {});
            setCustom(false);
          }}
        />
      )}
    </View>
  );
}

/** Long-press on +: add any amount of water in ml. */
function CustomWaterSheet({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (ml: number) => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [text, setText] = useState('');
  const ml = parseAmount(text);
  const valid = ml !== null && ml >= CUSTOM_ML_RANGE.min && ml <= CUSTOM_ML_RANGE.max;

  return (
    <BottomSheet
      title={t('water.customTitle')}
      onClose={onClose}
      footer={
        <Button
          label={t('water.customAdd')}
          disabled={!valid}
          onPress={() => valid && onAdd(Math.round(ml))}
          testID="water-custom-add"
        />
      }
    >
      <View style={{ paddingBottom: spacing.md }}>
        <NumberField
          label={t('water.customLabel')}
          value={text}
          onChangeText={setText}
          unit={t('water.ml')}
          integer
          testID="water-custom-ml"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  wrap: { flexWrap: 'wrap' },
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: StyleSheet.hairlineWidth },
});
