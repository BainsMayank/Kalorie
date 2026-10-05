import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { EMPTY_ANSWERS, listTargets, saveProfile, saveTargets, saveWeight } from '@/db/user/goals';
import { writeSetting } from '@/db/user/settings';
import { requestNotificationPermission } from '@/features/alerts/notifications';
import { suggestTargets } from '@/lib/targets';
import { useGoalsStore } from '@/stores/goals';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settings';

import { GoalsScreen } from './GoalsScreen';

jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
jest.mock('@/db/user/settings', () => ({
  readAllSettings: jest.fn(async () => ({})),
  writeSetting: jest.fn(async () => {}),
}));
jest.mock('@/features/alerts/notifications', () => ({
  notifyNow: jest.fn(async () => {}),
  requestNotificationPermission: jest.fn(async () => true),
}));

const { getUserDb } = jest.requireMock('@/db/user/client') as typeof import('@/db/user/client');

// Man, 30, 175 cm, 70 kg, moderate, maintain → 2,550 kcal (see formulas.test.ts).
const PERSON = {
  sex: 'm' as const,
  age: 30,
  heightCm: 175,
  weightKg: 70,
  activity: 'moderate' as const,
  goal: 'maintain' as const,
  paceKgWeek: 0,
};
const SUGGESTED = suggestTargets(PERSON).targets;

beforeEach(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 8, 27, 10).getTime());
  const { profile, targets, weights } = jest.requireActual('@/db/user/schema');
  await getUserDb().delete(profile);
  await getUserDb().delete(targets);
  await getUserDb().delete(weights);
  await saveProfile(
    {
      ...EMPTY_ANSWERS,
      sex: 'm',
      birthYear: 1996,
      heightCm: 175,
      activity: 'moderate',
      goal: 'maintain',
      paceKgWeek: 0,
    },
    1,
  );
  await saveWeight('2026-09-20', 70);
  await saveTargets('2026-09-20', { ...SUGGESTED, kcal: 2400 }, true);
  await useGoalsStore.getState().load();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
  jest.mocked(writeSetting).mockClear();
});
afterEach(() => jest.restoreAllMocks());

describe('Goals', () => {
  it('shows the saved targets and moves macros with a new calorie number', async () => {
    await render(<GoalsScreen />);
    expect(screen.getByTestId('goal-kcal')).toHaveDisplayValue('2400');

    await fireEvent.changeText(screen.getByTestId('goal-kcal'), '2000');
    expect(screen.getByLabelText('Protein, g')).toHaveDisplayValue('75');
    expect(screen.getByLabelText('Fat, g')).toHaveDisplayValue('67');
    expect(screen.getByTestId('limit-sugar')).toHaveDisplayValue('50');
    expect(screen.getByTestId('limit-sodium')).toHaveDisplayValue('2000');
  });

  it('saves edits from today, so earlier days keep their targets', async () => {
    await render(<GoalsScreen />);
    await fireEvent.changeText(screen.getByTestId('goal-kcal'), '2200');
    await fireEvent.changeText(screen.getByTestId('limit-sodium'), '1500');
    await fireEvent.press(screen.getByTestId('goals-save'));

    expect(await screen.findByText(/earlier days keep their targets/)).toBeOnTheScreen();
    const rows = await listTargets();
    expect(rows.map((r) => [r.effectiveFrom, r.kcal, r.sodiumMgLimit, r.isCustom])).toEqual([
      ['2026-09-20', 2400, 2000, true],
      ['2026-09-27', 2200, 1500, true],
    ]);
  });

  it('resets to the suggested targets', async () => {
    await render(<GoalsScreen />);
    await fireEvent.press(screen.getByTestId('goals-reset'));
    expect(await screen.findByText(/earlier days keep their targets/)).toBeOnTheScreen();
    expect(screen.getByTestId('goal-kcal')).toHaveDisplayValue('2550');
    const today = (await listTargets()).find((r) => r.effectiveFrom === '2026-09-27');
    expect(today).toMatchObject({ kcal: 2550, isCustom: false });
  });

  it('shows a kind note under the floor and never blocks saving', async () => {
    await render(<GoalsScreen />);
    await fireEvent.changeText(screen.getByTestId('goal-kcal'), '1000');
    expect(screen.getByTestId('floor-note')).toHaveTextContent(
      /lower than we'd suggest \(1,650 kcal\)/,
    );

    await fireEvent.press(screen.getByTestId('goals-save'));
    expect(await screen.findByText(/earlier days keep their targets/)).toBeOnTheScreen();
    expect((await listTargets()).at(-1)?.kcal).toBe(1000);

    await fireEvent.press(screen.getByRole('button', { name: 'Use 1,650 kcal' }));
    expect(screen.getByTestId('goal-kcal')).toHaveDisplayValue('1650');
  });

  it('switches an alert off and the phone notification on', async () => {
    await render(<GoalsScreen />);
    await fireEvent(screen.getByLabelText('Note on Today for Sugar'), 'valueChange', false);
    expect(writeSetting).toHaveBeenCalledWith('alerts_enabled', {
      fat: true,
      sat_fat: true,
      sugar: false,
      sodium: true,
    });

    expect(screen.getByLabelText('Also send a phone notification')).toHaveProp('value', false);
    await fireEvent(screen.getByLabelText('Also send a phone notification'), 'valueChange', true);
    expect(requestNotificationPermission).toHaveBeenCalled();
    expect(writeSetting).toHaveBeenCalledWith('alert_notifications', true);
  });

  it('lists ICMR-NIN vitamin and mineral needs for the person', async () => {
    await render(<GoalsScreen />);
    expect(screen.getByText('Vitamin B12')).toBeOnTheScreen();
    expect(screen.getByText('2.2 µg')).toBeOnTheScreen();
    expect(screen.getByText('19 mg')).toBeOnTheScreen(); // iron, adult man (p. 13)
    expect(screen.getByText('upper limit 350 mg from supplements')).toBeOnTheScreen();
  });

  it('saves the water goal and glass size with Save, keeping them if left empty', async () => {
    await render(<GoalsScreen />);
    expect(screen.getByTestId('water-goal')).toHaveDisplayValue('2000');
    expect(screen.getByTestId('water-glass')).toHaveDisplayValue('250');

    await fireEvent.changeText(screen.getByTestId('water-goal'), '2500');
    await fireEvent.changeText(screen.getByTestId('water-glass'), '');
    await fireEvent.press(screen.getByTestId('goals-save'));
    await screen.findByText('Saved. These apply from today; earlier days keep their targets.');

    expect(writeSetting).toHaveBeenCalledWith('water_goal_ml', 2500);
    expect(writeSetting).toHaveBeenCalledWith('water_glass_ml', 250);
    expect(useSettingsStore.getState()).toMatchObject({ waterGoalMl: 2500, waterGlassMl: 250 });
    expect(screen.getByTestId('water-glass')).toHaveDisplayValue('250');
  });
});
