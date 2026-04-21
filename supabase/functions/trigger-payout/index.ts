// POST /functions/v1/trigger-payout
// Admin-only. Body: { application_id: string }
//
// Stubbed for day 1: if Razorpay env is missing, marks the payout as 'paid'
// with a mock UTR so the UI flow can be demoed end-to-end. Uncomment the real
// Razorpay payout block once RAZORPAY_* keys are live.
//
// TDS (1% by default) is deducted from the reward before payout and stored in
// payouts.tds_amount. Override via env var TDS_PERCENT.

import { serviceClient, requireAdmin } from "../_shared/supabase.ts";
import { handleOptions, jsonResponse } from "../_shared/cors.ts";

// @ts-ignore Deno
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

    // Fetch application + campaign reward + reviewer UPI
    const { data: app, error } = await svc
      .from("applications")
      .select("id, status, user_id, campaign_id, campaigns(title, reward_amount), profiles!applications_user_id_fkey(upi_id, email, name)")
      .eq("id", application_id)
      .single();
    if (error || !app) return jsonResponse({ error: "Application not found" }, { status: 404 });
    if (app.status !== "verified") return jsonResponse({ error: "Application must be in 'verified' to pay" }, { status: 400 });

    const camp = (app as any).campaigns;
    const reviewer = (app as any).profiles;
    const reward: number = camp?.reward_amount ?? 0;
    if (!reviewer?.upi_id) return jsonResponse({ error: "Reviewer has no UPI on file" }, { status: 400 });

    const tdsPercent = Number(Deno.env.get("TDS_PERCENT") ?? "1");
    const tdsAmount = Math.round((reward * tdsPercent) / 100);
    const netAmount = reward - tdsAmount;

    // ---- Razorpay (PRODUCTION) — uncomment when keys are live ----
    // const rzpKey = Deno.env.get("RAZORPAY_KEY_ID");
    // const rzpSecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    // const rzpAccount = Deno.env.get("RAZORPAY_ACCOUNT_NUMBER");
    // if (rzpKey && rzpSecret && rzpAccount) {
    //   const basic = btoa(`${rzpKey}:${rzpSecret}`);
    //   const rzpRes = await fetch("https://api.razorpay.com/v1/payouts", {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       Authorization: `Basic ${basic}`,
    //       "X-Payout-Idempotency": `payout-${application_id}`,
    //     },
    //     body: JSON.stringify({
    //       account_number: rzpAccount,
    //       amount: netAmount * 100, // paise
    //       currency: "INR",
    //       mode: "UPI",
    //       purpose: "payout",
    //       fund_account: {
    //         account_type: "vpa",
    //         vpa: { address: reviewer.upi_id },
    //         contact: {
    //           name: reviewer.name ?? "Reviewer",
    //           email: reviewer.email,
    //           type: "vendor",
    //         },
    //       },
    //       queue_if_low_balance: true,
    //       reference_id: application_id,
    //       narration: `ReviewHive ${camp?.title ?? ""}`.slice(0, 30),
    //     }),
    //   });
    //   const rzpBody = await rzpRes.json();
    //   if (!rzpRes.ok) return jsonResponse({ error: `Razorpay: ${rzpBody.error?.description ?? rzpRes.statusText}` }, { status: 502 });
    //   const utr = rzpBody.utr ?? rzpBody.id;
    //   // Insert payouts row + mark paid
    //   ...
    // }

    // ---- STUB PATH (dev / no Razorpay) ----
    const mockUtr = "MOCK" + Math.floor(100000 + Math.random() * 900000);

    const { data: payout, error: pErr } = await svc.from("payouts").insert({
      application_id,
      user_id: app.user_id,
      amount: netAmount,
      tds_amount: tdsAmount,
      status: "paid",
      utr: mockUtr,
      paid_at: new Date().toISOString(),
    }).select().single();
    if (pErr) return jsonResponse({ error: pErr.message }, { status: 400 });

    const { error: uErr } = await svc.from("applications")
      .update({ status: "paid", payout_utr: mockUtr })
      .eq("id", application_id);
    if (uErr) return jsonResponse({ error: uErr.message }, { status: 400 });

    await svc.from("audit_logs").insert({
      actor_id: user.id, action: "trigger_payout",
      entity_type: "application", entity_id: application_id,
      details: { amount: netAmount, tds: tdsAmount, utr: mockUtr, mocked: true },
    });

    // Email
    if (reviewer.email) {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          template: "payout-sent",
          to: reviewer.email,
          data: {
            name: reviewer.name ?? "there",
            campaign_title: camp?.title ?? "",
            amount: netAmount,
            utr: mockUtr,
          },
        }),
      }).catch(() => {});
    }

    return jsonResponse({ payout, utr: mockUtr, mocked: true });
  } catch (e) {
    return jsonResponse({ error: String((e as Error).message ?? e) }, { status: 500 });
  }
});
