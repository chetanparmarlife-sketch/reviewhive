# ReviewHive — Setup Guide

End-to-end instructions for spinning up a new ReviewHive environment on Supabase.

---

## 1. Prerequisites

- Node.js 20+
- `supabase` CLI (`npm i -g supabase` or `brew install supabase/tap/supabase`)
- A Supabase project (free tier works for staging — `supabase.com/dashboard`)
- A Resend account for transactional email (optional for dev)
- An MSG91 account for WhatsApp OTP (optional — email auth works without it)
- A Razorpay account for payouts (optional — trigger-payout is stubbed by default)

---

## 2. Clone & Install

```bash
git clone <your repo>
cd reviewhive-production
npm install
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` now — the frontend won't start without them (it will show a setup banner instead of crashing).

---

## 3. Supabase Database Setup

### 3a. Link the CLI to your project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### 3b. Apply migrations

```bash
supabase db push
```

This runs both migration files in order:

1. `supabase/migrations/0001_initial.sql` — schema, RLS policies, storage buckets, triggers
2. `supabase/migrations/0002_seed.sql` — sample brands, campaigns, products

**What gets created:**

- Tables: `profiles`, `brands`, `campaigns`, `products`, `applications`, `notifications`
- Storage buckets: `order-proofs` (private), `review-proofs` (private), `brand-logos`, `campaign-covers`, `avatars` (public)
- RLS policies enforcing reviewer vs. admin access
- `handle_new_user()` trigger that auto-creates a `profiles` row on auth signup

### 3c. Create the first admin user

Seed SQL cannot create `auth.users` entries, so admins must be bootstrapped manually:

1. Supabase Dashboard → Authentication → Users → **Add user**
2. Email: `admin@reviewhive.in`, set password
3. Confirm the user (check "Auto Confirm User")
4. SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'admin@reviewhive.in';
```

The user can now sign in via `/#/admin/login`.

---

## 4. Deploy Edge Functions

```bash
supabase functions deploy apply-to-campaign
supabase functions deploy approve-application
supabase functions deploy reject-application
supabase functions deploy send-email
supabase functions deploy trigger-payout
supabase functions deploy verify-review-link
```

### 4a. Set function secrets

```bash
supabase secrets set \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  RESEND_API_KEY="..." \
  RAZORPAY_KEY_ID="..." \
  RAZORPAY_KEY_SECRET="..." \
  RAZORPAY_ACCOUNT_NUMBER="..." \
  APP_URL="https://reviewhive.in" \
  TDS_PERCENT="10"
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by Supabase — no need to set them.

---

## 5. Phone/WhatsApp Auth via MSG91 (optional)

Supabase Dashboard → Authentication → Providers → **Phone** → enable.

Then: **Phone Auth → SMS provider → Custom** and paste the MSG91 webhook URL. Follow MSG91's Supabase integration guide — you'll need `MSG91_AUTH_KEY` and your WhatsApp template ID. Until this is configured, phone-based signin flows will fail, but email signin continues to work.

---

## 6. Frontend Dev

```bash
npm run dev
```

Open <http://localhost:5173>. The app uses hash routing (`/#/campaigns`, `/#/admin/login`, etc.).

## 7. Build & Deploy Frontend

```bash
npm run build
```

Static output lives in `dist/public`. Ship it anywhere:

- **Vercel**: `vercel.json` already sets `outputDirectory` to `dist/public`
- **Netlify**: point to `dist/public` as the publish directory
- **S3 + CloudFront**: sync `dist/public/*` to your bucket
- **Cloudflare Pages**: upload `dist/public`

Make sure your host injects `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` at build time.

---

## 8. Smoke Test

1. Visit the deployed URL → Landing page shows sample campaigns
2. Sign up as a reviewer → profile auto-created
3. Apply to a campaign → row in `applications` table
4. Sign in as admin at `/#/admin/login` → see dashboard stats
5. Approve/reject the test application → status changes, notification fires

---

## Troubleshooting

- **"Supabase env vars missing" banner on load** → `.env` not loaded by Vite. Restart `npm run dev` after editing `.env`.
- **Edge function returns 401** → missing `SUPABASE_SERVICE_ROLE_KEY` secret. Re-run `supabase secrets list`.
- **RLS policy error on signup** → check that `handle_new_user()` trigger is installed (`select tgname from pg_trigger where tgname = 'on_auth_user_created'`).
- **Storage upload fails** → bucket doesn't exist or user isn't authenticated. Verify buckets in Dashboard → Storage.

For ops runbooks (refunds, unblocking users, resetting slots) see `RUNBOOK.md`.
