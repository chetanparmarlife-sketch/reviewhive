# trigger-payout

Admin-only. Moves a `verified` application to `paid`, inserting a `payouts`
row with TDS calculation.

**Current behaviour is STUBBED** — the mock UTR starts with `MOCK…`. Real
Razorpay code is ready in `index.ts` but commented out. To go live:

1. Create a Razorpay account, enable Route/Payouts, verify business KYC.
2. Set secrets:
   ```bash
   supabase secrets set \
     RAZORPAY_KEY_ID=rzp_live_xxx \
     RAZORPAY_KEY_SECRET=xxx \
     RAZORPAY_ACCOUNT_NUMBER=xxxxxxxxxxxxxxxx \
     TDS_PERCENT=1
   ```
3. Uncomment the Razorpay block in `index.ts` and redeploy.

Deploy: `supabase functions deploy trigger-payout`
