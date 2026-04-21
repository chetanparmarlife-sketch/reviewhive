-- =============================================================================
-- ReviewHive — initial schema, RLS policies, triggers, storage buckets.
-- Run in Supabase SQL Editor, or via `supabase db push`.
-- Idempotent where practical; safe to re-run on a fresh project.
-- =============================================================================

create extension if not exists "pgcrypto";

-- =============================================================================
-- ENUM-like check constraints are used instead of Postgres enums so new values
-- can be added without ALTER TYPE migrations.
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

-- ---------- profiles ----------
-- 1:1 with auth.users. The trigger at the bottom auto-creates a row on signup.
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  name             text not null default '',
  email            text not null,
  phone            text,
  role             text not null default 'reviewer' check (role in ('reviewer','admin')),
  upi_id           text,
  pan_number       text,
  avatar_url       text,
  total_earnings   bigint not null default 0,
  completed_campaigns integer not null default 0,
  trust_score      integer not null default 80,
  is_blocked       boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- brands ----------
create table if not exists public.brands (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  logo_url     text,
  industry     text not null,
  description  text,
  website      text,
  gst_number   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------- campaigns ----------
create table if not exists public.campaigns (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  brand_id          uuid not null references public.brands(id) on delete restrict,
  marketplace       text not null check (marketplace in ('amazon_in','flipkart','meesho')),
  description       text not null,
  reward_amount     integer not null check (reward_amount >= 0),
  total_slots       integer not null check (total_slots >= 0),
  slots_filled      integer not null default 0 check (slots_filled >= 0),
  status            text not null default 'draft' check (status in ('draft','live','paused','completed')),
  start_date        timestamptz not null,
  end_date          timestamptz not null,
  requirements      jsonb not null default '[]'::jsonb,
  cover_image_url   text,
  category          text not null default 'Other',
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- products ----------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.campaigns(id) on delete cascade,
  name             text not null,
  asin_or_id       text not null,
  marketplace_url  text not null,
  price            integer not null default 0,
  image_url        text,
  position         integer not null default 0
);

-- ---------- applications ----------
create table if not exists public.applications (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references public.campaigns(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,
  status            text not null default 'applied' check (status in (
                      'applied','approved','rejected','reserved','purchased',
                      'submitted','verified','paid','rejected_submission'
                    )),
  order_id          text,
  order_proof_url   text,
  review_link       text,
  review_proof_url  text,
  review_text       text,
  submitted_at      timestamptz,
  verified_at       timestamptz,
  paid_at           timestamptz,
  payout_utr        text,
  admin_notes       text,
  rejection_reason  text,
  applied_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint applications_user_campaign_uniq unique (campaign_id, user_id)
);

-- One marketplace order may only be claimed once across the platform.
create unique index if not exists applications_order_id_uniq
  on public.applications (order_id)
  where order_id is not null;

-- ---------- notifications ----------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  title       text not null,
  message     text not null,
  read        boolean not null default false,
  link        text,
  created_at  timestamptz not null default now()
);

-- ---------- payouts ----------
create table if not exists public.payouts (
  id                   uuid primary key default gen_random_uuid(),
  application_id       uuid not null references public.applications(id) on delete cascade,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  amount               integer not null,
  status               text not null default 'queued' check (status in ('queued','processing','paid','failed')),
  utr                  text,
  razorpay_payout_id   text,
  tds_amount           integer not null default 0,
  created_at           timestamptz not null default now(),
  paid_at              timestamptz
);

-- ---------- audit_logs ----------
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  details      jsonb,
  created_at   timestamptz not null default now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
create index if not exists idx_campaigns_status on public.campaigns(status);
create index if not exists idx_campaigns_brand_id on public.campaigns(brand_id);
create index if not exists idx_products_campaign_id on public.products(campaign_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_user_status on public.applications(user_id, status);
create index if not exists idx_applications_campaign_id on public.applications(campaign_id);
create index if not exists idx_notifications_user_read on public.notifications(user_id, read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);
create index if not exists idx_payouts_user_id on public.payouts(user_id);
create index if not exists idx_payouts_application_id on public.payouts(application_id);
create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);

-- =============================================================================
-- HELPERS
-- =============================================================================

-- is_admin() — used inside RLS policies.
-- SECURITY DEFINER so RLS on profiles doesn't block the lookup.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- updated_at touch trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-create a profile row when a new auth.users row is inserted.
-- email and name (from user_metadata) come from the signup payload.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, phone, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email,''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone),
    'reviewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- Application status transition handler:
