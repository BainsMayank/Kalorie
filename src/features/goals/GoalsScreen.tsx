import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, NumberField } from '@/components';
import { requestNotificationPermission } from '@/features/alerts/notifications';
import { useToday } from '@/features/log/useToday';
import { ALERTS, type AlertKey } from '@/lib/alerts';
import { formatQty } from '@/lib/format';
import { parseAmount } from '@/lib/parse';
import {
  checkFloor,
  defaultLimits,
  suggestTargets,
  targetsForKcal,
  type TargetValues,
} from '@/lib/targets';
import { targetsOnDay, useGoalsStore } from '@/stores/goals';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme';

import { AboutFields } from './AboutFields';
import { ActivityPicker } from './ActivityPicker';
import { answersFromDraft, bodyFromDraft, draftFromProfile, type AboutDraft } from './draft';
import { FloorNote } from './FloorNote';
import { GoalPicker } from './GoalPicker';
import { MicroList } from './MicroList';

/** The editable numbers, as typed. */
type TargetFields = Record<keyof TargetValues, string>;

const MACRO_FIELDS = [
  { key: 'protein_g', label: 'macros.protein' },
  { key: 'carb_g', label: 'macros.carbs' },
  { key: 'fat_g', label: 'macros.fat' },
  { key: 'fibre_g', label: 'targets.fibre' },
] as const;

const text = (value: number | null) => (value === null ? '' : formatQty(value));

function fieldsFrom(values: TargetValues): TargetFields {
  const fields = {} as TargetFields;
  for (const key of Object.keys(values) as (keyof TargetValues)[]) fields[key] = text(values[key]);
  return fields;
}

/** The typed numbers as targets. An empty limit goes back to its default (limits always exist). */
function valuesFrom(fields: TargetFields): TargetValues {
  const kcal = parseAmount(fields.kcal);
  const defaults = defaultLimits(kcal);
  return {
    kcal,
    protein_g: parseAmount(fields.protein_g),
    carb_g: parseAmount(fields.carb_g),
    fat_g: parseAmount(fields.fat_g),
    fibre_g: parseAmount(fields.fibre_g),
    sodium_mg_limit: parseAmount(fields.sodium_mg_limit) ?? defaults.sodium_mg,
    sugar_g_limit: parseAmount(fields.sugar_g_limit) ?? defaults.sugar_g,
    sat_fat_g_limit: parseAmount(fields.sat_fat_g_limit) ?? defaults.sat_fat_g,
    fat_g_limit: parseAmount(fields.fat_g_limit) ?? defaults.fat_g,
  };
}

function sameTargets(a: TargetValues, b: TargetValues): boolean {
  return (Object.keys(a) as (keyof TargetValues)[]).every((key) => a[key] === b[key]);
}

/**
 * Goals (SPEC §2.13): the person's answers, their daily targets and the four limits, each
 * editable, with "Reset to suggested". Saving starts a new targets row from today, so earlier
 * days keep theirs. Alert switches and the phone notification save straight away.
 */
