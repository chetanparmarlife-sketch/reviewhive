// POST /functions/v1/reject-application
// Admin-only. Body: { application_id: string, reason?: string, stage?: "application"|"submission" }
//
// - stage "application" → sets status 'rejected'
// - stage "submission"  → sets status 'rejected_submission'
// Slot decrement is handled by the DB trigger.

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
    const reason: string = body.reason ?? "";
    const stage: string = body.stage === "submission" ? "submission" : "application";
    if (!application_id) return jsonResponse({ error: "application_id required" }, { status: 400 });

    const svc = serviceClient();
    const status = stage === "submission" ? "rejected_submission" : "rejected";

    const { data: app, error } = await svc
      .from("applications")
      .update({ status, rejection_reason: reason, admin_notes: reason })
      .eq("id", application_id)
      .select("id, user_id, campaign_id, campaigns(title)")
      .single();
    if (error) return jsonResponse({ error: error.message }, { status: 400 });

    await svc.from("audit_logs").insert({
      actor_id: user.id, action: stage === "submission" ? "reject_submission" : "reject_application",
      entity_type: "application", entity_id: application_id, details: { reason },
    });

    // Email
    const { data: profile } = await svc.from("profiles").select("email, name").eq("id", app.user_id).single();
    if (profile?.email) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          template: "application-rejected",
          to: profile.email,
          data: {
            name: profile.name ?? "there",
            campaign_title: (app as any).campaigns?.title ?? "your campaign",
            reason,
          },
        }),
      }).catch(() => {});
    }

    return jsonResponse({ application: app });
  } catch (e) {
    return jsonResponse({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
});
