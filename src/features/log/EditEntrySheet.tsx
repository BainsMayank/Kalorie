import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { BottomSheet, Button } from '@/components';
import type { LogEntry } from '@/db/user/schema';
import { useFood } from '@/features/foods/useFood';
import { useLogStore } from '@/stores/log';
import { useTheme } from '@/theme';

import { EntrySheet } from './EntrySheet';
import { entryName } from './names';
import { QuickAddSheet } from './QuickAddSheet';

/** The Edit entry sheet (SPEC §2.6): the quick-add form, or the food's sheet once it loads. */
export function EditEntrySheet({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  if (entry.foodSource === 'quick') {
    return <QuickAddSheet mode="edit" entry={entry} onClose={onClose} onSaved={onClose} />;
  }
  return <EditFoodEntrySheet entry={entry} onClose={onClose} />;
}

function EditFoodEntrySheet({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const food = useFood(entry.foodSource === 'custom' ? 'custom' : 'base', entry.foodId ?? '');
  if (food.status === 'missing') return <FoodGoneSheet entry={entry} onClose={onClose} />;
  if (food.status !== 'found') return null;
  return (
    <EntrySheet mode="edit" entry={entry} food={food.food} onClose={onClose} onSaved={onClose} />
  );
}

/** The entry's food no longer exists (removed from foods.db in an update): it can only go. */
function FoodGoneSheet({ entry, onClose }: { entry: LogEntry; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, fontSize, spacing } = useTheme();
  const removeEntry = useLogStore((state) => state.removeEntry);
  const name = entryName(t, entry);
  return (
    <BottomSheet
      title={name}
      onClose={onClose}
      footer={
        <Button
          label={t('entry.delete')}
          kind="secondary"
          onPress={() => {
            onClose();
            removeEntry(entry.id, t('undo.deleted', { name })).catch(() => {});
          }}
        />
      }
    >
      <Text
        style={{ color: colors.textSecondary, fontSize: fontSize.body, marginBottom: spacing.md }}
      >
        {t('entry.foodGone')}
      </Text>
    </BottomSheet>
  );
}
