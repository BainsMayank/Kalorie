import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components';
import { requestNotificationPermission } from '@/features/alerts/notifications';
import { AboutFields } from '@/features/goals/AboutFields';
import { ActivityPicker } from '@/features/goals/ActivityPicker';
import {
  answersFromDraft,
  bodyFromDraft,
  EMPTY_DRAFT,
  type AboutDraft,
} from '@/features/goals/draft';
import { FloorNote } from '@/features/goals/FloorNote';
import { GoalPicker } from '@/features/goals/GoalPicker';
import { TargetsSummary } from '@/features/goals/TargetsSummary';
import { formatTime } from '@/i18n/dates';
import { DEFAULT_MEAL_MINUTES, withOnboardingMeals } from '@/lib/reminders';
import { checkFloor, suggestTargets, targetsForKcal } from '@/lib/targets';
import { useGoalsStore } from '@/stores/goals';
import { useSettingsStore } from '@/stores/settings';
import { useTheme } from '@/theme';

const STEPS = ['goal', 'about', 'activity', 'targets'] as const;

/**
 * Onboarding (SPEC §2.1) in 4 steps: goal, about you, activity, your starting targets. Every
 * question can be skipped; "Skip — just let me log" on the first step goes straight to the app
 * in Just-track mode. Nothing is saved until the last step (or that skip).
 */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, minTapTarget } = useTheme();
  const router = useRouter();
  const finishOnboarding = useGoalsStore((state) => state.finishOnboarding);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<AboutDraft>(EMPTY_DRAFT);
  /** A calorie number the person picked instead of the suggestion (the floor button). */
  const [kcalOverride, setKcalOverride] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  /** "Remind me at meal times" (SPEC §5.12): off unless switched on; saved with the rest. */
  const [remindMeals, setRemindMeals] = useState(false);
  const [remindBlocked, setRemindBlocked] = useState(false);

  const change = (changes: Partial<AboutDraft>) => {
    setDraft((d) => ({ ...d, ...changes }));
    setKcalOverride(null);
  };

  const body = useMemo(() => bodyFromDraft(draft), [draft]);
  const suggestion = useMemo(() => suggestTargets(body), [body]);
  const targets = useMemo(
    () => (kcalOverride === null ? suggestion.targets : targetsForKcal(kcalOverride, body)),
    [kcalOverride, suggestion, body],
  );
  const floor = checkFloor(targets.kcal, body);

  const back = () => setStep((s) => Math.max(0, s - 1));
  // The phone's back button steps back through the questions.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      setStep(step - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const toggleReminders = async (on: boolean) => {
    setRemindBlocked(false);
    // Ask right away, so the phone's question comes up next to the switch that caused it.
    if (on && !(await requestNotificationPermission('reminders', t('reminders.channelName')))) {
      setRemindBlocked(true);
      return;
    }
    setRemindMeals(on);
  };

  const finish = async (finalDraft: AboutDraft, values = targets, reminders = false) => {
    setSaving(true);
    setFailed(false);
    try {
      const { answers, weightKg } = answersFromDraft(finalDraft);
      if (reminders) {
        const settings = useSettingsStore.getState();
        await settings.setReminders(withOnboardingMeals(settings.reminders));
      }
      await finishOnboarding(answers, weightKg, values);
      router.replace('/');
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  const skipAll = () => {
    const tracking: AboutDraft = { ...EMPTY_DRAFT, goal: 'track' };
    void finish(tracking, suggestTargets(bodyFromDraft(tracking)).targets);
  };

  /** "Skip" clears this step's answers and moves on. */
  const skipStep = () => {
    if (STEPS[step] === 'goal') change({ goal: null, pace: null });
    if (STEPS[step] === 'about') change({ sex: null, age: '', heightCm: null, weight: '' });
    if (STEPS[step] === 'activity') change({ activity: null });
    setStep((s) => s + 1);
  };

  const name = STEPS[step];
  const title = t(`onboarding.titles.${name}`);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Back · progress · Skip */}
      <View style={[styles.row, { paddingHorizontal: spacing.sm, minHeight: minTapTarget }]}>
        <View style={{ width: 88 }}>
          {step > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={back}
              style={[styles.center, { minHeight: minTapTarget, minWidth: minTapTarget }]}
            >
              <Text style={{ color: colors.text, fontSize: fontSize.body }}>
                {t('onboarding.back')}
              </Text>
            </Pressable>
          )}
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('onboarding.progress', { step: step + 1, total: STEPS.length })}
          style={[styles.flex, styles.row, { gap: spacing.xs }]}
        >
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[
                styles.flex,
                styles.segment,
                { backgroundColor: i <= step ? colors.text : colors.border },
              ]}
            />
          ))}
        </View>
        <View style={{ width: 88, alignItems: 'flex-end' }}>
          {name !== 'targets' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('onboarding.skipQuestion')}
              onPress={skipStep}
              style={[styles.center, { minHeight: minTapTarget, minWidth: minTapTarget }]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
                {t('onboarding.skip')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* The number pad has no "done" key: the Next button rises above it, and dragging the
          questions puts it away. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        >
          {name === 'goal' && (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
              {t('onboarding.welcome')}
            </Text>
          )}
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '600' }}
          >
            {title}
          </Text>

          {name === 'goal' && (
            <GoalPicker
              goal={draft.goal}
              pace={draft.pace}
              onChange={(goal, pace) => change({ goal, pace })}
            />
          )}

          {name === 'about' && (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
                {t('onboarding.aboutHint')}
              </Text>
              <AboutFields draft={draft} onChange={change} />
            </>
          )}

          {name === 'activity' && (
            <ActivityPicker
              selected={draft.activity}
              onSelect={(activity) => change({ activity })}
            />
          )}

          {name === 'targets' && (
            <>
              {suggestion.noKcalReason !== null && (
                <Text style={{ color: colors.text, fontSize: fontSize.body }}>
                  {t(`onboarding.noTarget.${suggestion.noKcalReason}`)}
                </Text>
              )}
              {suggestion.noKcalReason !== 'under18' && <TargetsSummary targets={targets} />}
              <FloorNote check={floor} onUse={setKcalOverride} />
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>
                {t('onboarding.startingPoint')}
              </Text>
              <View style={[styles.row, { minHeight: minTapTarget, gap: spacing.md }]}>
                <Text style={[styles.flex, { color: colors.text, fontSize: fontSize.body }]}>
                  {t('onboarding.remindMeals')}
                </Text>
                <Switch
                  testID="onboarding-reminders"
                  accessibilityLabel={t('onboarding.remindMeals')}
                  value={remindMeals}
                  onValueChange={(on) => void toggleReminders(on)}
                  trackColor={{ true: colors.text, false: colors.border }}
                  thumbColor={colors.surface}
                />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                {remindBlocked
                  ? t('onboarding.remindBlocked')
                  : t('onboarding.remindHint', {
                      breakfast: formatTime(t, DEFAULT_MEAL_MINUTES.breakfast),
                      lunch: formatTime(t, DEFAULT_MEAL_MINUTES.lunch),
                      dinner: formatTime(t, DEFAULT_MEAL_MINUTES.dinner),
                    })}
              </Text>
            </>
          )}
        </ScrollView>

        <View style={{ padding: spacing.lg, gap: spacing.sm }}>
          {failed && (
            <Text style={{ color: colors.text, fontSize: fontSize.caption, textAlign: 'center' }}>
              {t('entry.saveProblem')}
            </Text>
          )}
          {name === 'targets' ? (
            <Button
              label={t('onboarding.start')}
              onPress={() => void finish(draft, targets, remindMeals)}
              disabled={saving}
            />
          ) : (
            <Button label={t('onboarding.next')} onPress={() => setStep((s) => s + 1)} />
          )}
          {name === 'goal' && (
            <Button
              label={t('onboarding.skipAll')}
              kind="text"
              onPress={skipAll}
              disabled={saving}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  segment: { height: 4, borderRadius: 2 },
});
