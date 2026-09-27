import '@/i18n';

import { render, screen } from '@testing-library/react-native';

import { TodayScreen } from './TodayScreen';

// The Today tab reads the theme from the settings store, which talks to user.db.
jest.mock('@/db/user/settings', () => ({
  readAllSettings: jest.fn(async () => ({})),
  writeSetting: jest.fn(async () => {}),
}));

describe('Today tab', () => {
  it('shows its title and placeholder text', async () => {
    await render(<TodayScreen />);

    expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
    expect(screen.getByText('Your day at a glance will show up here.')).toBeOnTheScreen();
  });
});
