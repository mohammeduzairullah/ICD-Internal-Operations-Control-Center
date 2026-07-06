-- Titan ICD App — database schema
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query).
-- Safe to re-run: uses "if not exists" / "or replace" where possible, but tables
-- will error if they already exist — this is meant for a fresh project.

-- =========================================================
-- 1. profiles — one row per authenticated user, role-gated
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'seller' check (role in ('admin', 'seller')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper used by RLS policies below. SECURITY DEFINER + a fixed search_path
-- avoids recursive RLS lookups (querying profiles from inside a profiles policy).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- No insert/update/delete policy for regular users on purpose: profiles are
-- created only by the trigger below, and role changes are done manually by
-- the project owner via the SQL editor (see the promote-to-admin command in
-- the project README / setup notes).

-- Auto-create a 'seller' profile whenever someone signs up. This is the only
-- way a profile gets created, so self-registration can never produce an admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'seller');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- 2. containers — the core ICD dwell-time tracked entity
-- =========================================================
create table public.containers (
  id text primary key,
  status text not null default 'IN_ICD' check (status in ('IN_ICD', 'GATE_OUT')),
  gate_in_time timestamptz not null default now(),
  gate_out_time timestamptz,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  owner_email text not null,
  last_milestone_sent int not null default 0 check (last_milestone_sent in (0, 24, 48, 60, 72)),
  created_at timestamptz not null default now()
);

create index containers_seller_id_idx on public.containers (seller_id);
create index containers_status_idx on public.containers (status);

alter table public.containers enable row level security;

create policy "containers_select_own_or_admin"
  on public.containers for select
  using (seller_id = auth.uid() or public.is_admin());

create policy "containers_insert_own"
  on public.containers for insert
  with check (seller_id = auth.uid());

create policy "containers_update_admin_only"
  on public.containers for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "containers_delete_admin_only"
  on public.containers for delete
  using (public.is_admin());

-- =========================================================
-- 3. Public tracking RPC — the only way an anonymous visitor
--    can read container data. Returns a narrow column set only
--    (no seller_id / owner_email), for exactly one container ID.
-- =========================================================
create or replace function public.track_container(p_id text)
returns table (
  id text,
  status text,
  gate_in_time timestamptz,
  gate_out_time timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.status, c.gate_in_time, c.gate_out_time
  from public.containers c
  where c.id = upper(trim(p_id));
$$;

grant execute on function public.track_container(text) to anon, authenticated;

-- =========================================================
-- 4. Scheduled milestone check (every 15 minutes)
--    Calls the send-milestone-alerts Edge Function.
--    IMPORTANT: deploy that function with --no-verify-jwt
--    (see supabase/functions/send-milestone-alerts), since pg_cron
--    calls it with no auth header.
-- =========================================================
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'milestone-check-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://swzexjbletoyvswuvdxw.supabase.co/functions/v1/send-milestone-alerts',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- =========================================================
-- One-time step for you: after you sign up your own admin
-- account through the app's normal register flow, run this
-- (with your real email) to promote yourself to admin:
--
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- =========================================================
