import { act } from '@testing-library/react-native';

import { UNDO_MS, useUndoStore } from './undo';

beforeEach(() => {
  jest.useFakeTimers();
  useUndoStore.getState().dismiss();
});
afterEach(() => jest.useRealTimers());

describe('undo store', () => {
  it('offers Undo for 5 seconds, then hides it', async () => {
    await act(async () => useUndoStore.getState().show('Deleted Mixed dal', async () => {}));
    expect(useUndoStore.getState().current?.message).toBe('Deleted Mixed dal');

    await act(async () => jest.advanceTimersByTime(UNDO_MS - 1));
    expect(useUndoStore.getState().current).not.toBeNull();
    await act(async () => jest.advanceTimersByTime(1));
    expect(useUndoStore.getState().current).toBeNull();
  });

  it('reverses the action once and hides the bar', async () => {
    const revert = jest.fn(async () => {});
    await act(async () => useUndoStore.getState().show('Copied', revert));
    await act(() => useUndoStore.getState().undo());
    await act(() => useUndoStore.getState().undo()); // nothing left to undo

    expect(revert).toHaveBeenCalledTimes(1);
    expect(useUndoStore.getState().current).toBeNull();
  });

  it('replaces an older action, which can no longer be undone', async () => {
    const first = jest.fn(async () => {});
    const second = jest.fn(async () => {});
    await act(async () => useUndoStore.getState().show('first', first));
    await act(async () => jest.advanceTimersByTime(3000));
    await act(async () => useUndoStore.getState().show('second', second));

    // The new action gets its own full 5 seconds.
    await act(async () => jest.advanceTimersByTime(3000));
    expect(useUndoStore.getState().current?.message).toBe('second');
    await act(() => useUndoStore.getState().undo());
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
  });
});
