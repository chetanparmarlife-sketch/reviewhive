// POST /functions/v1/send-email
// Body: { template: string, to: string, data?: Record<string, any> }
// Sends transactional email via Resend (https://resend.com).
//
// Must be called with the service role key (server-to-server) OR by an
// authenticated admin. Anonymous callers are rejected.

import { requireAdmin } from "../_shared/supabase.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

// @ts-ignore Deno
declare const Deno: { serve: (h: (req: Request) => Response | Promise<Response>) => void; env: { get(k: string): string | undefined } };

type TemplateId =
  | "welcome"
  | "application-approved"
  | "application-rejected"
  | "payout-sent"
  | "campaign-reminder";

function wrap(inner: string, preheader = "") {
  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#fef7ed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1410;">
    <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef7ed;padding:32px 16px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          <tr><td style="padding:28px 32px 0 32px;">
            <div style="font-size:20px;font-weight:700;color:#b45309;letter-spacing:-0.01em;">
              ReviewHive
            </div>
          </td></tr>
          <tr><td style="padding:16px 32px 32px 32px;font-size:15px;line-height:1.55;">${inner}</td></tr>
          <tr><td style="padding:16px 32px 32px 32px;font-size:12px;color:#78716c;border-top:1px solid #f5e6d3;">
            You're receiving this because you have an account on ReviewHive.<br>
            Questions? Reply to this email.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function render(template: TemplateId, data: Record<string, any>): { subject: string; html: string } {
  const name = data.name ?? "there";
  const campaign = data.campaign_title ?? "your campaign";
  const appUrl = data.app_url ?? "";
  switch (template) {
    case "welcome":
      return {
        subject: "Welcome to ReviewHive!",
        html: wrap(`
          <h2 style="margin:0 0 12px 0;font-size:22px;">Welcome, ${name}!</h2>
          <p>You're all set. Browse live campaigns, apply in a tap, and earn honest review payouts directly to UPI.</p>
          <p><a href="${appUrl}/#/campaigns" style="display:inline-block;background:#b45309;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Browse campaigns</a></p>
        `, "Welcome to ReviewHive"),
      };
    case "application-approved":
      return {
        subject: `You're approved for "${campaign}"`,
        html: wrap(`
          <h2 style="margin:0 0 12px 0;font-size:22px;">Great news, ${name}!</h2>
          <p>Your application for <strong>${campaign}</strong> has been approved.</p>
          <p>Pick a product and place your order to reserve your slot.</p>
          <p><a href="${appUrl}/#/applications" style="display:inline-block;background:#b45309;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Open my applications</a></p>
        `, "Your application was approved"),
      };
    case "application-rejected":
      return {
        subject: `Update on "${campaign}"`,
        html: wrap(`
          <h2 style="margin:0 0 12px 0;font-size:22px;">Hi ${name},</h2>
          <p>Your submission for <strong>${campaign}</strong> wasn't accepted this time.</p>
          ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ""}
          <p>Plenty of other live campaigns are waiting.</p>
        `, "Application update"),
      };
    case "payout-sent": {
      const amount = data.amount ?? 0;
      const utr = data.utr ?? "—";
      return {
        subject: "🎉 Payout credited",
        html: wrap(`
          <h2 style="margin:0 0 12px 0;font-size:22px;">Payment on the way, ${name}!</h2>
          <p>₹${amount} for <strong>${campaign}</strong> has been released to your UPI.</p>
          <p>UTR reference: <code>${utr}</code></p>
        `, "Payout credited"),
      };
    }
    case "campaign-reminder":
      return {
        subject: "Don't forget to submit your review",
        html: wrap(`
          <h2 style="margin:0 0 12px 0;font-size:22px;">Hi ${name},</h2>
          <p>Your order for <strong>${campaign}</strong> is logged. Submit your review to release the payout.</p>
          <p><a href="${appUrl}/#/applications" style="display:inline-block;background:#b45309;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Submit review</a></p>
        `, "Reminder: submit your review"),
      };
  }
}

Deno.serve(async (req: Request) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    // Authorization: allow either service-role-key bearer token OR authenticated admin
    const auth = req.headers.get("Authorization") ?? "";
    const bearer = auth.replace(/^Bearer\s+/i, "");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let authorized = !!(service && bearer === service);
    if (!authorized) {
      const { isAdmin } = await requireAdmin(req);
      authorized = isAdmin;
    }
    if (!authorized) return jsonResponse({ error: "Forbidden" }, { status: 403 });

    const { template, to, data } = await req.json();
    if (!template || !to) return jsonResponse({ error: "template and to required" }, { status: 400 });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      // Still return success so calling functions don't cascade-fail during setup
      console.warn("RESEND_API_KEY missing — email skipped");
      return jsonResponse({ ok: true, skipped: true, reason: "no RESEND_API_KEY" });
    }

    const { subject, html } = render(template, data ?? {});
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("EMAIL_FROM") ?? "ReviewHive <no-reply@reviewhive.in>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return jsonResponse({ error: `Resend: ${res.status} ${text}` }, { status: 502 });
    }
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
});