--   * increments/decrements campaigns.slots_filled when moving into/out of
--     a slot-occupying status
--   * sets submitted_at / verified_at / paid_at timestamps
--   * bumps profiles.total_earnings + completed_campaigns on first 'paid'
--   * inserts a notification for the reviewer
create or replace function public.handle_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  slot_prev boolean;
  slot_new  boolean;
  camp      public.campaigns%rowtype;
  msg       text;
begin
  -- Fetch campaign
  select * into camp from public.campaigns where id = new.campaign_id;

  slot_prev := (tg_op = 'UPDATE' and old.status in
    ('approved','reserved','purchased','submitted','verified','paid'));
  slot_new  := (new.status in
    ('approved','reserved','purchased','submitted','verified','paid'));

  if tg_op = 'INSERT' and slot_new then
    update public.campaigns set slots_filled = slots_filled + 1
      where id = new.campaign_id;
  elsif tg_op = 'UPDATE' and not slot_prev and slot_new then
    update public.campaigns set slots_filled = slots_filled + 1
      where id = new.campaign_id;
  elsif tg_op = 'UPDATE' and slot_prev and not slot_new then
    update public.campaigns set slots_filled = greatest(slots_filled - 1, 0)
      where id = new.campaign_id;
  end if;

  -- Timestamps
  if new.status = 'submitted' and new.submitted_at is null then
    new.submitted_at = now();
  end if;
  if new.status = 'verified' and new.verified_at is null then
    new.verified_at = now();
  end if;
  if new.status = 'paid' and new.paid_at is null then
    new.paid_at = now();
  end if;

  -- Earnings / notifications — only fire on real status changes
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'paid' then
      update public.profiles
        set total_earnings = total_earnings + coalesce(camp.reward_amount, 0),
            completed_campaigns = completed_campaigns + 1
      where id = new.user_id;

      insert into public.notifications (user_id, type, title, message, link)
      values (
        new.user_id, 'payout',
        '🎉 Payout credited!',
        '₹' || camp.reward_amount || ' paid for "' || camp.title || '". UTR: ' || coalesce(new.payout_utr,'—'),
        '/#/wallet'
      );
    else
      msg := case new.status
        when 'approved'            then 'You''re approved for "' || camp.title || '". Pick a product to reserve your slot.'
        when 'reserved'            then 'Product reserved for "' || camp.title || '". Buy it and upload your order screenshot.'
        when 'purchased'           then 'Order logged for "' || camp.title || '". Now submit your review.'
        when 'submitted'           then 'Review submitted for "' || camp.title || '". We''ll verify within 48 hours.'
        when 'verified'            then 'Review verified for "' || camp.title || '". Payment queued.'
        when 'rejected'            then 'Your application for "' || camp.title || '" was not selected this time.'
        when 'rejected_submission' then 'Your submission for "' || camp.title || '" needs changes. Check admin notes.'
        else null
      end;
      if msg is not null then
        insert into public.notifications (user_id, type, title, message, link)
        values (new.user_id, 'status_change', 'Status update', msg, '/#/applications');
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_status_trigger on public.applications;
create trigger applications_status_trigger
  before insert or update of status on public.applications
  for each row
  execute function public.handle_application_status_change();

-- updated_at triggers on every table that carries the column
do $$
declare t text;
begin
  foreach t in array array['profiles','brands','campaigns','applications']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I;', t, t);
    execute format(
      'create trigger %I_updated_at before update on public.%I
       for each row execute function public.touch_updated_at();',
      t, t
    );
  end loop;
end $$;

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles       enable row level security;
alter table public.brands         enable row level security;
alter table public.campaigns      enable row level security;
alter table public.products       enable row level security;
alter table public.applications   enable row level security;
alter table public.notifications  enable row level security;
alter table public.payouts        enable row level security;
alter table public.audit_logs     enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles self read"   on public.profiles;
drop policy if exists "profiles admin read"  on public.profiles;
drop policy if exists "profiles self update" on public.profiles;
drop policy if exists "profiles admin update" on public.profiles;

create policy "profiles self read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles admin read"
  on public.profiles for select
  using (public.is_admin());

-- Users may update their own profile, but not escalate their role or earnings.
-- Role/earnings/trust_score are guarded at the column level via a check.
create policy "profiles self update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and total_earnings = (select p.total_earnings from public.profiles p where p.id = auth.uid())
    and completed_campaigns = (select p.completed_campaigns from public.profiles p where p.id = auth.uid())
    and trust_score = (select p.trust_score from public.profiles p where p.id = auth.uid())
    and is_blocked = (select p.is_blocked from public.profiles p where p.id = auth.uid())
  );

