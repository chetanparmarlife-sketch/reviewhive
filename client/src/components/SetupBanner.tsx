// Persistent banner shown ONLY when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// are missing or contain REPLACE_ME placeholders. Helps the developer realise
// why nothing is loading, without crashing the app.

import { AlertTriangle } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";

export function SetupBanner() {
  if (isSupabaseConfigured()) return null;
  return (
    <div
      data-testid="banner-supabase-setup"
      className="sticky top-0 z-[100] w-full border-b border-amber-300 bg-amber-50 px-4 py-2 text-[13px] text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-screen-2xl items-center gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span>
          <strong>Supabase not configured.</strong>{" "}
          Set <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900">VITE_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900">VITE_SUPABASE_ANON_KEY</code>{" "}
          in <code>.env</code> or <code>.env.local</code>, then restart. See{" "}
          <strong>SETUP.md</strong> for the full guide.
        </span>
      </div>
    </div>
  );
}
