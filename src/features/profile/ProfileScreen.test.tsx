import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { writeSetting } from '@/db/user/settings';
import { DEFAULT_SETTINGS, useSettingsStore } from '@/stores/settings';

import { ProfileScreen } from './ProfileScreen';

jest.mock('@/db/user/settings', () => ({
  readAllSettings: jest.fn(async () => ({})),
  writeSetting: jest.fn(async () => {}),
}));

beforeEach(() => {
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
});

describe('Profile tab', () => {
  it('switches the theme to Dark and saves it', async () => {
    await render(<ProfileScreen />);

    expect(screen.getByRole('radio', { name: 'Same as phone' })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: 'Dark' }));

    expect(writeSetting).toHaveBeenCalledWith('theme', 'dark');
    expect(await screen.findByRole('radio', { name: 'Dark', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Same as phone' })).not.toBeChecked();
  });
});
