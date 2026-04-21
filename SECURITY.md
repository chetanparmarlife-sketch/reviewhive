# ReviewHive — Security Model

This document describes how auth, authorization, and data isolation work in ReviewHive.

---

## Identity & Sessions

- **Auth provider:** Supabase Auth (PostgreSQL-backed).
- **Supported factors:** email + password (primary), WhatsApp OTP via MSG91 (optional).
- **Session storage:** Supabase JS client keeps the JWT in memory + an in-memory refresh token. The iframe-preview sandbox in development blocks `localStorage`, so sessions do not persist across tabs there; in production (standalone domain), Supabase falls back to `localStorage` automatically.
- **Session refresh:** handled automatically by the Supabase client; refresh tokens rotate.

---

## Role Model

Every user has exactly one `role` on their `public.profiles` row:

| Role       | Capabilities                                                            |
| ---------- | ----------------------------------------------------------------------- |
| `reviewer` | Browse live campaigns, apply, submit proofs, view own data              |
| `admin`    | All of the above + manage brands, campaigns, applications, payouts, users |

A helper SQL function `public.is_admin()` reads the current JWT's `sub` claim and checks whether that user's `role = 'admin'`. It is used inside RLS policies.

```sql
create or replace function public.is_admin() returns boolean
  language sql stable security definer
  as $$ select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') $$;
```

---

## Row-Level Security (RLS)

RLS is **ON** on every public table. Policies live in `supabase/migrations/0001_initial.sql`. Summary:

### `profiles`

- `select`: a user can read their own profile; admins can read all.
- `update`: a user can update their own non-sensitive fields (`name`, `phone`, `upi_id`, `pan_number`, `avatar_url`). Admins can update any field including `role` and `is_blocked`.
- `insert`: blocked from clients — only the `handle_new_user()` trigger inserts.

### `brands`

- `select`: anyone (brands are public).
- `insert` / `update` / `delete`: admin only.

### `campaigns`

- `select`: anyone can read `status = 'live'`; admins can read all.
- `insert` / `update` / `delete`: admin only.

### `products`

- `select`: anyone whose linked campaign is visible.
- `insert` / `update` / `delete`: admin only.

### `applications`

- `select`: a user reads rows where `user_id = auth.uid()`; admins read all.
- `insert`: blocked from clients — always goes through `apply-to-campaign` edge function (which uses service role and enforces the slot check atomically).
- `update`: a user can update fields required to progress their own application (`order_id`, `order_proof_url`, `review_link`, `review_proof_url`, `review_text`, and `status` transitions `approved → reserved`, `reserved → purchased`, `purchased → submitted`). Admins can update any field.

### `notifications`

- `select`: a user reads rows where `user_id = auth.uid()`.
- `update`: a user can toggle `read` on their own notifications.
- `insert` / `delete`: service role only (via edge functions).

---

## Storage Buckets

| Bucket            | Visibility | Who writes                                       | Who reads                                                          |
| ----------------- | ---------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| `order-proofs`    | **Private**  | Authenticated users into `{auth.uid()}/…`          | Owner + admin (via short-lived signed URLs, TTL = 3600s)             |
| `review-proofs`   | **Private**  | Authenticated users into `{auth.uid()}/…`          | Owner + admin (via short-lived signed URLs, TTL = 3600s)             |
| `brand-logos`     | Public     | Admin only                                       | Anyone                                                             |
| `campaign-covers` | Public     | Admin only                                       | Anyone                                                             |
| `avatars`         | Public     | Authenticated users into `{auth.uid()}/…`          | Anyone                                                             |

Private buckets are accessed by admins via `createSignedUrl(bucket, path, 3600)` in `client/src/lib/db.ts` — the UI never exposes a public URL for order/review proofs.

### Path convention

All user-uploaded files live under a path prefix equal to the user's UUID:

```
order-proofs/<user_uuid>/<timestamp>-<filename>.jpg
review-proofs/<user_uuid>/<timestamp>-<filename>.jpg
avatars/<user_uuid>/<filename>.jpg
```

This makes RLS policies trivial to express (`bucket_id = 'order-proofs' and (storage.foldername(name))[1] = auth.uid()::text`).

---

## Edge Functions

All privileged operations go through edge functions. Each function:

1. Reads the caller's JWT from the `Authorization: Bearer` header.
2. Uses `supabase.auth.getUser(jwt)` to identify the caller.
3. Performs its own authorization check (e.g. admin-only, or "caller owns this application").
4. Uses the **service role** client to mutate data atomically (bypasses RLS for the specific operation).

| Function               | Caller             | What it does                                                                 |
| ---------------------- | ------------------ | ---------------------------------------------------------------------------- |
| `apply-to-campaign`    | Authenticated user | Atomic slot check + `applications` insert + `slots_filled` increment          |
| `approve-application`  | Admin              | Transition `applied → approved`, send email notification                     |
| `reject-application`   | Admin              | Transition to `rejected` or `rejected_submission`, include reason            |
| `send-email`           | Service internal   | Sends a transactional email via Resend                                       |
| `trigger-payout`       | Admin              | Calls Razorpay Payouts, updates `status = 'paid'`, sets `payout_utr`, `paid_at` |
| `verify-review-link`   | Admin              | Fetches the review URL server-side to verify it exists & contains keywords   |

Service role key is only set inside edge function secrets — **never** in the frontend build.

---

## Secrets & Credentials

| Secret                       | Where it lives               | Rotation cadence |
| ---------------------------- | ---------------------------- | ---------------- |
| `SUPABASE_SERVICE_ROLE_KEY`  | Edge function secrets only   | Annual           |
| `RESEND_API_KEY`             | Edge function secrets only   | Quarterly        |
| `RAZORPAY_KEY_SECRET`        | Edge function secrets only   | Quarterly        |
| `MSG91_AUTH_KEY`             | Supabase Auth custom provider | Quarterly        |
| `VITE_SUPABASE_ANON_KEY`     | Frontend build (public)      | Never (public)   |

**Anon key is public** — it is restricted by RLS, not secrecy. If exposed, no rotation required.

---

## Data Deletion (GDPR / DPDP Act)

Reviewer requests deletion:

```sql
-- Replace all PII on the profile (keeps FK integrity)
update public.profiles
set name = 'Deleted User', phone = null, upi_id = null, pan_number = null, email = 'deleted+' || id || '@reviewhive.in'
where id = 'USER_UUID';

-- Optionally delete auth.users row (cascades to profiles via trigger)
-- select auth.admin_delete_user('USER_UUID');  -- via service role
```

Proof images in `order-proofs/<uuid>/…` should be purged using `supabase storage rm` with the user's prefix.

---

## Monitoring

- **Auth events**: Supabase Dashboard → Auth → Logs
- **Edge function logs**: Dashboard → Functions → (function) → Logs
- **Database slow queries**: Dashboard → Database → Query Performance

No PII should appear in logs beyond user UUID + action type. `apply-to-campaign` deliberately only logs campaign ID + caller ID.
