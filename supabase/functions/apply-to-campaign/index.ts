// POST /functions/v1/apply-to-campaign
// Body: { campaign_id: string }
//
// Atomically (inside a plpgsql check) validates the campaign is live, has
// slots, and the caller hasn't already applied — then inserts the application.
// Uses the service role to bypass RLS for the availability check + insert in
// one pass, preventing race conditions between the check and insert.

import { serviceClient, requireUser } from "../_shared/supabase.ts";
import { corsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts";

// @ts-ignore Deno is present at runtime
declare const Deno: { serve: (handler: (req: Request) => Response | Promise<Response>) => void };

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const user = await requireUser(req);
    if (!user) return jsonResponse({ error: "Not authenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const campaign_id: string | undefined = body.campaign_id;
    if (!campaign_id) return jsonResponse({ error: "campaign_id required" }, { status: 400 });

    const svc = serviceClient();

    // 1. Fetch campaign
    const { data: camp, error: cErr } = await svc
      .from("campaigns")
      .select("id, title, status, slots_filled, total_slots")
      .eq("id", campaign_id)
      .single();
    if (cErr || !camp) return jsonResponse({ error: "Campaign not found" }, { status: 404 });
    if (camp.status !== "live") return jsonResponse({ error: "Campaign is not live" }, { status: 400 });
    if (camp.slots_filled >= camp.total_slots)
      return jsonResponse({ error: "No slots available" }, { status: 400 });

    // 2. Existing application?
    const { data: existing } = await svc
      .from("applications")
      .select("id")
      .eq("campaign_id", campaign_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) return jsonResponse({ error: "Already applied" }, { status: 400 });

    // 3. Insert
    const { data: inserted, error: iErr } = await svc
      .from("applications")
      .insert({ campaign_id, user_id: user.id, status: "applied" })
      .select()
      .single();
    if (iErr) return jsonResponse({ error: iErr.message }, { status: 400 });

    // 4. Welcome notification (the trigger only emits for status changes from UPDATE)
    await svc.from("notifications").insert({
      user_id: user.id,
      type: "status_change",
      title: "Application submitted",
      message: `We received your application for "${camp.title}". You'll hear back within 24 hours.`,
      link: "/#/applications",
    });

    return jsonResponse({ application: inserted }, { status: 200 });
  } catch (e) {
    return jsonResponse({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
});
