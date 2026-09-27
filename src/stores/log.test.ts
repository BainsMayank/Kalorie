import { act } from '@testing-library/react-native';

import { listEntriesForDay } from '@/db/user/entries';

import { useLogStore } from './log';
import { useUndoStore } from './undo';

// A fresh in-memory user.db, built from the real migrations.
jest.mock('@/db/user/client', () => {
  const db = jest.requireActual('@/db/user/testing').openUserDbForTests();
  return { getUserDb: () => db };
});

const entry = {
  day: '2026-09-27',
  loggedAt: new Date(2026, 8, 27, 13, 30).getTime(),
  slotId: 'lunch',
  foodSource: 'base' as const,
  foodId: '1',
  name: 'Mixed dal',
  qty: 1,
  unit: 'katori',
  grams: 150,
};

describe('log store', () => {
  it('starts on today', () => {
    jest.useFakeTimers({ now: new Date(2026, 8, 27, 2, 0) });
    jest.isolateModules(() => {
      const { useLogStore: fresh } = jest.requireActual('./log') as typeof import('./log');
      expect(fresh.getState().day).toBe('2026-09-26'); // 2 am still belongs to the day before
    });
    jest.useRealTimers();
  });

  it('loads the default meal slots', async () => {
    await act(() => useLogStore.getState().load());
    const { slots, loaded } = useLogStore.getState();
    expect(loaded).toBe(true);
    expect(slots.map((s) => s.id)).toEqual(['breakfast', 'lunch', 'snacks', 'dinner']);
  });

  it('saves, edits and deletes entries, counting each change', async () => {
    const start = useLogStore.getState().revision;
    const saved = await act(() => useLogStore.getState().addEntry(entry, 'Logged'));
    await act(() => useLogStore.getState().editEntry(saved.id, { qty: 2, grams: 300 }));
    expect(await listEntriesForDay('2026-09-27')).toMatchObject([{ qty: 2, grams: 300 }]);

    await act(() => useLogStore.getState().removeEntry(saved.id, 'Deleted'));
    expect(await listEntriesForDay('2026-09-27')).toEqual([]);
    expect(useLogStore.getState().revision).toBe(start + 3);
  });

  it('undoes a delete: the entry comes back', async () => {
    const saved = await act(() => useLogStore.getState().addEntry(entry, 'Logged'));
    await act(() => useLogStore.getState().removeEntry(saved.id, 'Deleted Mixed dal'));
    expect(useUndoStore.getState().current?.message).toBe('Deleted Mixed dal');

    await act(() => useUndoStore.getState().undo());
    expect((await listEntriesForDay('2026-09-27')).map((e) => e.id)).toEqual([saved.id]);
  });

  it('undoes a log: the entry goes away', async () => {
    await act(() => useLogStore.getState().addEntry({ ...entry, day: '2026-09-10' }, 'Logged'));
    await act(() => useUndoStore.getState().undo());
    expect(await listEntriesForDay('2026-09-10')).toEqual([]);
  });

  it('copies a meal to another day, and Undo takes the whole copy back', async () => {
    const lunch = await listEntriesForDay('2026-09-27');
    const copies = await act(() =>
      useLogStore.getState().copy(lunch, { day: '2026-09-28', slotId: 'dinner' }, 'Copied'),
    );
    expect(await listEntriesForDay('2026-09-28')).toMatchObject([
      { name: 'Mixed dal', slotId: 'dinner', grams: 150, batchId: copies[0].batchId },
    ]);

    await act(() => useUndoStore.getState().undo());
    expect(await listEntriesForDay('2026-09-28')).toEqual([]);
    expect(await listEntriesForDay('2026-09-27')).toHaveLength(1); // the original stays
  });

  it('switches the day', async () => {
    await act(async () => useLogStore.getState().setDay('2026-09-20'));
    expect(useLogStore.getState().day).toBe('2026-09-20');
  });
});
