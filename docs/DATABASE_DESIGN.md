# Database Schema & RLS Security Design (DBD)

This document covers the data model behind Project Titan and, more importantly, how it's secured — the goal was to make privilege escalation impossible at the database layer, not just hidden in the UI. Full source: [`supabase/schema.sql`](../supabase/schema.sql).

---

## 1. Entity-Relationship Structure

```
auth.users (managed by Supabase Auth)
      │
      │ 1:1  (id references auth.users.id, on delete cascade)
      ▼
public.profiles
  id          uuid  PK, references auth.users(id)
  email       text
  role        text  'admin' | 'seller'   (default 'seller')
  created_at  timestamptz
      │
      │ 1:N  (containers.seller_id references profiles.id)
      ▼
public.containers
  id                    text  PK              (the container reference number itself)
  status                text  'IN_ICD' | 'GATE_OUT'
  gate_in_time           timestamptz
  gate_out_time          timestamptz | null
  seller_id             uuid  FK -> profiles.id
  owner_email            text                 (consignee, not a user account)
  last_milestone_sent    int   0 | 24 | 48 | 60 | 72   (tracks which email alerts have fired)
  created_at             timestamptz

indexes: containers(seller_id), containers(status)
```

`profiles.id` is the same UUID as `auth.users.id` — there is deliberately no separate profile primary key, so a profile can never exist without a matching auth user, and `on delete cascade` keeps them in lockstep.

---

## 2. Role Model

Only two roles exist: `admin` and `seller`. There is no `authenticated`-but-roleless state — every signed-up user gets a `profiles` row immediately via a trigger (see §4), and every row is constrained by a `check` clause to only ever be `'admin'` or `'seller'`.

Anonymous (unauthenticated) visitors are a third, implicit "role" — handled entirely through the public RPC in [API_SPECIFICATION.md](API_SPECIFICATION.md), not through `profiles`.

---

## 3. The `is_admin()` helper and why it exists

The naive approach to an RLS policy like "admins can see every container" is:

```sql
using ( exists (select 1 from profiles where id = auth.uid() and role = 'admin') )
```

Written directly on the `containers` policy this is fine. The problem shows up on the `profiles` table's *own* select policy — a policy on `profiles` that queries `profiles` to check the caller's role triggers Postgres to re-evaluate RLS on the subquery, which re-triggers the same policy, and so on. This is a recursive RLS lookup loop.

The fix is a `SECURITY DEFINER` function with a fixed `search_path`, which runs with the privileges of the function owner (bypassing RLS internally) rather than the calling user:

```sql
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
```

Because this function's internal query runs as the definer (not the caller), it never re-enters the caller's RLS policy, breaking the recursion. Every policy below calls `public.is_admin()` instead of inlining the subquery.

---

## 4. Auto-provisioning profiles (and why self-registration can't create an admin)

```sql
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
```

This trigger is the *only* code path that ever inserts a row into `profiles`. It's hardcoded to `role = 'seller'`, and there is intentionally **no insert/update policy** granted to regular users on `profiles`. That means:

- A user cannot register themselves as `admin` — the column value is never taken from client input.
- A user cannot later `update` their own row to change their role — no policy permits it.
- The only way a `profiles.role` becomes `'admin'` is a manual SQL statement run by the project owner directly in the Supabase SQL editor.

---

## 5. RLS Policies (verbatim)

### `profiles`

```sql
alter table public.profiles enable row level security;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());
```

A user can read their own profile row; an admin can read all of them. No insert/update/delete policy exists for regular users at all.

### `containers`

```sql
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
```

This is the core of the seller/seller isolation guarantee:

- **Select**: a seller only ever sees rows where `seller_id = auth.uid()` — they cannot query, enumerate, or infer another seller's containers, even by calling the Supabase REST/JS client directly with a crafted filter. Postgres applies the policy regardless of what the client asks for.
- **Insert**: a seller can only insert a container attributed to themselves — `seller_id` can't be spoofed to another seller's ID.
- **Update/Delete**: reserved for admins only. Sellers can dispatch and track containers but cannot mutate status or delete records — that's an operational decision enforced at the database, not just hidden behind UI buttons.

---

## 6. Why this matters

Every one of these guarantees holds even if someone bypasses the Next.js frontend entirely and calls the Supabase REST API directly with the anon key (which is public by design — see the main [README's security notes](../README.md#-security-notes)). The security boundary is the database, not the UI, which is the property RLS is meant to provide.
