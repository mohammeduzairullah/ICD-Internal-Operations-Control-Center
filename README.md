# Project Titan — ICD Internal Operations Control Center

A container dwell-time and demurrage tracking system for an Inland Container Depot (ICD), built with Next.js and Supabase.

It tracks how long each container sits in the yard against a 72-hour free window, flags SLA breaches in real time, calculates accruing storage fees, and emails milestone alerts as containers approach their deadline — with role-scoped dashboards for admins and sellers, and a public tracking page for anyone with a container reference number.

## Features

- **Admin dashboard** — deploy containers to the yard, batch update/delete, live SLA breach alerts, yard capacity and outstanding-penalty summary.
- **Seller dashboard** — dispatch your own containers, search/sort your ledger, track live countdowns.
- **Public tracking** — look up a single container by reference ID with no login required.
- **Live demurrage engine** — $50/hour accrues automatically past the 72-hour free window; countdowns and fees update in real time in the UI.
- **Milestone email alerts** — a Supabase Edge Function + `pg_cron` job checks every 15 minutes and emails the consignee (and seller, for later milestones) at 24h / 48h / 60h / 72h via Resend.
- **Role-based access** — enforced both in Next.js middleware and at the database level via Postgres Row Level Security; roles are never trusted from client input.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router, Turbopack)
- [Supabase](https://supabase.com) — Postgres, Auth, Row Level Security, Edge Functions, `pg_cron`
- [Tailwind CSS 4](https://tailwindcss.com)
- [Resend](https://resend.com) for transactional email

## Project structure

```
src/
  app/
    page.js          # public gateway — sign in / register / track cargo
    admin/page.js     # admin dashboard
    seller/page.js    # seller dashboard
  components/          # shared UI (toasts, modal, status badge, skeletons)
  utils/
    supabase.js        # Supabase browser client + profile lookup
    tracker.js          # demurrage / dwell-time calculations
  middleware.js          # route-level role gating
supabase/
  schema.sql               # tables, RLS policies, triggers, public tracking RPC, cron job
  functions/
    send-milestone-alerts/  # Edge Function that emails dwell-time milestones
```

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/mohammeduzairullah/ICD-Internal-Operations-Control-Center.git
cd ICD-Internal-Operations-Control-Center
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) — it creates the `profiles` and `containers` tables, RLS policies, the public `track_container` RPC, and the 15-minute cron job.
3. Deploy the milestone email function (requires the [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase functions deploy send-milestone-alerts --no-verify-jwt
   supabase secrets set RESEND_API_KEY=your_resend_key
   ```
   `--no-verify-jwt` is required because `pg_cron` invokes the function with no auth header.

### 3. Configure environment variables

Copy your Supabase project's URL and anon key into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

These are safe to expose client-side — access to data is enforced by Row Level Security, not by keeping the anon key secret. `.env.local` is gitignored and must never be committed.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register a seller account through the app, then promote yourself to admin from the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Deployment

The app is deployed on [Vercel](https://vercel.com), connected directly to this GitHub repo — every push to `main` triggers a new deployment.

Set the same two environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) in the Vercel project settings so they match `.env.local`.

## Security notes

- No service-role key or other server-only secret is ever used client-side — only the public anon key, which is meant to be exposed and is scoped entirely by RLS policies in `supabase/schema.sql`.
- Roles are resolved from the `profiles` table, never trusted from the client, and self-registration can only ever create a `seller` — admin promotion is a manual, deliberate SQL step.
- The public tracking RPC (`track_container`) returns only a narrow set of columns for a single container — no seller identity or contact info is ever exposed to anonymous visitors.
