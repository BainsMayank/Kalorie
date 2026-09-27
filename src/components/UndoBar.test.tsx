import '@/i18n';

import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { UNDO_MS, useUndoStore } from '@/stores/undo';

import { UndoBar } from './UndoBar';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('UndoBar', () => {
  it('shows nothing until there is something to undo', async () => {
    await render(<UndoBar placement="screen" />);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('shows the message, and Undo reverses the action', async () => {
    const revert = jest.fn(async () => {});
    await render(<UndoBar placement="screen" />);
    await act(async () => useUndoStore.getState().show('Removed Mixed dal', revert));

    expect(screen.getByText('Removed Mixed dal')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(revert).toHaveBeenCalled();
    expect(screen.queryByText('Removed Mixed dal')).toBeNull();
  });

  it('goes away by itself after 5 seconds', async () => {
    await render(<UndoBar placement="screen" />);
    await act(async () => useUndoStore.getState().show('Copied 2 items', async () => {}));
    await act(async () => jest.advanceTimersByTime(UNDO_MS));
    expect(screen.queryByText('Copied 2 items')).toBeNull();
  });
});