export function GoalsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const today = useToday();
  const profile = useGoalsStore((state) => state.profile);
  const weightKg = useGoalsStore((state) => state.weightKg);
  const rows = useGoalsStore((state) => state.targetRows);
  const saveAbout = useGoalsStore((state) => state.saveAbout);
  const saveTargets = useGoalsStore((state) => state.saveTargets);
  const alertsEnabled = useSettingsStore((state) => state.alertsEnabled);
  const setAlertEnabled = useSettingsStore((state) => state.setAlertEnabled);
  const alertNotifications = useSettingsStore((state) => state.alertNotifications);
  const setAlertNotifications = useSettingsStore((state) => state.setAlertNotifications);
  const waterGlassMl = useSettingsStore((state) => state.waterGlassMl);
  const waterGoalMl = useSettingsStore((state) => state.waterGoalMl);
  const setWater = useSettingsStore((state) => state.setWater);

  const [draft, setDraft] = useState<AboutDraft>(() => draftFromProfile(profile, weightKg));
  const [fields, setFields] = useState<TargetFields>(() => {
    const saved = targetsOnDay(rows, today);
    return fieldsFrom(saved ?? suggestTargets(bodyFromDraft(draft)).targets);
  });
  const [water, setWaterFields] = useState({
    glass: String(waterGlassMl),
    goal: String(waterGoalMl),
  });
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [notificationsBlocked, setNotificationsBlocked] = useState(false);

  const body = useMemo(() => bodyFromDraft(draft), [draft]);
  const suggestion = useMemo(() => suggestTargets(body), [body]);
  const values = valuesFrom(fields);
  const floor = checkFloor(values.kcal, body);

  const changeAbout = (changes: Partial<AboutDraft>) => {
    setDraft((d) => ({ ...d, ...changes }));
    setStatus('idle');
  };

  const setField = (key: keyof TargetValues, value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setStatus('idle');
  };

  /** A new calorie number moves the macros and the %-based limits with it. */
  const changeKcal = (value: string) => {
    const kcal = parseAmount(value);
    const follow = targetsForKcal(kcal, body);
    setFields((f) => ({
      ...f,
      kcal: value,
      protein_g: text(follow.protein_g),
      carb_g: text(follow.carb_g),
      fat_g: text(follow.fat_g),
      sugar_g_limit: text(follow.sugar_g_limit),
      sat_fat_g_limit: text(follow.sat_fat_g_limit),
      fat_g_limit: text(follow.fat_g_limit),
    }));
    setStatus('idle');
  };

  const save = async (next: TargetValues) => {
    try {
      const { answers, weightKg: weight } = answersFromDraft(draft);
      await saveAbout(answers, weight);
      await saveTargets(next, !sameTargets(next, suggestion.targets));
      // Water: an empty or impossible number keeps what was saved before.
      await setWater(
        parseAmount(water.glass) ?? waterGlassMl,
        parseAmount(water.goal) ?? waterGoalMl,
      );
      const saved = useSettingsStore.getState();
      setWaterFields({ glass: String(saved.waterGlassMl), goal: String(saved.waterGoalMl) });
      setFields(fieldsFrom(next));
      setStatus('saved');
    } catch {
      setStatus('failed');
    }
  };

  const toggleNotifications = async (on: boolean) => {
    setNotificationsBlocked(false);
    if (on && !(await requestNotificationPermission('limits', t('alerts.channelName')))) {
      setNotificationsBlocked(true);
      return;
    }
    await setAlertNotifications(on);
  };

  const heading = (label: string) => (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.textSecondary,
        fontSize: fontSize.caption,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: spacing.lg,
      }}
    >
      {label}
    </Text>
  );
  const hint = (label: string) => (
    <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>{label}</Text>
  );
  const toggle = (label: string, on: boolean, onChange: (on: boolean) => void) => (
    <Switch
      accessibilityLabel={label}
      value={on}
      onValueChange={onChange}
      trackColor={{ true: colors.text, false: colors.border }}
      thumbColor={colors.surface}
    />
  );
  const switchRow = (label: string, on: boolean, onChange: (on: boolean) => void) => (
    <View style={[styles.row, { minHeight: 48, gap: spacing.md }]}>
      <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>{label}</Text>
      {toggle(label, on, onChange)}
    </View>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}
    >
      {heading(t('goals.about'))}
      <AboutFields draft={draft} onChange={changeAbout} />
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
        {t('about.activity')}
      </Text>
      <ActivityPicker
        selected={draft.activity}
        onSelect={(activity) => changeAbout({ activity })}
      />
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
        {t('about.goal')}
      </Text>
      <GoalPicker
        goal={draft.goal}
        pace={draft.pace}
        onChange={(goal, pace) => changeAbout({ goal, pace })}
      />

      {heading(t('goals.targets'))}
      {suggestion.noKcalReason !== null &&
        hint(t(`onboarding.noTarget.${suggestion.noKcalReason}`))}
      <NumberField
        label={t('goals.kcal')}
        value={fields.kcal}
        onChangeText={changeKcal}
        unit={t('nutrientUnits.kcal')}
        testID="goal-kcal"
      />
      {hint(t('goals.kcalHint'))}
      <FloorNote check={floor} onUse={(kcal) => changeKcal(String(kcal))} />
      {[MACRO_FIELDS.slice(0, 2), MACRO_FIELDS.slice(2)].map((pair) => (
        <View key={pair[0].key} style={[styles.row, { gap: spacing.md }]}>
          {pair.map((f) => (
            <NumberField
              key={f.key}
              label={t(f.label)}
              value={fields[f.key]}
              onChangeText={(value) => setField(f.key, value)}
              unit={t('nutrientUnits.g')}
            />
          ))}
        </View>
      ))}

      {heading(t('goals.limits'))}
      {hint(t('goals.limitsHint'))}
      {ALERTS.map((alert) => (
        // The limit and, beside it, the switch for its note on Today.
        <View key={alert.key} style={[styles.row, styles.bottom, { gap: spacing.lg }]}>
          <NumberField
            label={t('goals.limitLabel', { nutrient: t(`alerts.names.${alert.key}`) })}
            value={fields[alert.limit]}
            onChangeText={(value) => setField(alert.limit, value)}
            unit={t(`nutrientUnits.${alert.unit}`)}
            testID={`limit-${alert.key}`}
          />
          <View style={[styles.center, { minHeight: 48 }]}>
            {toggle(
              t('goals.alertFor', { nutrient: t(`alerts.names.${alert.key}`) }),
              alertsEnabled[alert.key],
              (on) => void setAlertEnabled(alert.key as AlertKey, on),
            )}
          </View>
        </View>
      ))}
      {switchRow(t('goals.notification'), alertNotifications, (on) => void toggleNotifications(on))}
      {hint(notificationsBlocked ? t('goals.notificationBlocked') : t('goals.notificationHint'))}

      {heading(t('water.title'))}
      <View style={[styles.row, { gap: spacing.md }]}>
        <NumberField
          label={t('goals.waterGoal')}
          value={water.goal}
          onChangeText={(goal) => {
            setWaterFields((w) => ({ ...w, goal }));
            setStatus('idle');
          }}
          unit={t('water.ml')}
          integer
          testID="water-goal"
        />
        <NumberField
          label={t('goals.waterGlass')}
          value={water.glass}
          onChangeText={(glass) => {
            setWaterFields((w) => ({ ...w, glass }));
            setStatus('idle');
          }}
          unit={t('water.ml')}
          integer
          testID="water-glass"
        />
      </View>
      {hint(t('goals.waterHint'))}

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        {status !== 'idle' && (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.text, fontSize: fontSize.body, textAlign: 'center' }}
          >
            {status === 'saved' ? t('goals.saved') : t('entry.saveProblem')}
          </Text>
        )}
        <Button label={t('goals.save')} onPress={() => void save(values)} testID="goals-save" />
        <Button
          label={t('goals.reset')}
          kind="secondary"
          onPress={() => void save(suggestion.targets)}
          testID="goals-reset"
        />
      </View>

      {heading(t('goals.micros'))}
      {hint(t('goals.microsHint'))}
      <MicroList sex={body.sex} age={body.age} activity={body.activity} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  bottom: { alignItems: 'flex-end' },
  center: { justifyContent: 'center' },
});
