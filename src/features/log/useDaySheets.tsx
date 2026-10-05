import { useState, type ReactNode } from 'react';

import type { LogEntry, MealSlot } from '@/db/user/schema';
import { SaveThaliSheet } from '@/features/thalis/SaveThaliSheet';

import { CopySheet } from './CopySheet';
import { EditEntrySheet } from './EditEntrySheet';
import type { EntryView } from './useDayLog';

/** What the Copy sheet copies: one meal, or the whole day. */
type Copying = { slot?: MealSlot; entries: LogEntry[] };

/**
 * The sheets a day's meals open (Today and the Log tab): Edit entry, Copy a meal or the day, and
 * Save as thali. The screen calls `edit` / `copy` / `saveThali` and renders `sheets` last, on top
 * of everything else.
 */
export function useDaySheets(day: string): {
  edit: (entry: LogEntry) => void;
  copy: (entries: LogEntry[], slot?: MealSlot) => void;
  saveThali: (slot: MealSlot, entries: EntryView[]) => void;
  sheets: ReactNode;
} {
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [copying, setCopying] = useState<Copying | null>(null);
  const [savingThali, setSavingThali] = useState<{ slot: MealSlot; entries: EntryView[] } | null>(
    null,
  );

  const sheets = (
    <>
      {editing && <EditEntrySheet entry={editing} onClose={() => setEditing(null)} />}
      {copying && (
        <CopySheet
          entries={copying.entries}
          slot={copying.slot}
          fromDay={day}
          onClose={() => setCopying(null)}
        />
      )}
      {savingThali && (
        <SaveThaliSheet
          slot={savingThali.slot}
          entries={savingThali.entries}
          onClose={() => setSavingThali(null)}
        />
      )}
    </>
  );

  return {
    edit: setEditing,
    copy: (entries, slot) => setCopying({ entries, slot }),
    saveThali: (slot, entries) => setSavingThali({ slot, entries }),
    sheets,
  };
}
