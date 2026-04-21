// Session store backed by Supabase auth.
//
// `session.ts` exposes the same `useSession` / `setSessionUser` API the
// prototype used, plus initialization helpers. All session state is derived
// from `supabase.auth.getSession()`; the external hook is only used to
// broadcast changes for useSyncExternalStore.

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import type { Profile } from "@shared/schema";

export type SessionUser = Profile;

// --------- internal store ---------
let currentUser: SessionUser | null = null;
let currentSessionId: string | null = null; // auth.users.id
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function setSessionUser(user: SessionUser | null) {
  currentUser = user;
  currentSessionId = user?.id ?? null;
  emit();
}
export function getSessionUser(): SessionUser | null {
  return currentUser;
}

export function useSession() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentUser,
    () => currentUser,
  );
}

// --------- supabase → session bridge ---------

async function loadProfile(userId: string): Promise<SessionUser | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as SessionUser;
}

/** Hydrate the session from the Supabase auth state. Call once at app boot. */
export async function initSession(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (uid) {
      const profile = await loadProfile(uid);
      setSessionUser(profile);
    }
  } catch {
    // no-op — unconfigured supabase will throw; leave session null
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const uid = session?.user?.id ?? null;
    if (!uid) {
      setSessionUser(null);
      return;
    }
    if (uid === currentSessionId && currentUser) return; // no change
    const profile = await loadProfile(uid);
    setSessionUser(profile);
  });
}

/** Re-fetch the profile for the currently signed-in user. */
export async function refreshSessionProfile(): Promise<SessionUser | null> {
  if (!currentSessionId) return null;
  const profile = await loadProfile(currentSessionId);
  setSessionUser(profile);
  return profile;
}

// --------- theme toggle (in-memory only — iframe-safe) ---------
let isDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
const themeListeners = new Set<() => void>();

export function applyTheme() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isDark);
}
applyTheme();

export function toggleTheme() {
  isDark = !isDark;
  applyTheme();
  themeListeners.forEach((l) => l());
}
export function useTheme() {
  return useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb);
      return () => themeListeners.delete(cb);
    },
    () => isDark,
    () => isDark,
  );
}

// --------- formatters / metadata (unchanged from prototype) ---------
export function formatRupees(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}

export function marketplaceMeta(m: string) {
  switch (m) {
    case "amazon_in":
      return { label: "Amazon", color: "bg-[#ff9900] text-[#131a22] border-[#e08600]", short: "AMZ" };
    case "flipkart":
      return { label: "Flipkart", color: "bg-[#2874f0] text-white border-[#1c5bc4]", short: "FK" };
    case "meesho":
      return { label: "Meesho", color: "bg-[#e91e63] text-white border-[#c2185b]", short: "MSH" };
    default:
      return { label: m, color: "bg-muted text-foreground border-border", short: m };
  }
}

export function statusMeta(status: string): { label: string; color: string } {
  switch (status) {
    case "applied": return { label: "Applied", color: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-800" };
    case "approved": return { label: "Approved", color: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800" };
    case "reserved": return { label: "Reserved", color: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200 border-violet-300 dark:border-violet-800" };
    case "purchased": return { label: "Purchased", color: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200 border-cyan-300 dark:border-cyan-800" };
    case "submitted": return { label: "Submitted", color: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800" };
    case "verified": return { label: "Verified", color: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800" };
    case "paid": return { label: "Paid", color: "bg-green-600 text-white border-green-700" };
    case "rejected": return { label: "Rejected", color: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200 border-red-300 dark:border-red-800" };
    case "rejected_submission": return { label: "Needs changes", color: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200 border-orange-300 dark:border-orange-800" };
    case "live": return { label: "Live", color: "bg-green-600 text-white border-green-700" };
    case "draft": return { label: "Draft", color: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700" };
    case "paused": return { label: "Paused", color: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200 border-yellow-300 dark:border-yellow-800" };
    case "completed": return { label: "Completed", color: "bg-muted text-foreground border-border" };
    default: return { label: status, color: "bg-muted text-foreground border-border" };
  }
}

export const LIFECYCLE: string[] = ["applied", "approved", "reserved", "purchased", "submitted", "verified", "paid"];
