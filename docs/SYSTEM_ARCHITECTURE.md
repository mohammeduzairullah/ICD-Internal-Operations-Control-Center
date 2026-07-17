# System Architecture & Automation Flow (SAD)

This document maps the moving background parts of Project Titan — the automated alert pipeline and the live demurrage engine — that aren't visible just from reading the UI code.

---

## 1. High-level architecture

```
┌──────────────────┐        ┌───────────────────────────────┐
│   Next.js App     │◄──────►│         Supabase                │
│  (Vercel, SSR/CSR) │  anon   │  Postgres + Auth + RLS          │
│                   │  key    │  Edge Functions (Deno)           │
└──────────────────┘        │  pg_cron (scheduled jobs)        │
                              └───────────────┬──────────────┘
                                              │ every 15 min
                                              ▼
                                     send-milestone-alerts
                                       (Edge Function)
                                              │
                                              ▼
                                        Resend Email API
                                              │
                                              ▼
                                 Consignee (+ seller, later milestones)
```

The frontend never talks to Resend or triggers emails directly — that entire pipeline runs independently of whether anyone has the app open, driven purely by the database and a cron schedule.

---

## 2. The automated Alert Pipeline

```
Container gate-in
      │  (gate_in_time recorded, status = IN_ICD)
      ▼
Dwell time accrues silently — no code runs per-second in the database
      │
      ▼
pg_cron trigger, every 15 minutes
  (supabase/schema.sql: cron.schedule('milestone-check-every-15-min', '*/15 * * * *', ...))
      │  calls net.http_post() against the Edge Function URL
      ▼
send-milestone-alerts (Supabase Edge Function, Deno)
  1. Loads every container where status = 'IN_ICD'
  2. For each, computes hours elapsed since gate_in_time
  3. Compares against last_milestone_sent to find the highest
     new milestone crossed (24h / 48h / 60h / 72h) since last check
  4. If a new milestone was crossed:
       - looks up the message copy for that milestone
       - sends via Resend to the consignee (owner_email),
         cc'ing the seller for the 48h/60h/72h milestones
       - updates containers.last_milestone_sent so it's not resent
      ▼
Resend Email API → consignee inbox (+ seller, if applicable)
```

Key design point: the function is **idempotent per milestone**. Because `last_milestone_sent` is persisted and checked before sending, running the cron job more frequently, or the job overlapping a slow run, cannot double-send an alert for a milestone already crossed.

The function must be deployed with `--no-verify-jwt` because `pg_cron`'s `net.http_post()` call carries no auth header — see [`supabase/functions/send-milestone-alerts`](../supabase/functions/send-milestone-alerts/index.ts).

---

## 3. The Live Demurrage Engine

Implemented client-side in [`src/utils/tracker.js`](../src/utils/tracker.js) and re-evaluated on every render (dashboards re-render once per second via a live clock tick), so counters and fees update without a page refresh:

```js
hoursElapsed   = floor( (now_or_gate_out − gate_in_time) / 1 hour )
hoursRemaining = max(0, 72 − hoursElapsed)
isBreached     = hoursElapsed > 72
demurrageFee   = isBreached ? (hoursElapsed − 72) × $50 : $0
```

- **Clock source**: if `gate_out_time` is set, the container's clock has stopped — the fee is frozen at whatever it was at gate-out. Otherwise `now` (updated every second in the dashboards) is used, so the fee visibly ticks upward in real time for containers still in the yard.
- **Free window**: 72 hours, matching the milestone schedule used by the email pipeline (so the "72h" email and the "fee starts accruing" moment are the same instant).
- **Rate**: a flat $50/hour once the free window is exceeded — intentionally linear and simple rather than tiered, to keep the UI's live counter easy to reason about at a glance.

This same 72-hour/$50 constants pair is duplicated conceptually in the Edge Function's `MILESTONES`/`HOURLY_FEE` constants for the email copy — a known duplication documented here so a future change to the SLA window updates both places.

---

## 4. Why cron + Edge Function instead of a Next.js API route on a timer

A serverless Next.js deployment (Vercel) has no persistent process to run a `setInterval` in — there's no server that's "always on" to check dwell times. Moving the schedule into Postgres (`pg_cron`) and the actual work into a Supabase Edge Function means the alert pipeline runs correctly regardless of whether the frontend has any traffic, deploys, or cold starts.
