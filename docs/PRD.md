# Product Requirements Document (PRD) / Feature Map

Written to show the feature set was scoped intentionally before/alongside development, rather than accumulated ad hoc. There was no external client for this project — the "requirements" below are the product decisions I made and held myself to as both PM and developer.

---

## 1. Problem statement

An Inland Container Depot (ICD) needs to track how long each container sits in the yard, because storage past a free window (72 hours, in this system) incurs demurrage fees. Three distinct audiences need different views into the same data:

- **Terminal operators** need to see and manage every container in the yard, and be alerted the moment any container breaches its SLA.
- **Exporters/sellers** need to see and manage only the containers they personally dispatched.
- **Consignees and other outside parties** need to check a single container's status without needing an account at all.

---

## 2. User roles

| Role | Who | Access |
|---|---|---|
| **Admin** | Terminal/operations staff | Full visibility into all containers; can add, batch-update status, and batch-delete. Sees yard-wide capacity, SLA breach count, and total outstanding demurrage. |
| **Seller** | Exporters who dispatch cargo | Can dispatch (create) their own containers and view their own dispatch ledger with search/sort. Cannot see other sellers' containers, and cannot change container status or delete records (operational control stays with Admin). |
| **Anonymous / Public Tracker** | Consignees, or anyone with a reference number | Can look up a single container's status, dwell time, and gate-in time via reference ID — no login, no account. Cannot see who the seller is or their contact info. |

Role separation is enforced at both the routing layer and the database layer — see [API_SPECIFICATION.md](API_SPECIFICATION.md) and [DATABASE_DESIGN.md](DATABASE_DESIGN.md).

A deliberate product decision: **self-registration always creates a Seller, never an Admin.** Admin is a trusted operational role and is granted manually, not something a random signup should be able to claim.

---

## 3. MVP features (must-have, all shipped)

- [x] Email/password auth with role-based redirect after login
- [x] Seller: dispatch a container (ID + consignee email), see it appear immediately in their ledger
- [x] Seller: search and sort their own ledger (by urgency, newest, or container ID)
- [x] Admin: view every container in the yard with live dwell time and demurrage fee
- [x] Admin: add a container on behalf of any seller
- [x] Admin: batch select containers → batch status change or batch delete
- [x] Live SLA breach detection with an in-dashboard alert banner
- [x] Public tracking page — reference ID lookup, no login
- [x] Row Level Security enforced so no role can access another's data by any means (UI bypass, direct API call)

## 4. Nice-to-have features (shipped, beyond MVP)

- [x] Automated milestone email alerts (24h / 48h / 60h / 72h) via a scheduled Edge Function + Resend, so operators/consignees don't have to keep the dashboard open to be notified
- [x] Toast notifications for every mutating action (add/update/delete/dispatch), success and error states
- [x] Skeleton loading states and empty states instead of blank tables
- [x] Confirm-before-delete modal for destructive batch actions
- [x] Live-updating countdowns/fees (per-second re-render) instead of requiring a manual refresh
- [x] A cohesive, bright, responsive theme across all three surfaces (gateway, admin, seller)

## 5. Explicitly out of scope (for this version)

- Multi-depot / multi-yard support (single yard assumed)
- Configurable free-window duration or fee rate (hardcoded 72h / $50 by design, to keep the demurrage engine simple and auditable)
- Automated tests (documented as a known gap — see the README's Lessons Learned)
- A custom REST/GraphQL API layer (Supabase's auto-generated API + RLS was a deliberate architecture choice over hand-rolling one — see [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md))

---

## 6. Success criteria

- A seller can dispatch a container and see it reflected in their own ledger without seeing any other seller's data, verified by RLS rather than by UI hiding.
- An admin can see and act on every container in the yard, and receives an unmistakable alert as soon as any container breaches its SLA.
- A member of the public with only a container reference number can retrieve its status without registering, and without exposing any seller-identifying data.
- Operators/consignees receive an email at each dwell-time milestone with no manual intervention required.
