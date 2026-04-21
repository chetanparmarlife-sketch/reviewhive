// Build a Supabase client inside Edge Functions.
// Two flavours:
//   - `serviceClient()` bypasses RLS (use only for server-trusted operations)
//   - `authedClient(req)` forwards the caller's JWT so RLS applies
//
// deno-lint-ignore-file no-explicit-any

// @ts-ignore — deno-specific import
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// @ts-ignore Deno is present at runtime
declare const Deno: { env: { get(k: string): string | undefined } };

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function authedClient(req: Request): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anonKey, {
    global: {
      headers: { Authorization: req.headers.get("Authorization") ?? "" },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function requireAdmin(req: Request) {
  const client = authedClient(req);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { user: null, isAdmin: false } as const;
  const svc = serviceClient();
  const { data } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  return { user, isAdmin: data?.role === "admin" } as const;
}

export async function requireUser(req: Request) {
  const client = authedClient(req);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}
