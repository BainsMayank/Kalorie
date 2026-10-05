import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, Button, SourceBadge, TextField } from '@/components';
import type { GroupResult } from '@/db/cloud/groups';
import type { CustomFood } from '@/db/user/schema';
import { listCustomFoods } from '@/db/user/customFoods';
import { listGroupFoods } from '@/db/user/groupFoods';
import { foodRoute } from '@/features/foods/foodRoute';
import {
  GROUP_NAME_MAX,
  MEMBER_NAME_MAX,
  formatInviteCode,
  readInviteCode,
  readName,
  type GroupProblem,
} from '@/lib/group';
import { useAccountStore } from '@/stores/account';
import { useGroupStore } from '@/stores/group';
import { useMyFoodsStore } from '@/stores/myFoods';
import { useTheme } from '@/theme';

/** A line under a form: a typing mistake or a server answer. */
type Problem = GroupProblem | 'nameEmpty' | 'groupNameEmpty' | 'codeInvalid';

/**
 * My group (Profile → My group, Stage 11c): start a group or join one with its 6-character
 * invite code; once in one, the code to send, who is in it, the foods shared in it, and *Leave
 * group*. Sharing a food is switched on from that food's own screen.
 */
export function GroupScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const router = useRouter();
  const account = useAccountStore((state) => state.status);
  const status = useGroupStore((state) => state.status);
  const group = useGroupStore((state) => state.group);
  const refresh = useGroupStore((state) => state.refresh);
  const [pulling, setPulling] = useState(false);

  // Ask the server again every time the screen is opened.
  useFocusEffect(
    useCallback(() => {
      if (account === 'signedIn') void refresh();
    }, [account, refresh]),
  );

  const paragraph = (words: string) => (
    <Text style={{ color: colors.textSecondary, fontSize: fontSize.body, marginTop: spacing.md }}>
      {words}
    </Text>
  );

  let body: React.ReactNode;
  if (account === 'notSetUp') {
    body = paragraph(t('group.notSetUp'));
  } else if (account !== 'signedIn') {
    body = (
      <>
        {paragraph(t('group.intro'))}
        {paragraph(t('group.signInFirst'))}
        <View style={{ marginTop: spacing.xl }}>
          <Button label={t('group.signIn')} onPress={() => router.push('/account')} />
        </View>
      </>
    );
  } else if (group !== null) {
    body = <InGroup />;
  } else if (status === 'none') {
    body = <StartOrJoin />;
  } else if (status === 'unreachable') {
    body = (
      <>
        {paragraph(t('group.unreachable'))}
        <View style={{ marginTop: spacing.lg }}>
          <Button kind="secondary" label={t('group.tryAgain')} onPress={() => void refresh()} />
        </View>
      </>
    );
  } else {
    body = (
      <ActivityIndicator
        style={{ marginTop: spacing.xl }}
        color={colors.textSecondary}
        accessibilityLabel={t('app.loading')}
      />
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          refreshControl={
            account === 'signedIn' ? (
              <RefreshControl
                refreshing={pulling}
                onRefresh={() => {
                  setPulling(true);
                  void refresh().finally(() => setPulling(false));
                }}
                tintColor={colors.textSecondary}
              />
            ) : undefined
          }
        >
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Not in a group yet: start one, or join one with a code. The name is asked once for both. */
function StartOrJoin() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const start = useGroupStore((state) => state.start);
  const join = useGroupStore((state) => state.join);
  const [myName, setMyName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [codeText, setCodeText] = useState('');
  const [busy, setBusy] = useState<'start' | 'join' | null>(null);
  const [problem, setProblem] = useState<{ where: 'start' | 'join'; problem: Problem } | null>(
    null,
  );

  const run = async (
    where: 'start' | 'join',
    action: (name: string) => Promise<GroupResult<null>>,
  ) => {
    const name = readName(myName, MEMBER_NAME_MAX);
    if (name === null) {
      setProblem({ where, problem: 'nameEmpty' });
      return;
    }
    setBusy(where);
    setProblem(null);
    const result = await action(name);
    setBusy(null);
    if (!result.ok) setProblem({ where, problem: result.problem });
  };

  const startGroup = () => {
    const name = readName(groupName, GROUP_NAME_MAX);
    if (name === null) setProblem({ where: 'start', problem: 'groupNameEmpty' });
    else void run('start', (me) => start(name, me));
  };

  const joinGroup = () => {
    const code = readInviteCode(codeText);
    if (code === null) setProblem({ where: 'join', problem: 'codeInvalid' });
    else void run('join', (me) => join(code, me));
  };

  const problemLine = (where: 'start' | 'join') =>
    problem?.where === where && (
      <Text
        accessibilityLiveRegion="polite"
        style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.md }}
      >
        {t(`group.problems.${problem.problem}`)}
      </Text>
    );

  const heading = (words: string) => (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.text,
        fontSize: fontSize.title,
        fontWeight: '600',
        marginTop: spacing.xxl,
      }}
    >
      {words}
    </Text>
  );

  return (
    <>
      <Text style={{ color: colors.text, fontSize: fontSize.body }}>{t('group.intro')}</Text>
      <TextField
        label={t('group.myNameLabel')}
        value={myName}
        onChangeText={(next) => {
          setMyName(next);
          setProblem(null);
        }}
        placeholder={t('group.myNamePlaceholder')}
        autoCapitalize="words"
        autoComplete="given-name"
        maxLength={MEMBER_NAME_MAX}
      />
      <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption, marginTop: 4 }}>
        {t('group.myNameHint')}
      </Text>

      {heading(t('group.joinTitle'))}
      <TextField
        label={t('group.codeLabel')}
        value={codeText}
        onChangeText={(next) => {
          setCodeText(next);
          setProblem(null);
        }}
        onSubmitEditing={joinGroup}
        placeholder={t('group.codePlaceholder')}
        autoCapitalize="characters"
        returnKeyType="go"
        maxLength={9}
        large
      />
      {problemLine('join')}
      <View style={{ marginTop: spacing.lg }}>
        <Button
          label={busy === 'join' ? t('group.joining') : t('group.join')}
          onPress={joinGroup}
          disabled={busy !== null}
        />
      </View>

      {heading(t('group.startTitle'))}
      <TextField
        label={t('group.groupNameLabel')}
        value={groupName}
        onChangeText={(next) => {
          setGroupName(next);
          setProblem(null);
        }}
        onSubmitEditing={startGroup}
        placeholder={t('group.groupNamePlaceholder')}
        autoCapitalize="words"
        returnKeyType="done"
        maxLength={GROUP_NAME_MAX}
      />
      {problemLine('start')}
      <View style={{ marginTop: spacing.lg }}>
        <Button
          kind="secondary"
          label={busy === 'start' ? t('group.starting') : t('group.start')}
          onPress={startGroup}
          disabled={busy !== null}
        />
      </View>
    </>
  );
}

