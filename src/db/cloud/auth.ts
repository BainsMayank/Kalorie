import type { SupabaseClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus } from 'react-native';

import { accountProblem, type AccountProblem } from '@/lib/account';

import { getSupabase } from './client';

// Signing in with an emailed code, signing out, and deleting the account (Stage 11a).
// Each action answers { ok: true } or { ok: false, problem } — never throws — so a screen only
// has to pick the right line to show.

export type AccountResult = { ok: true } | { ok: false; problem: AccountProblem };

type Response = {
  error: { name?: string; code?: string; status?: number } | null;
  /** Database calls put the HTTP status here (0 = no answer) instead of on the error. */
  status?: number;
};

async function run(action: (supabase: SupabaseClient) => PromiseLike<Response>) {
  const supabase = getSupabase();
  if (supabase === null) return { ok: false, problem: 'other' } as const;
  try {
    const { error, status } = await action(supabase);
    if (error === null) return { ok: true } as const;
    return {
      ok: false,
      problem: accountProblem({
        name: error.name,
        code: error.code,
        status: error.status ?? status,
      }),
    } as const;
  } catch (error) {
    return { ok: false, problem: accountProblem(error) } as const;
  }
}

/**
 * Emails a sign-in code. Signing in and signing up are the same step: a new email gets an
 * account when its first code is typed in.
 */
export function sendSignInCode(email: string): Promise<AccountResult> {
  return run((supabase) =>
    supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } }),
  );
}

/** Checks the code from the email. On success the person is signed in on this phone. */
export function verifySignInCode(email: string, code: string): Promise<AccountResult> {
  return run((supabase) => supabase.auth.verifyOtp({ email, token: code, type: 'email' }));
}

/**
 * Signs out on this phone only (other phones stay signed in). Works offline too: the saved
 * session is removed even when the server can't be told.
 */
export function signOut(): Promise<AccountResult> {
  return run((supabase) => supabase.auth.signOut({ scope: 'local' }));
}

/**
 * "Delete my account and data": the database function delete_my_account()
 * (supabase/migrations/20260928100100_delete_account.sql) deletes the account and every row
 * saved online for it. Then this phone forgets the session. What is in user.db stays.
 */
export async function deleteAccount(): Promise<AccountResult> {
  const result = await run((supabase) => supabase.rpc('delete_my_account'));
  if (!result.ok) return result;
  await signOut();
  return result;
}

/**
 * Calls `onChange` with the signed-in email (or null) now and after every sign-in or sign-out,
 * and keeps the session fresh while the app is on screen (Supabase's advice for React Native:
 * no refreshing in the background). Returns a function that stops both.
 */
export function watchAccount(onChange: (email: string | null) => void): () => void {
  const supabase = getSupabase();
  if (supabase === null) return () => {};

  const { data } = supabase.auth.onAuthStateChange((_event, session) =>
    onChange(session ? (session.user.email ?? '') : null),
  );
  const refreshWhileActive = (state: AppStateStatus) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  };
  refreshWhileActive(AppState.currentState);
  const appState = AppState.addEventListener('change', refreshWhileActive);

  return () => {
    data.subscription.unsubscribe();
    appState.remove();
  };
}
