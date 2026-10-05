import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { isPublicKey } from '@/lib/account';

import { secureSessionStorage } from './sessionStorage';

// The project URL and publishable (anon) key come from .env (see .env.example). Expo copies
// EXPO_PUBLIC_ variables into the app when it is built, so they must be read exactly like this —
// `process.env.EXPO_PUBLIC_…` spelled out — or Expo can't find them.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

let client: SupabaseClient | null | undefined;

/**
 * The connection to Kalorie's Supabase project, made the first time it is needed. `null` when
 * this copy of the app has no project set up (no .env), or when the key in .env is a secret key —
 * the app then works exactly as before, just without accounts.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  if (url === '' || key === '') {
    client = null;
  } else if (!isPublicKey(key)) {
    // Never ship a key that skips Row Level Security. Say so loudly while developing.
    console.error(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY is a secret (service_role) key. Use the publishable key.',
    );
    client = null;
  } else {
    client = createClient(url, key, {
      auth: {
        storage: secureSessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Only for web sign-in links; the app signs in with a code instead.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
