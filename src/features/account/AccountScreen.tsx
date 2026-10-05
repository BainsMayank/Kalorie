import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet, Button, TextField } from '@/components';
import {
  deleteAccount,
  sendSignInCode,
  signOut,
  verifySignInCode,
  type AccountResult,
} from '@/db/cloud/auth';
import { CODE_MAX_DIGITS, readEmail, readSignInCode, type AccountProblem } from '@/lib/account';
import { useAccountStore } from '@/stores/account';
import { useGroupStore } from '@/stores/group';
import { useTheme } from '@/theme';

/** A problem line under the form: a typing mistake or one from the server. */
type Problem = AccountProblem | 'emailEmpty' | 'emailInvalid' | 'codeShort';

/** A calm line after something finished. */
type Notice = 'newCodeSent' | 'signedOut' | 'deleted';

/**
 * Account (Profile → Account, Stage 11a): optional sign-in with a code sent by email, sign out,
 * and *Delete my account and data* (both app stores ask for it). Nothing else in the app changes
 * when signed in or out.
 */
export function AccountScreen() {
  const { t } = useTranslation();
  const { colors, spacing, fontSize } = useTheme();
  const router = useRouter();
  const status = useAccountStore((state) => state.status);
  const signedInEmail = useAccountStore((state) => state.email);

  // Sign-in: first the email, then the code sent to it.
  const [emailText, setEmailText] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [codeText, setCodeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  /** Runs one server step: busy while it runs, its problem shown if it doesn't go through. */
  const step = async (action: () => Promise<AccountResult>, onDone: () => void) => {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    const result = await action();
    setBusy(false);
    if (result.ok) onDone();
    else setProblem(result.problem);
  };

  const sendCode = (again = false) => {
    const read = readEmail(sentTo ?? emailText);
    if (!read.ok) {
      setProblem(read.problem === 'empty' ? 'emailEmpty' : 'emailInvalid');
      return;
    }
    void step(
      () => sendSignInCode(read.email),
      () => {
        setSentTo(read.email);
        setCodeText('');
        if (again) setNotice('newCodeSent');
      },
    );
  };

  const checkCode = () => {
    const code = readSignInCode(codeText);
    if (code === null || sentTo === null) {
      setProblem('codeShort');
      return;
    }
    // Once signed in, the store changes and this screen shows the signed-in part.
    void step(
      () => verifySignInCode(sentTo, code),
      () => setSentTo(null),
    );
  };

  const startOver = () => {
    setSentTo(null);
    setCodeText('');
    setProblem(null);
    setNotice(null);
  };

  const signOutHere = () =>
    void step(signOut, () => {
      setEmailText(signedInEmail ?? '');
      setNotice('signedOut');
    });

  const deleteEverything = () =>
    void step(deleteAccount, () => {
      // The server removed the person's group place and shared foods with the account.
      void useGroupStore
        .getState()
        .forget(true)
        .catch(() => {});
      setConfirmDelete(false);
      setEmailText('');
      setNotice('deleted');
    });

  /** A paragraph of the screen's own words. */
  const paragraph = (words: string, secondary = false) => (
    <Text
      style={{
        color: secondary ? colors.textSecondary : colors.text,
        fontSize: fontSize.body,
        marginTop: spacing.md,
      }}
    >
      {words}
    </Text>
  );

  const messages = (
    <>
      {problem && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.md }}
        >
          {t(`account.problems.${problem}`)}
        </Text>
      )}
      {notice && (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.text, fontSize: fontSize.body, marginTop: spacing.md }}
        >
          {t(`account.${notice}`)}
        </Text>
      )}
    </>
  );

  let body: React.ReactNode;
  if (status === 'loading') {
    body = (
      <ActivityIndicator
        style={{ marginTop: spacing.xl }}
        color={colors.textSecondary}
        accessibilityLabel={t('app.loading')}
      />
    );
  } else if (status === 'notSetUp') {
    body = paragraph(t('account.notSetUp'), true);
  } else if (status === 'signedIn') {
    body = (
      <>
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.caption }}>
          {t('account.signedInAs')}
        </Text>
        <Text
          style={{ color: colors.text, fontSize: fontSize.title, fontWeight: '600' }}
          testID="account-email"
        >
          {signedInEmail}
        </Text>
        {paragraph(t('account.signedInNote'), true)}
        {messages}
        <View style={{ marginTop: spacing.xl }}>
          <Button
            kind="secondary"
            label={t('account.signOut')}
            onPress={signOutHere}
            disabled={busy}
          />
        </View>
        <View style={{ marginTop: spacing.xxl }}>
          <Button
            kind="secondary"
            label={t('account.deleteRow')}
            onPress={() => {
              setProblem(null);
              setConfirmDelete(true);
            }}
            disabled={busy}
          />
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: fontSize.caption,
              marginTop: spacing.sm,
            }}
          >
            {t('account.deleteHint')}
          </Text>
        </View>
      </>
    );
  } else if (sentTo === null) {
    body = (
      <>
        {paragraph(t('account.intro'))}
        {paragraph(t('account.why'), true)}
        <TextField
          label={t('account.emailLabel')}
          value={emailText}
          onChangeText={(next) => {
            setEmailText(next);
            setProblem(null);
          }}
          onSubmitEditing={() => sendCode()}
          placeholder={t('account.emailPlaceholder')}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="send"
          maxLength={254}
        />
        {messages}
        <View style={{ marginTop: spacing.lg }}>
          <Button
            label={busy ? t('account.sending') : t('account.sendCode')}
            onPress={() => sendCode()}
            disabled={busy}
          />
        </View>
      </>
    );
  } else {
    body = (
      <>
        {paragraph(t('account.codeSent', { email: sentTo }))}
        <TextField
          label={t('account.codeLabel')}
          value={codeText}
          onChangeText={(next) => {
            setCodeText(next);
            setProblem(null);
          }}
          onSubmitEditing={checkCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="done"
          maxLength={CODE_MAX_DIGITS + 4}
          autoFocus
          large
        />
        {messages}
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Button
            label={busy ? t('account.checking') : t('account.signIn')}
            onPress={checkCode}
            disabled={busy}
          />
          <Button
            kind="text"
            label={t('account.newCode')}
            onPress={() => sendCode(true)}
            disabled={busy}
          />
          <Button kind="text" label={t('account.otherEmail')} onPress={startOver} disabled={busy} />
        </View>
      </>
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
        >
          {body}
          <View style={{ marginTop: spacing.xl }}>
            <Button
              kind="text"
              label={t('account.privacyLink')}
              onPress={() => router.push('/privacy')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {confirmDelete && (
        <BottomSheet
          title={t('account.deleteTitle')}
          onClose={() => !busy && setConfirmDelete(false)}
          footer={
            <View style={{ gap: spacing.sm }}>
              <Button
                testID="confirm-delete"
                label={busy ? t('account.deleting') : t('account.deleteConfirm')}
                onPress={deleteEverything}
                disabled={busy}
              />
              <Button
                kind="text"
                label={t('account.deleteKeep')}
                onPress={() => setConfirmDelete(false)}
                disabled={busy}
              />
            </View>
          }
        >
          <Text style={{ color: colors.text, fontSize: fontSize.body }}>
            {t('account.deleteBody')}
          </Text>
          {paragraph(t('account.deletePhone'), true)}
          {messages}
        </BottomSheet>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
