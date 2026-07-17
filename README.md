# 📦 Project Titan — ICD Internal Operations Control Center

A full-stack container dwell-time and demurrage tracking system built for an Inland Container Depot (ICD), developed end-to-end as a **solo project** where I served as both **Project Manager** and **Full-Stack Developer** — from requirement scoping and architecture decisions through database design, access control, frontend, and deployment.

It tracks how long each container sits in the yard against a 72-hour free window, flags SLA breaches in real time, calculates accruing storage fees, and emails milestone alerts as containers approach their deadline — with role-scoped dashboards for admins and sellers, and a public tracking page for anyone with a container reference number.

---

## 🌐 Live Demo

**[icd-internal-operations-control-cen.vercel.app](https://icd-internal-operations-control-cen.vercel.app/)**

| Role | Email | Password |
|---|---|---|
| Admin | `admin@gmail.com` | `Admin1234` |

Sign in as admin to deploy containers, batch-update or delete them, and watch the live SLA breach / demurrage counters. You can also register your own seller account from the gateway, or use the **Track Cargo** tab to look up a container with no login at all.

---

# 📋 Project Overview

| Item              | Details                                      |
|-------------------|-----------------------------------------------|
| Project Name      | Project Titan — ICD Internal Operations Control Center |
| Project Type      | Full-stack web application (role-based dashboards) |
| Project Value     | Personal / portfolio project |
| Project Status    | ✅ Live & deployed |
| Development Started | 6 July 2026 |
| Development Model | Solo project |
| Hosting           | Vercel (auto-deploy on push to `main`) |
| Database & Auth   | Supabase (Postgres, Auth, Row Level Security, Edge Functions) |
| Email Delivery    | Resend |

---

# 👨‍💼 My Roles

This project was completed entirely by me without any team members.

## Project Manager

Responsibilities:

- Requirement scoping (defining Admin / Seller / Anonymous user needs before writing code — see the [Product Requirements Document](docs/PRD.md))
- Architecture decisions (choosing Supabase over a hand-rolled backend, weighing build speed against control)
- Risk management (identifying privilege-escalation risk in self-registration and closing it at the database layer, not just in the UI)
- Feature prioritization (MVP vs. nice-to-have — see the PRD)
- Technical documentation (database design, system architecture, API specs — see [Project Documentation](#-project-documentation) below)
- Release planning (staged rollout: schema → auth/RLS → dashboards → theming → public documentation)

## Full-Stack Developer

Responsibilities:

- Database schema design (Postgres, Row Level Security policies)
- Auth & role-based access control (admin / seller / public)
- Frontend development (Next.js App Router, React)
- UI/UX design and theming
- Backend logic (demurrage calculation engine, SLA breach detection)
- Serverless function development (Supabase Edge Function for milestone email alerts)
- Cron job scheduling (`pg_cron`)
- Deployment & CI (Vercel, connected to GitHub for auto-deploy)
- Environment/secrets management

---

# 🛠 Technologies Used

## Languages & Frameworks

- JavaScript
- Next.js 16 (App Router, Turbopack)
- React 19
- Tailwind CSS 4

## Backend & Infrastructure

- Supabase (Postgres, Auth, Row Level Security, Edge Functions, `pg_cron`)
- Resend (transactional email)

## Tools & Services

- Visual Studio Code
- Git & GitHub
- Vercel (hosting + CI/CD)
- Supabase CLI

---

# ✨ Features

- Role-based dashboards (Admin / Seller) with route-level and database-level access control
- Public container tracking — no login required
- Live demurrage fee engine ($50/hour past a 72-hour free window)
- Real-time SLA breach alerts
- Batch container operations (update, delete) for admins
- Milestone email notifications at 24h / 48h / 60h / 72h dwell time
- Fully responsive, bright light UI with live-updating counters
- Search & sort on the seller ledger

---

# ⚠ Challenges Faced

## 1. Preventing privilege escalation via Row Level Security

Roles had to be resolved from the database (`profiles` table), never trusted from client input. Self-registration can only ever create a `seller` role, and admin promotion is a deliberate, manual SQL step — this was enforced with a `SECURITY DEFINER` helper function and RLS policies rather than in application code, so it can't be bypassed by calling the API directly.

## 2. Recursive RLS lookups

An early version of the `is_admin()` check queried the `profiles` table from inside a policy on `profiles` itself, causing recursive policy evaluation. Fixing this required a `SECURITY DEFINER` function with a fixed `search_path` to break the recursion safely.

## 3. Reworking the UI theme without breaking existing interactions

The app shipped with a dark theme; switching to a bright light theme across three pages and five shared components had to preserve every existing interaction (toasts, batch selection, live countdowns, modals) exactly — this was done by re-theming Tailwind classes in place rather than rewriting component logic.

---

# 📂 Project Documentation

Technical decisions are documented separately from this README so they can be reviewed on their own:

| Document | Purpose |
|---|---|
| [Database Schema & RLS Security Design](docs/DATABASE_DESIGN.md) | ER structure, table definitions, the exact RLS policies, and how `is_admin()` avoids recursive lookups |
| [System Architecture & Automation Flow](docs/SYSTEM_ARCHITECTURE.md) | The end-to-end alert pipeline (`pg_cron` → Edge Function → Resend) and the live demurrage engine's formula |
| [API & RPC Specification](docs/API_SPECIFICATION.md) | The `track_container` public RPC contract and the Next.js middleware routing/role-gating logic |
| [Product Requirements Document](docs/PRD.md) | User roles, MVP vs. nice-to-have features, and the scoping decisions behind them |

---

# 📁 Repository Structure

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

---

# 🔒 Security Notes

- No service-role key or other server-only secret is ever used client-side — only the public anon key, which is meant to be exposed and is scoped entirely by RLS policies in `supabase/schema.sql`.
- Roles are resolved from the `profiles` table, never trusted from the client, and self-registration can only ever create a `seller` — admin promotion is a manual, deliberate SQL step.
- The public tracking RPC (`track_container`) returns only a narrow set of columns for a single container — no seller identity or contact info is ever exposed to anonymous visitors.
- The admin credentials above are for demo purposes on this deployment only — data created there is not private.

---

# 🎯 Project Outcome

Shipped a production-deployed, database-secured, multi-role full-stack application end-to-end — including a real cron-driven transactional email pipeline, live-updating business logic (demurrage accrual), and a polished responsive UI — without a team or starter template.

---

# 📚 Lessons Learned

- Designing Row Level Security policies that hold up against direct API calls, not just against the app's own UI
- Avoiding recursive policy evaluation with `SECURITY DEFINER` functions
- Structuring Next.js middleware together with Supabase SSR session cookies for reliable role gating
- Re-theming an entire app's UI without regressing any existing interaction
- Preparing a public repo and live demo for outside viewers: stripping local tooling config, keeping secrets out of git history, and writing a demo account instead of exposing personal credentials

---

# 📌 Project Status

**Status:** ✅ Live and deployed — actively maintained.

---

# 👤 Author

## Mohammed Uzairullah

**Roles Performed**

- Project Manager
- Full-Stack Developer

This repository demonstrates my ability to independently scope, architect, build, secure, document, and deploy a production full-stack application — from requirements and database design to access control, UI, and CI/CD.

---

# 📄 License

Source code is shared for portfolio and educational purposes.

---

## Local development

<details>
<summary>Expand for setup instructions</summary>

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

`.env.local` is gitignored and must never be committed.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), register a seller account through the app, then promote yourself to admin from the Supabase SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

</details>
