// POST /functions/v1/approve-application
// Admin-only. Body: { application_id: string }.
// Updates status to 'approved'. The DB trigger handles slot increment +
// notification. This function also enqueues a transactional email.

import { serviceClient, requireAdmin } from "../_shared/supabase.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

// @ts-ignore Deno runtime
declare const Deno: { serve: (h: (req: Request) => Response | Promise<Response>) => void; env: { get(k: string): string | undefined } };

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const { user, isAdmin } = await requireAdmin(req);
    if (!user) return jsonResponse({ error: "Not authenticated" }, { status: 401 });
    if (!isAdmin) return jsonResponse({ error: "Admin only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const application_id: string | undefined = body.application_id;
    if (!application_id) return jsonResponse({ error: "application_id required" }, { status: 400 });

    const svc = serviceClient();

    // Fetch current app + campaign slot availability
    const { data: app, error: fErr } = await svc
      .from("applications")
      .select("id, status, user_id, campaign_id, campaigns(title, slots_filled, total_slots)")
      .eq("id", application_id)
      .single();
    if (fErr || !app) return jsonResponse({ error: "Not found" }, { status: 404 });

    const camp = (app as any).campaigns;
    if (camp && camp.slots_filled >= camp.total_slots && app.status !== "approved") {
      return jsonResponse({ error: "No slots available" }, { status: 400 });
    }

    const { data: updated, error: uErr } = await svc
      .from("applications")
      .update({ status: "approved" })
      .eq("id", application_id)
      .select()
      .single();
    if (uErr) return jsonResponse({ error: uErr.message }, { status: 400 });

    // Audit log
    await svc.from("audit_logs").insert({
      actor_id: user.id, action: "approve_application",
      entity_type: "application", entity_id: application_id,
      details: { campaign_id: app.campaign_id },
    });

    // Fire-and-forget email via send-email Edge Function
    const appUrl = Deno.env.get("APP_URL") ?? "";
    const { data: profile } = await svc
      .from("profiles").select("email, name").eq("id", app.user_id).single();
    if (profile?.email) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          template: "application-approved",
          to: profile.email,
          data: {
            name: profile.name ?? "there",
            campaign_title: camp?.title ?? "your campaign",
            app_url: appUrl,
          },
        }),
      }).catch(() => {});
    }

    return jsonResponse({ application: updated });
  } catch (e) {
    return jsonResponse({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
});
