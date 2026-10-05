import { create } from 'zustand';

import { watchAccount } from '@/db/cloud/auth';
import { getSupabase } from '@/db/cloud/client';

// Who is signed in (Stage 11a). Supabase keeps the session itself (in secure storage); this store
// mirrors it so Profile and the Account screen can show it. An account is optional: nothing else
// in the app reads this.

export type AccountStatus =
  /** This copy of the app has no Supabase project (no .env): accounts are hidden. */
  | 'notSetUp'
  /** Reading the saved session. */
  | 'loading'
  | 'signedOut'
  | 'signedIn';

type AccountState = {
  status: AccountStatus;
  /** The signed-in email, or null. */
  email: string | null;
  /** Starts following sign-ins and sign-outs; returns a function that stops. */
  start: () => () => void;
};

export const useAccountStore = create<AccountState>()((set) => ({
  status: 'loading',
  email: null,

  start: () => {
    if (getSupabase() === null) {
      set({ status: 'notSetUp', email: null });
      return () => {};
    }
    return watchAccount((email) =>
      set(email === null ? { status: 'signedOut', email: null } : { status: 'signedIn', email }),
    );
  },
}));