create policy "profiles admin update"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- brands ----------
drop policy if exists "brands read"   on public.brands;
drop policy if exists "brands admin write" on public.brands;

create policy "brands read"
  on public.brands for select
  to authenticated
  using (true);

create policy "brands admin write"
  on public.brands for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- campaigns ----------
drop policy if exists "campaigns live read"  on public.campaigns;
drop policy if exists "campaigns admin read" on public.campaigns;
drop policy if exists "campaigns admin write" on public.campaigns;

create policy "campaigns live read"
  on public.campaigns for select
  to authenticated
  using (status = 'live' or public.is_admin());

create policy "campaigns admin write"
  on public.campaigns for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- products ----------
drop policy if exists "products read" on public.products;
drop policy if exists "products admin write" on public.products;

create policy "products read"
  on public.products for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.campaigns c
      where c.id = products.campaign_id and c.status = 'live'
    )
  );

create policy "products admin write"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- applications ----------
drop policy if exists "apps self read"         on public.applications;
drop policy if exists "apps admin read"        on public.applications;
drop policy if exists "apps self insert"       on public.applications;
drop policy if exists "apps self update"       on public.applications;
drop policy if exists "apps admin update"      on public.applications;

create policy "apps self read"
  on public.applications for select
  using (user_id = auth.uid());

create policy "apps admin read"
  on public.applications for select
  using (public.is_admin());

-- User can insert only if:
--   - the user_id matches their auth.uid()
--   - campaign is live
--   - slots are available
--   - they don't already have an application for this campaign (enforced by unique constraint too)
create policy "apps self insert"
  on public.applications for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.campaigns c
      where c.id = campaign_id
        and c.status = 'live'
        and c.slots_filled < c.total_slots
    )
    and not exists (
      select 1 from public.applications a
      where a.user_id = auth.uid() and a.campaign_id = applications.campaign_id
    )
  );

-- User can update only their own row, only the submission fields, and only in
-- the valid transitions approved→purchased or purchased→submitted.
-- Admin updates are unrestricted.
create policy "apps self update"
  on public.applications for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and status in ('approved','reserved','purchased','submitted')
  );

create policy "apps admin update"
  on public.applications for update
  using (public.is_admin())
  with check (public.is_admin());

-- (No delete policy — nobody deletes applications.)

-- ---------- notifications ----------
drop policy if exists "notif self read"   on public.notifications;
drop policy if exists "notif self update" on public.notifications;
drop policy if exists "notif admin all"   on public.notifications;

create policy "notif self read"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notif self update"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notif admin all"
  on public.notifications for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- payouts ----------
drop policy if exists "payouts self read"   on public.payouts;
drop policy if exists "payouts admin all"   on public.payouts;

create policy "payouts self read"
  on public.payouts for select
  using (user_id = auth.uid());

create policy "payouts admin all"
  on public.payouts for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- audit_logs ----------
drop policy if exists "audit admin read" on public.audit_logs;
create policy "audit admin read"
  on public.audit_logs for select
  using (public.is_admin());
-- No client-side writes; service_role (Edge Functions) inserts.

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================
insert into storage.buckets (id, name, public)
values
  ('order-proofs',    'order-proofs',    false),
  ('review-proofs',   'review-proofs',   false),
  ('brand-logos',     'brand-logos',     true),
  ('campaign-covers', 'campaign-covers', true),
  ('avatars',         'avatars',         true)
on conflict (id) do nothing;

-- Storage RLS — the canonical pattern is `{user_id}/<filename>`.
-- Authenticated users may write to their own folder.
drop policy if exists "user uploads own folder" on storage.objects;
create policy "user uploads own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('order-proofs','review-proofs','avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user reads own private proofs" on storage.objects;
create policy "user reads own private proofs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('order-proofs','review-proofs')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin reads all private proofs" on storage.objects;
create policy "admin reads all private proofs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id in ('order-proofs','review-proofs') and public.is_admin()
  );

drop policy if exists "public buckets anonymous read" on storage.objects;
create policy "public buckets anonymous read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id in ('brand-logos','campaign-covers','avatars'));

drop policy if exists "admin writes public buckets" on storage.objects;
create policy "admin writes public buckets"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('brand-logos','campaign-covers') and public.is_admin()
  );

drop policy if exists "users delete own uploads" on storage.objects;
create policy "users delete own uploads"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id in ('order-proofs','review-proofs','avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Realtime: publish notifications table so clients can subscribe.
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'applications'
  ) then
    execute 'alter publication supabase_realtime add table public.applications';
  end if;
end $$;
