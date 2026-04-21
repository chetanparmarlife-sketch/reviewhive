// POST /functions/v1/verify-review-link
// Body: { url: string }
// Best-effort validation that the URL points to a supported marketplace
// review and is reachable. Returns { valid: boolean, reason?: string }.

import { handleOptions, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/supabase.ts";

// @ts-ignore Deno
declare const Deno: { serve: (h: (req: Request) => Response | Promise<Response>) => void };

const ALLOWED_HOSTS = [
  "amazon.in", "www.amazon.in",
  "flipkart.com", "www.flipkart.com",
  "meesho.com", "www.meesho.com",
];

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const user = await requireUser(req);
    if (!user) return jsonResponse({ error: "Not authenticated" }, { status: 401 });

    const { url } = await req.json();
    if (!url || typeof url !== "string")
      return jsonResponse({ valid: false, reason: "url required" }, { status: 400 });

    let parsed: URL;
    try { parsed = new URL(url); }
    catch { return jsonResponse({ valid: false, reason: "Not a valid URL" }); }

    if (!["https:", "http:"].includes(parsed.protocol))
      return jsonResponse({ valid: false, reason: "URL must use http(s)" });

    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
      return jsonResponse({
        valid: false,
        reason: "URL must be on amazon.in, flipkart.com, or meesho.com",
      });
    }

    // Best-effort reachability. Marketplaces aggressively block bots, so this
    // is ONLY informational — a failure here doesn't mean the link is bad.
    let reachable = false;
    try {
      const res = await fetch(parsed.toString(), {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": "ReviewHiveVerifier/1.0" },
        signal: AbortSignal.timeout(4000),
      });
      reachable = res.ok || res.status < 500;
    } catch {
      reachable = false;
    }

    return jsonResponse({ valid: true, reachable, host });
  } catch (e) {
    return jsonResponse({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
});
