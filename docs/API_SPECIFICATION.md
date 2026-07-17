# API & RPC Specification

Project Titan doesn't have a hand-rolled REST API — the frontend talks to Supabase's auto-generated PostgREST API directly, scoped by Row Level Security (see [DATABASE_DESIGN.md](DATABASE_DESIGN.md)). The one piece of custom API surface is the public tracking RPC, specified below, plus the Next.js routing/role-gating layer that sits in front of the whole app.

---

## 1. `track_container` — public RPC

The only way an anonymous (unauthenticated) visitor can read container data at all. It exists specifically so the public tracking page doesn't need — and can never get — direct table access.

### Signature

```sql
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
```

| | |
|---|---|
| **Endpoint (client call)** | `supabase.rpc('track_container', { p_id: trackingId })` |
| **Auth required** | None — granted to the `anon` role explicitly |
| **Input** | `p_id: text` — a container reference number, case/whitespace-insensitive (`upper(trim(...))` normalizes it server-side) |
| **Output** | Zero or one row: `{ id, status, gate_in_time, gate_out_time }` |
| **Fields deliberately excluded** | `seller_id`, `owner_email`, `last_milestone_sent` — no seller identity, consignee contact info, or internal alert state is ever exposed to an anonymous caller |

### Why a `SECURITY DEFINER` function instead of a permissive RLS policy

Granting `anon` a `select` policy directly on `containers` would require either exposing every column to anonymous users, or maintaining a parallel "public" view kept in sync with the real table. A narrow, single-purpose function is simpler to audit: the return type itself is the contract, and it's mechanically impossible for the function to leak a column that isn't in its `returns table (...)` signature.

### Client-side handling (`src/app/page.js`)

```js
const { data, error } = await supabase.rpc('track_container', { p_id: trackingId.trim() });
const result = Array.isArray(data) ? data[0] : data;
if (error || !result) {
  // shown: "Cargo mismatch: Container reference ID does not exist in port database logs."
}
```

No distinction is made between "container doesn't exist" and "RPC error" in the UI copy — this avoids leaking whether an ID format is merely unrecognized vs. a real query failure.

---

## 2. Next.js Route Gating (Middleware)

All other data access goes through the standard Supabase JS client, scoped entirely by RLS — there's no separate "API layer" to specify beyond the RLS policies themselves. What *is* specified here is which routes require which role, enforced in [`src/middleware.js`](../src/middleware.js) before any page component even renders.

| Route pattern | Required role | Behavior if unmet |
|---|---|---|
| `/admin/*` | `admin` | Redirect to `/` |
| `/seller/*` | `seller` | Redirect to `/` |
| `/` (gateway) | none | Always accessible; redirects *away* to `/admin` or `/seller` if a session already exists (handled client-side in `page.js`, not middleware) |

### Logic

```js
const requiresRole = pathname.startsWith('/admin') ? 'admin'
                    : pathname.startsWith('/seller') ? 'seller'
                    : null;

if (requiresRole) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) redirect('/');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role !== requiresRole) redirect('/');
}
```

Two things worth noting as deliberate design choices:

1. **The role check queries the database on every gated request** — it does not trust a role claim embedded in the session/JWT, so a role change made by an admin takes effect immediately on the user's very next navigation, without requiring them to log out and back in.
2. **Middleware uses `createServerClient` from `@supabase/ssr`**, reading the session from cookies rather than `localStorage` — this is why the app's browser client (`src/utils/supabase.js`) is also built with `createBrowserClient` from the same package: both must agree on where the session lives, or middleware would see no session even while the client believes the user is signed in.

This gives the app two independent enforcement layers for the same rule (route access requires the right role): Next.js middleware for navigation, and Postgres RLS for data. Neither depends on the other — even if middleware were misconfigured or bypassed, RLS still prevents a seller from reading or writing another seller's data or performing admin-only mutations.
