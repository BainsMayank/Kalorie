import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { BottomSheet, Button, ChoiceChips, TextField } from '@/components';
import {
  clearFlags,
  fetchFlags,
  flagFood,
  unflagFood,
  type FoodFlag,
  type GroupResult,
} from '@/db/cloud/groups';
import type { FoodDetail } from '@/db/foods';
import { FLAG_NOTE_MAX, FLAG_REASONS, type FlagReason, type GroupProblem } from '@/lib/group';
import { useGroupStore } from '@/stores/group';
import { useTheme } from '@/theme';

/**
 * Group sharing on a food's screen (Stage 11c), for foods in user.db:
 *  · the person's own recipe or product: *Share with my group*, and any flags others put on it,
 *    with *Mark as fixed*;
 *  · a group food: who shared it, how many think it is wrong, and *Something looks wrong?*.
 * Shows nothing for foods.db foods, or for the person's own foods while they are in no group.
 */
export function FoodSharingCard({ food }: { food: FoodDetail }) {
  const { colors, spacing, radius } = useTheme();
  const status = useGroupStore((state) => state.status);
  const group = useGroupStore((state) => state.group);
  const sharing = food.sharing;
  if (!sharing) return null;
  if (sharing.kind === 'own' && group === null && !sharing.shareWithGroup) return null;

  return (
    <View
      style={{
        marginTop: spacing.lg,
        padding: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
      }}
    >
      {sharing.kind === 'own' ? (
        <OwnFoodSharing
          foodId={food.foodId}
          on={sharing.shareWithGroup}
          sent={sharing.sharedAt !== null}
          groupName={group?.name ?? null}
          online={status === 'member'}
        />
      ) : (
        <GroupFoodFlags
          foodId={food.foodId}
          addedBy={sharing.addedBy}
          online={status === 'member'}
        />
      )}
    </View>
  );
}

/** The switch, whether the group has it yet, and flags others put on it. */
function OwnFoodSharing({
  foodId,
  on,
  sent,
  groupName,
  online,
}: {
  foodId: string;
  on: boolean;
  sent: boolean;
  groupName: string | null;
  online: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const setShare = useGroupStore((state) => state.setShare);
  const [busy, setBusy] = useState(false);
  const flags = useFoodFlags(foodId, online && on && sent);

  const toggle = async (next: boolean) => {
    setBusy(true);
    await setShare(foodId, next).catch(() => false);
    setBusy(false);
  };

  return (
    <>
      <View style={[styles.row, { gap: spacing.md }]}>
        <View style={styles.flex}>
          <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
            {t('group.share.switch')}
          </Text>
          {groupName && (
            <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
              {t('group.share.hint', { group: groupName })}
            </Text>
          )}
        </View>
        <Switch
          testID="share-with-group"
          accessibilityLabel={t('group.share.switch')}
          value={on}
          disabled={busy}
          onValueChange={(next) => void toggle(next)}
          trackColor={{ true: colors.text, false: colors.border }}
          thumbColor={colors.surface}
        />
      </View>
      {on && !sent && !busy && (
        <Text
          style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: spacing.sm }}
        >
          {t('group.share.waiting')}
        </Text>
      )}

      {flags.list.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
            {t('group.share.flagsTitle')}
          </Text>
          {flags.list.map((flag) => (
            <View key={flag.userId} style={{ marginTop: spacing.sm }}>
              <Text style={{ color: colors.text, fontSize: fontSize.body }}>
                {t('group.share.flagLine', {
                  name: flags.nameOf(flag.userId),
                  reason: t(`group.flag.reasons.${flag.reason}`),
                })}
              </Text>
              {flag.note && (
                <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                  {t('group.share.flagNote', { note: flag.note })}
                </Text>
              )}
            </View>
          ))}
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.caption,
              marginTop: spacing.md,
            }}
          >
            {t('group.share.fixedHint')}
          </Text>
          <View style={{ marginTop: spacing.sm }}>
            <Button
              kind="secondary"
              label={t('group.share.markFixed')}
              onPress={() => void flags.act(() => clearFlags(foodId))}
              disabled={flags.busy}
            />
          </View>
          <ProblemLine problem={flags.problem} />
        </View>
      )}
    </>
  );
}

