import { act } from '@testing-library/react-native';

import { readAllSettings, writeSetting } from '@/db/user/settings';

import { DEFAULT_SETTINGS, useSettingsStore } from './settings';

// Replace user.db with a simple in-memory table, so the test runs without a phone.
jest.mock('@/db/user/settings', () => {
  const table = new Map<string, string>();
  return {
    __table: table,
    readAllSettings: jest.fn(async () => {
      const result: Record<string, unknown> = {};
      table.forEach((value, key) => {
        try {
          result[key] = JSON.parse(value);
        } catch {
          // skipped, like the real function
        }
      });
      return result;
    }),
    writeSetting: jest.fn(async (key: string, value: unknown) => {
      table.set(key, JSON.stringify(value));
    }),
  };
});

const table: Map<string, string> = jest.requireMock('@/db/user/settings').__table;

beforeEach(() => {
  table.clear();
  jest.clearAllMocks();
  useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: false });
});

describe('settings store', () => {
  it('starts with the phone theme and not yet loaded', () => {
    const state = useSettingsStore.getState();
    expect(state.theme).toBe('system');
    expect(state.loaded).toBe(false);
  });

  it('loads the saved theme from the database', async () => {
    table.set('theme', JSON.stringify('dark'));

    await act(() => useSettingsStore.getState().load());

    expect(readAllSettings).toHaveBeenCalledTimes(1);
    expect(useSettingsStore.getState()).toMatchObject({ theme: 'dark', loaded: true });
  });

  it('uses the default when nothing is saved yet', async () => {
    await act(() => useSettingsStore.getState().load());

    expect(useSettingsStore.getState()).toMatchObject({ theme: 'system', loaded: true });
  });

  it('ignores a saved value it does not understand', async () => {
    table.set('theme', JSON.stringify('purple'));

    await act(() => useSettingsStore.getState().load());

    expect(useSettingsStore.getState().theme).toBe('system');
  });

  it('saves a new theme to the database and updates the store', async () => {
    await act(() => useSettingsStore.getState().setTheme('light'));

    expect(writeSetting).toHaveBeenCalledWith('theme', 'light');
    expect(table.get('theme')).toBe('"light"');
    expect(useSettingsStore.getState().theme).toBe('light');

    // A fresh start reads the same value back.
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: false });
    await act(() => useSettingsStore.getState().load());
    expect(useSettingsStore.getState().theme).toBe('light');
  });

  it('keeps the old theme if saving fails', async () => {
    jest.mocked(writeSetting).mockRejectedValueOnce(new Error('disk full'));

    await expect(useSettingsStore.getState().setTheme('dark')).rejects.toThrow('disk full');

    expect(useSettingsStore.getState().theme).toBe('system');
  });
});
