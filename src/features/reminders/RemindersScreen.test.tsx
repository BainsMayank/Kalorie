import '@/i18n';

import { fireEvent, render, screen } from '@testing-library/react-native';

import { writeSetting } from '@/db/user/settings';
import { requestNotificationPermission } from '@/features/alerts/notifications';
import { REMINDERS_OFF } from '@/lib/reminders';
import { useLogStore } from '@/stores/log';
import { useSettingsStore } from '@/stores/settings';

import { RemindersScreen } from './RemindersScreen';

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

beforeAll(async () => {
  await useLogStore.getState().load(); // the 4 built-in meal slots
});
beforeEach(() => {
  useSettingsStore.setState({ reminders: REMINDERS_OFF });
  jest.mocked(writeSetting).mockClear();
});

const toggle = (id: string) => screen.getByTestId(`reminder-${id}`);

describe('Reminders screen', () => {
  it('starts with everything off', async () => {
    await render(<RemindersScreen />);
    for (const id of ['breakfast', 'lunch', 'snacks', 'dinner', 'scans']) {
      expect(toggle(id).props.value).toBe(false);
    }
    expect(screen.queryByRole('button', { name: /reminder time/ })).toBeNull();
  });

  it('switches a meal on after asking for permission, and shows its time', async () => {
    await render(<RemindersScreen />);
    await fireEvent(toggle('lunch'), 'valueChange', true);

    expect(requestNotificationPermission).toHaveBeenCalledWith('reminders', 'Reminders');
    expect(useSettingsStore.getState().reminders.meals.lunch).toEqual({
      on: true,
      minute: 13 * 60 + 30,
    });
    expect(writeSetting).toHaveBeenCalledWith('reminders', {
      meals: { lunch: { on: true, at: '13:30' } },
      pendingScans: { on: false, at: '21:00' },
    });
    expect(screen.getByRole('button', { name: 'Lunch reminder time, 1:30 pm' })).toBeOnTheScreen();
  });

  it('changes the time with the time picker', async () => {
    await render(<RemindersScreen />);
    await fireEvent(toggle('dinner'), 'valueChange', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Dinner reminder time, 8:30 pm' }));
    await fireEvent.press(screen.getByRole('radio', { name: '9 pm' }));
    expect(useSettingsStore.getState().reminders.meals.dinner).toEqual({
      on: true,
      minute: 21 * 60 + 30,
    });
  });

  it('allows at most 3 reminders a day', async () => {
    await render(<RemindersScreen />);
    for (const id of ['breakfast', 'lunch', 'scans']) {
      await fireEvent(toggle(id), 'valueChange', true);
    }
    expect(screen.getByText(/That's 3 a day/)).toBeOnTheScreen();
    expect(toggle('dinner').props.disabled).toBe(true);
    expect(toggle('lunch').props.disabled).toBe(false); // switching one off is always fine
  });

  it('stays off and says why when notifications are not allowed', async () => {
    jest.mocked(requestNotificationPermission).mockResolvedValueOnce(false);
    await render(<RemindersScreen />);
    await fireEvent(toggle('breakfast'), 'valueChange', true);
    expect(toggle('breakfast').props.value).toBe(false);
    expect(screen.getByText(/Notifications are turned off/)).toBeOnTheScreen();
    expect(writeSetting).not.toHaveBeenCalled();
  });
});
