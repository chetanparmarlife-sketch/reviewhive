# ReviewHive — Ops Runbook

Everyday operational playbooks. All SQL assumes you're in Supabase SQL editor with service-role access.

---

## Incident: Campaign slots_filled is wrong

If a campaign shows more slots filled than real applications:

```sql
update public.campaigns c
set slots_filled = (
  select count(*) from public.applications a
  where a.campaign_id = c.id
    and a.status in ('applied','approved','reserved','purchased','submitted','verified','paid')
)
where c.id = 'CAMPAIGN_UUID';
```

The `apply-to-campaign` edge function is the only writer of `slots_filled` during normal operation; this recalculation should only be needed after a manual DB edit.

---

## Unblock a reviewer

```sql
update public.profiles set is_blocked = false where email = 'user@example.com';
```

Or via the admin UI: **Reviewers → click user → Unblock**.

---

## Refund / reverse a payout

Razorpay Payouts cannot be reversed programmatically. Steps:

1. Issue a payout of the same amount back to ReviewHive's account from the reviewer's UPI (out-of-band).
2. Reset the application:
   ```sql
   update public.applications
   set status = 'verified', paid_at = null, payout_utr = null
   where id = 'APPLICATION_UUID';
   ```
3. Decrement the reviewer's earnings:
   ```sql
   update public.profiles p
   set total_earnings = total_earnings - (select reward_amount from public.campaigns where id = 'CAMPAIGN_UUID')
   where p.id = 'USER_UUID';
   ```

---

## Retrigger a stuck payout

If a `trigger-payout` call 500'd and the app is in `verified`, just click **Mark paid** again in the admin UI. The edge function is idempotent against already-paid applications (it returns early if `paid_at` is set).

To force a retry on a paid-but-missing-UTR row:

```sql
update public.applications
set status = 'verified', paid_at = null
where id = 'APPLICATION_UUID';
```

Then click **Mark paid** in the UI.

---

## Razorpay is STUBBED — how to go live

`supabase/functions/trigger-payout/index.ts` contains a block labeled `// TODO: live Razorpay call`. Currently it generates a fake UTR (`RZPSTUB...`) and returns `{ mocked: true }`.

To enable real payouts:

1. Get Razorpay X account + API keys with Payouts permission.
2. Set secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_ACCOUNT_NUMBER`.
3. Uncomment the live `fetch` block in `trigger-payout/index.ts`, delete the stub return.
4. Redeploy: `supabase functions deploy trigger-payout`.
5. Test with a ₹1 payout to a test UPI first.

---

## Reset the sandbox / demo environment

To wipe all application + notification data without touching brands/campaigns:

```sql
truncate public.notifications, public.applications restart identity cascade;
update public.campaigns set slots_filled = 0;
update public.profiles set total_earnings = 0, completed_campaigns = 0 where role = 'reviewer';
```

---

## Back-up / export

Supabase automatically runs daily PITR backups on paid plans. For ad-hoc exports:

```bash
supabase db dump -f backup_$(date +%F).sql --data-only
```

---

## Key metrics

- `select count(*) from public.applications group by status` — funnel
- `select date_trunc('day', applied_at) d, count(*) from public.applications group by 1 order by 1 desc limit 30` — daily volume
- `select sum(c.reward_amount) from public.applications a join public.campaigns c on c.id = a.campaign_id where a.status = 'paid' and a.paid_at > date_trunc('month', now())` — payouts this month

---

## Common support requests

| Issue                                      | Fix                                                                                                                           |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Reviewer can't sign in                     | Check `is_blocked`; reset password via Supabase Auth dashboard                                                                |
| Reviewer can't upload order proof          | Check storage bucket `order-proofs` RLS policy still exists; verify file < 5 MB                                               |
| Admin clicks "Mark paid" but nothing paid  | Check Edge Function logs in Dashboard → Functions → trigger-payout; likely missing Razorpay secrets (see STUBBED note above)  |
| "Email not sent" after approval            | Check Resend dashboard for bounce; verify `RESEND_API_KEY` is set in Edge Function secrets                                    |
| Reviewer sees "Setup required" banner      | The deployed build is missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — re-deploy with env vars set at build time      |

---

## Escalation

- Database issues → Supabase support (Dashboard → Support)
- Payout issues → Razorpay support (dashboard.razorpay.com)
- Email deliverability → Resend support