/** In a group: its code, its people, its foods, and *Leave group*. */
function InGroup() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize, radius } = useTheme();
  const group = useGroupStore((state) => state.group)!;
  const status = useGroupStore((state) => state.status);
  const newCode = useGroupStore((state) => state.newCode);
  const leave = useGroupStore((state) => state.leave);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<GroupProblem | null>(null);
  const [notice, setNotice] = useState<'newCodeDone' | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const foods = useSharedFoods();

  const step = async (action: () => Promise<GroupResult<null>>, onDone: () => void) => {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    const result = await action();
    setBusy(false);
    if (result.ok) onDone();
    else setProblem(result.problem);
  };

  const code = formatInviteCode(group.inviteCode);
  const sendCode = () =>
    void Share.share({ message: t('group.shareMessage', { group: group.name, code }) }).catch(
      () => {},
    );

  const section = (title: string) => (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.textSecondary,
        fontSize: fontSize.caption,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
      }}
    >
      {title}
    </Text>
  );
  const card = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden' as const,
  };
  const messages = (
    <>
      {problem && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.md }}
        >
          {t(`group.problems.${problem}`)}
        </Text>
      )}
      {notice && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.md }}
        >
          {t(`group.${notice}`)}
        </Text>
      )}
    </>
  );

  return (
    <>
      <Text
        accessibilityRole="header"
        style={{ color: colors.text, fontSize: fontSize.headline, fontWeight: '600' }}
      >
        {group.name}
      </Text>
      {status === 'unreachable' && (
        <Text
          style={{ color: colors.textSecondary, fontSize: fontSize.body, marginTop: spacing.sm }}
        >
          {t('group.unreachable')}
        </Text>
      )}

      {section(t('group.inviteTitle'))}
      <View style={[card, { padding: spacing.lg }]}>
        <Text
          testID="invite-code"
          selectable
          accessibilityLabel={`${t('group.inviteTitle')}: ${[...group.inviteCode].join(' ')}`}
          style={{
            color: colors.text,
            fontSize: fontSize.headline,
            fontWeight: '600',
            letterSpacing: 4,
            textAlign: 'center',
          }}
        >
          {code}
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: fontSize.caption,
            textAlign: 'center',
            marginTop: spacing.sm,
          }}
        >
          {t('group.inviteHint')}
        </Text>
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Button label={t('group.shareCode')} onPress={sendCode} />
          <Button
            kind="text"
            label={t('group.newCode')}
            onPress={() => void step(newCode, () => setNotice('newCodeDone'))}
            disabled={busy}
          />
        </View>
        {messages}
      </View>

      {section(t('group.people'))}
      <View style={card}>
        {group.members.map((member, index) => (
          <Text
            key={member.userId}
            style={{
              color: colors.text,
              fontSize: fontSize.body,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            }}
          >
            {member.userId === group.myUserId ? t('group.you', { name: member.name }) : member.name}
          </Text>
        ))}
      </View>

      {section(t('group.yourFoods'))}
      <FoodList foods={foods.own} empty={t('group.yourFoodsEmpty')} />
      {section(t('group.othersFoods'))}
      <FoodList foods={foods.others} empty={t('group.othersFoodsEmpty')} />

      <View style={{ marginTop: spacing.xxl }}>
        <Button
          kind="secondary"
          label={t('group.leave')}
          onPress={() => {
            setProblem(null);
            setConfirmLeave(true);
          }}
          disabled={busy}
        />
      </View>

      {confirmLeave && (
        <BottomSheet
          title={t('group.leaveTitle', { group: group.name })}
          onClose={() => !busy && setConfirmLeave(false)}
          footer={
            <View style={{ gap: spacing.sm }}>
              <Button
                testID="confirm-leave"
                label={busy ? t('group.leaving') : t('group.leaveConfirm')}
                onPress={() => void step(leave, () => setConfirmLeave(false))}
                disabled={busy}
              />
              <Button
                kind="text"
                label={t('group.leaveKeep')}
                onPress={() => setConfirmLeave(false)}
                disabled={busy}
              />
            </View>
          }
        >
          <Text style={{ color: colors.text, fontSize: fontSize.body }}>
            {t('group.leaveBody')}
          </Text>
          {messages}
        </BottomSheet>
      )}
    </>
  );
}

