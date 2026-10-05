import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { getProfile, latestWeight, listTargets } from '@/db/user/goals';
import { writeSetting } from '@/db/user/settings';
import { requestNotificationPermission } from '@/features/alerts/notifications';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settings';
import { useGoalsStore } from '@/stores/goals';

import { OnboardingScreen } from './OnboardingScreen';

// A fresh in-memory user.db, built from the real migrations; each test starts with it empty.
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});
jest.mock('@/db/user/settings', () => ({
  readAllSettings: jest.fn(async () => ({})),
  writeSetting: jest.fn(async () => {}),
}));
jest.mock('@/features/alerts/notifications', () => ({
  requestNotificationPermission: jest.fn(async () => true),
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));

const { getUserDb } = jest.requireMock('@/db/user/client') as typeof import('@/db/user/client');

beforeEach(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 8, 27, 10).getTime());
  const db = getUserDb();
  const { profile, targets, weights } = jest.requireActual('@/db/user/schema');
  await db.delete(profile);
  await db.delete(targets);
  await db.delete(weights);
  await useGoalsStore.getState().load();
  useSettingsStore.setState(DEFAULT_SETTINGS);
  mockReplace.mockClear();
  jest.mocked(writeSetting).mockClear();
});
afterEach(() => jest.restoreAllMocks());

const next = () => fireEvent.press(screen.getByRole('button', { name: 'Next' }));

describe('Onboarding', () => {
  it('works out starting targets, offers a safer number, and saves everything', async () => {
    await render(<OnboardingScreen />);
    expect(screen.getByText(/Setup takes under a minute/)).toBeOnTheScreen();
    expect(screen.getByText(/isn't medical advice/)).toBeOnTheScreen();

    // 1. Goal: lose, steady pace.
    await fireEvent.press(screen.getByRole('radio', { name: /^Lose weight/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Steady · 0.5 kg a week' }));
    await next();

    // 2. About you.
    await fireEvent.press(screen.getByRole('radio', { name: 'Female' }));
    await fireEvent.changeText(screen.getByTestId('age'), '28');
    await fireEvent.changeText(screen.getByTestId('weight'), '60');
    await fireEvent.changeText(screen.getByTestId('height-cm'), '160');
    await next();

    // 3. Activity.
    await fireEvent.press(screen.getByRole('radio', { name: /^Light/ }));
    await next();

    // 4. Targets: 1299 × 1.375 − 550 → 1,250 kcal, under her BMR, so a kind note suggests 1,300.
    expect(screen.getByTestId('target-kcal')).toHaveTextContent('1,250');
    expect(screen.getByTestId('floor-note')).toHaveTextContent(
      /lower than we'd suggest \(1,300 kcal\)/,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Use 1,300 kcal' }));
    expect(screen.getByTestId('target-kcal')).toHaveTextContent('1,300');
    expect(screen.queryByTestId('floor-note')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Start logging' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(await getProfile()).toMatchObject({
      sex: 'f',
      birthYear: 1998,
      heightCm: 160,
      activity: 'light',
      goal: 'lose',
      paceKgWeek: 0.5,
    });
    expect((await getProfile())?.onboardedAt).not.toBeNull();
    expect(await latestWeight()).toBe(60);
    const [row] = await listTargets();
    expect(row).toMatchObject({ effectiveFrom: '2026-09-27', kcal: 1300, isCustom: false });
    expect(useGoalsStore.getState().profile?.onboardedAt).not.toBeNull();
  });

  it('never blocks a low number: keeping it is fine', async () => {
    await render(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: /^Lose weight/ }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Steady · 0.5 kg a week' }));
    await next();
    await fireEvent.press(screen.getByRole('radio', { name: 'Female' }));
    await fireEvent.changeText(screen.getByTestId('age'), '65');
    await fireEvent.changeText(screen.getByTestId('weight'), '45');
    await fireEvent.changeText(screen.getByTestId('height-cm'), '150');
    await next();
    await next(); // activity skipped by just moving on
    expect(screen.getByTestId('floor-note')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start logging' }));
    expect((await listTargets())[0].kcal).toBe(550);
  });

  it('lets every question be skipped', async () => {
    await render(<OnboardingScreen />);
    for (let i = 0; i < 3; i++) {
      await fireEvent.press(screen.getByRole('button', { name: 'Skip this question' }));
    }
    expect(screen.getByText(/we need your age, height and weight/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start logging' }));

    expect(await getProfile()).toMatchObject({ sex: null, birthYear: null, goal: null });
    const [row] = await listTargets();
    expect(row).toMatchObject({ kcal: null, sodiumMgLimit: 2000, sugarGLimit: 50 });
  });

  it('leaves reminders off unless "Remind me at meal times" is switched on', async () => {
    await render(<OnboardingScreen />);
    for (let i = 0; i < 3; i++) {
      await fireEvent.press(screen.getByRole('button', { name: 'Skip this question' }));
    }
    const reminders = screen.getByTestId('onboarding-reminders');
    expect(reminders.props.value).toBe(false);
    await fireEvent(reminders, 'valueChange', true);
    expect(requestNotificationPermission).toHaveBeenCalledWith('reminders', 'Reminders');
    await fireEvent.press(screen.getByRole('button', { name: 'Start logging' }));

    const { meals } = useSettingsStore.getState().reminders;
    expect(meals).toEqual({
      breakfast: { on: true, minute: 9 * 60 },
      lunch: { on: true, minute: 13 * 60 + 30 },
      dinner: { on: true, minute: 20 * 60 + 30 },
    });
    expect(writeSetting).toHaveBeenCalledWith('reminders', expect.anything());
  });

  it('keeps the reminders switch off when notifications are not allowed', async () => {
    jest.mocked(requestNotificationPermission).mockResolvedValueOnce(false);
    await render(<OnboardingScreen />);
    for (let i = 0; i < 3; i++) {
      await fireEvent.press(screen.getByRole('button', { name: 'Skip this question' }));
    }
    await fireEvent(screen.getByTestId('onboarding-reminders'), 'valueChange', true);
    expect(screen.getByTestId('onboarding-reminders').props.value).toBe(false);
    expect(screen.getByText(/Notifications are turned off/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start logging' }));
    expect(writeSetting).not.toHaveBeenCalledWith('reminders', expect.anything());
  });

  it('goes straight to the app in Just-track mode with "Skip — just let me log"', async () => {
    await render(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Skip — just let me log' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(await getProfile()).toMatchObject({ goal: 'track' });
    expect((await listTargets())[0].kcal).toBeNull();
  });

  it('gives under-18s a friendly note and no calorie target', async () => {
    await render(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: /^Lose weight/ }));
    await next();
    await fireEvent.changeText(screen.getByTestId('age'), '16');
    expect(screen.getByText(/made for adults/)).toBeOnTheScreen();
    await next();
    await next();
    expect(screen.queryByTestId('target-kcal')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Start logging' }));
    expect(await getProfile()).toMatchObject({ goal: 'track' });
  });

  it('steps back with Back and keeps the answers', async () => {
    await render(<OnboardingScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: /^Keep my weight/ }));
    await next();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: /^Keep my weight/ })).toBeChecked();
  });
});