/** Who shared it, the flags on it, and flagging it (or taking the person's flag back). */
function GroupFoodFlags({
  foodId,
  addedBy,
  online,
}: {
  foodId: string;
  addedBy: string;
  online: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const flags = useFoodFlags(foodId, online);
  const [flagging, setFlagging] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <>
      <Text style={{ color: colors.text, fontSize: fontSize.body, fontWeight: '600' }}>
        {addedBy ? t('group.food.sharedBy', { name: addedBy }) : t('group.food.sharedInGroup')}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
        {t('group.food.onlySharer')}
      </Text>
      {flags.list.length > 0 && (
        <Text style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.md }}>
          {t('group.food.flagged', { count: flags.list.length })}
        </Text>
      )}
      {sent && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.md }}
        >
          {t('group.flag.sent', { name: addedBy })}
        </Text>
      )}
      {online && flags.loaded && (
        <View style={{ marginTop: spacing.md }}>
          {flags.mine ? (
            <>
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                {t('group.food.youFlagged')}
              </Text>
              <Button
                kind="text"
                label={t('group.food.unflag')}
                onPress={() => {
                  setSent(false);
                  void flags.act(() => unflagFood(foodId));
                }}
                disabled={flags.busy}
              />
            </>
          ) : (
            <Button
              kind="secondary"
              label={t('group.food.flag')}
              onPress={() => setFlagging(true)}
              disabled={flags.busy}
            />
          )}
        </View>
      )}
      <ProblemLine problem={flags.problem} />

      {flagging && (
        <FlagSheet
          addedBy={addedBy}
          onClose={() => setFlagging(false)}
          onSend={async (reason, note) => {
            const ok = await flags.act(() => flagFood(foodId, reason, note));
            if (ok) {
              setFlagging(false);
              setSent(true);
            }
          }}
          busy={flags.busy}
          problem={flags.problem}
        />
      )}
    </>
  );
}

/** Picks what looks wrong, with an optional note for the person who shared it. */
function FlagSheet({
  addedBy,
  onClose,
  onSend,
  busy,
  problem,
}: {
  addedBy: string;
  onClose: () => void;
  onSend: (reason: FlagReason, note: string | null) => Promise<void>;
  busy: boolean;
  problem: GroupProblem | null;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [reason, setReason] = useState<FlagReason | null>(null);
  const [note, setNote] = useState('');

  return (
    <BottomSheet
      title={t('group.flag.title')}
      onClose={() => !busy && onClose()}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button
            testID="send-flag"
            label={busy ? t('group.flag.sending') : t('group.flag.send')}
            onPress={() => reason && void onSend(reason, note.trim() || null)}
            disabled={busy || reason === null}
          />
          <Button kind="text" label={t('group.flag.cancel')} onPress={onClose} disabled={busy} />
        </View>
      }
    >
      <ChoiceChips
        label={t('group.flag.reasonLabel')}
        choices={FLAG_REASONS.map((value) => ({
          value,
          label: t(`group.flag.reasons.${value}`),
        }))}
        selected={reason}
        onSelect={setReason}
      />
      <TextField
        label={t('group.flag.noteLabel', { name: addedBy || t('group.food.sharedInGroup') })}
        value={note}
        onChangeText={setNote}
        placeholder={t('group.flag.notePlaceholder')}
        autoCapitalize="sentences"
        autoCorrect
        multiline
        maxLength={FLAG_NOTE_MAX}
      />
      <ProblemLine problem={problem} />
    </BottomSheet>
  );
}

function ProblemLine({ problem }: { problem: GroupProblem | null }) {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  if (problem === null) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.md }}
    >
      {t(`group.problems.${problem}`)}
    </Text>
  );
}

/**
 * The flags on a shared food, read from the server while `enabled` (online, in the group). `act`
 * runs a change (flag, unflag, clear) and reads the flags again.
 */
function useFoodFlags(foodId: string, enabled: boolean) {
  const group = useGroupStore((state) => state.group);
  const [list, setList] = useState<FoodFlag[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<GroupProblem | null>(null);
  /** Goes up after each change, to read the flags again. */
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    (async () => {
      const result = await fetchFlags(foodId);
      if (current && result.ok) {
        setList(result.value);
        setLoaded(true);
      }
    })();
    return () => {
      current = false;
    };
  }, [enabled, foodId, version]);

  const act = async (change: () => Promise<GroupResult<null>>): Promise<boolean> => {
    setBusy(true);
    setProblem(null);
    const result = await change();
    if (result.ok) setVersion((n) => n + 1);
    else setProblem(result.problem);
    setBusy(false);
    return result.ok;
  };

  return {
    list,
    loaded,
    busy,
    problem,
    act,
    mine: group !== null && list.some((flag) => flag.userId === group.myUserId),
    nameOf: (userId: string) => group?.members.find((m) => m.userId === userId)?.name ?? '—',
  };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