/** The person's own shared foods and the group's, read again whenever foods change. */
function useSharedFoods(): { own: CustomFood[]; others: CustomFood[] } {
  const revision = useMyFoodsStore((state) => state.revision);
  const [foods, setFoods] = useState<{ own: CustomFood[]; others: CustomFood[] }>({
    own: [],
    others: [],
  });
  useEffect(() => {
    let current = true;
    (async () => {
      const own = (await listCustomFoods()).filter((f) => f.shareWithGroup);
      const others = await listGroupFoods();
      if (current) setFoods({ own, others });
    })().catch(() => {});
    return () => {
      current = false;
    };
  }, [revision]);
  return foods;
}

/** A card of foods; tapping one opens it. */
function FoodList({ foods, empty }: { foods: readonly CustomFood[]; empty: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, fontSize, radius, minTapTarget } = useTheme();
  if (foods.length === 0) {
    return <Text style={{ color: colors.textSecondary, fontSize: fontSize.body }}>{empty}</Text>;
  }
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: radius.md,
        overflow: 'hidden',
      }}
    >
      {foods.map((food, index) => (
        <Pressable
          key={food.id}
          accessibilityRole="button"
          accessibilityLabel={food.name}
          onPress={() => router.push(foodRoute('custom', food.id))}
          style={({ pressed }) => [
            styles.row,
            {
              minHeight: minTapTarget + 8,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              gap: spacing.md,
              borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            },
          ]}
        >
          <View style={styles.flex}>
            <Text style={{ color: colors.text, fontSize: fontSize.body }}>{food.name}</Text>
            {food.addedBy !== null && (
              <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
                {t('group.sharedBy', { name: food.addedBy })}
              </Text>
            )}
          </View>
          <SourceBadge source={food.kind} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
