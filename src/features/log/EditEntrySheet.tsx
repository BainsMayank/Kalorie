import type { LogEntry } from '@/db/user/schema';
import { useFood } from '@/features/foods/useFood';

import { EntrySheet } from './EntrySheet';
import { QuickAddSheet } from './QuickAddSheet';

/** The Edit entry sheet (SPEC §2.6): the quick-add form, or the food's sheet once it loads. */
export function EditEntrySheet({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  if (entry.foodSource === 'quick') {
    return <QuickAddSheet mode="edit" entry={entry} onClose={onClose} onSaved={onClose} />;
  }
  return <EditFoodEntrySheet entry={entry} onClose={onClose} />;
}

function EditFoodEntrySheet({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const food = useFood(Number(entry.foodId));
  if (food.status !== 'found') return null;
  return (
    <EntrySheet mode="edit" entry={entry} food={food.food} onClose={onClose} onSaved={onClose} />
  );
}
