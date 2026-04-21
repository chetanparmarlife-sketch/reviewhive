// Supabase client — single source of truth for backend access.
//
// IMPORTANT: the iframe preview sandbox blocks localStorage, sessionStorage,
// and indexedDB. We therefore supply an in-memory storage adapter
// unconditionally so the built bundle contains NO references to those APIs.
// Sessions will not persist across reloads in the preview; on real domains you
// can swap the adapter to a persistent one if needed.
//
// When env vars are missing or contain REPLACE_ME placeholders, we still
// export a client — but `isSupabaseConfigured()` returns false so the UI can
// show a setup banner instead of crashing at import time.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RAW_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const RAW_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function isPlaceholder(v: string | undefined): boolean {
  if (!v) return true;
  return /^REPLACE_ME/i.test(v) || v === "" || v === "undefined";
}

export const SUPABASE_URL = isPlaceholder(RAW_URL)
  ? "https://placeholder.supabase.co"
  : (RAW_URL as string);
export const SUPABASE_ANON_KEY = isPlaceholder(RAW_ANON)
  ? "placeholder-anon-key"
  : (RAW_ANON as string);

export function isSupabaseConfigured(): boolean {
  return !isPlaceholder(RAW_URL) && !isPlaceholder(RAW_ANON);
}

// --- In-memory storage adapter -------------------------------------------
// Matches the Web Storage interface Supabase expects. Because the adapter is
// injected explicitly, the Supabase client never touches window.localStorage
// and the bundle contains no forbidden-API references.
const memoryStorage = (() => {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
})();

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: memoryStorage as unknown as Storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
