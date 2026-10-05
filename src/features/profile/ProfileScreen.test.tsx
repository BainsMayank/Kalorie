import i18n from '@/i18n';

import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { writeSetting } from '@/db/user/settings';
import { useAccountStore } from '@/stores/account';
import { useGoalsStore } from '@/stores/goals';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settings';

import { ProfileScreen } from './ProfileScreen';

jest.mock('@/db/user/settings', () => ({
  readAllSettings: jest.fn(async () => ({})),
  writeSetting: jest.fn(async () => {}),
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const row = (kcal: number | null) => ({
  id: 'targets',
  effectiveFrom: '2026-09-01',
  kcal,
  proteinG: null,
  carbG: null,
  fatG: null,
  fibreG: null,
  sodiumMgLimit: 2000,
  sugarGLimit: 50,
  satFatGLimit: 22,
  fatGLimit: 67,
  isCustom: false,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
});

beforeEach(() => {
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
  useGoalsStore.setState({ targetRows: [row(1850)] });
  useAccountStore.setState({ status: 'signedOut', email: null });
});

describe('Profile tab', () => {
  it('shows today’s calorie target and opens Goals', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('1,850 kcal a day')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Goals' }));
    expect(mockPush).toHaveBeenCalledWith('/goals');
  });

  it('says so when there is no calorie target', async () => {
    useGoalsStore.setState({ targetRows: [row(null)] });
    await render(<ProfileScreen />);
    expect(screen.getByText('Just tracking, no calorie target')).toBeOnTheScreen();
  });

  it('switches the theme to Dark and saves it', async () => {
    await render(<ProfileScreen />);
    const theme = () => within(screen.getByLabelText('Theme'));

    expect(theme().getByRole('radio', { name: 'Same as phone' })).toBeChecked();

    await fireEvent.press(theme().getByRole('radio', { name: 'Dark' }));

    expect(writeSetting).toHaveBeenCalledWith('theme', 'dark');
    expect(await theme().findByRole('radio', { name: 'Dark', checked: true })).toBeOnTheScreen();
    expect(theme().getByRole('radio', { name: 'Same as phone' })).not.toBeChecked();
  });

  it('turns on hide numbers and saves it', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('1,850 kcal a day')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('hide-numbers'), 'valueChange', true);

    expect(writeSetting).toHaveBeenCalledWith('hide_numbers', true);
    expect(useSettingsStore.getState().hideNumbers).toBe(true);
    // The Goals row no longer shows the calorie number.
    expect(await screen.findByText('Your targets and limits')).toBeOnTheScreen();
    expect(screen.queryByText('1,850 kcal a day')).toBeNull();
  });

  it('switches the whole app to Hindi and back', async () => {
    await render(<ProfileScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: 'हिन्दी' }));

    expect(writeSetting).toHaveBeenCalledWith('language', 'hi');
    expect(i18n.language).toBe('hi');
    expect(await screen.findByText('रोज़ 1,850 kcal')).toBeOnTheScreen();
    expect(screen.getByText('प्रोफ़ाइल')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
    expect(i18n.language).toBe('en');
    expect(await screen.findByText('1,850 kcal a day')).toBeOnTheScreen();
  });

  it('opens Export CSV', async () => {
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Export CSV' }));
    expect(mockPush).toHaveBeenCalledWith('/export');
  });

  it('shows the optional account and opens it', async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText('Optional — Kalorie works the same without one')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Account' }));
    expect(mockPush).toHaveBeenCalledWith('/account');
  });

  it('shows who is signed in', async () => {
    useAccountStore.setState({ status: 'signedIn', email: 'asha@mail.com' });
    await render(<ProfileScreen />);
    expect(screen.getByText('Signed in as asha@mail.com')).toBeOnTheScreen();
  });

  it('opens Privacy, and hides Account when accounts are not set up', async () => {
    useAccountStore.setState({ status: 'notSetUp', email: null });
    await render(<ProfileScreen />);
    expect(screen.queryByRole('button', { name: 'Account' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Privacy' }));
    expect(mockPush).toHaveBeenCalledWith('/privacy');
  });
});
