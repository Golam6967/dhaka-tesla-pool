# Requirement-to-Evidence Completion Audit

Per PDF §27. Every requirement below is checked against what's actually
implemented, tested, and documented — not assumed. Deviations are called out
explicitly rather than glossed over.

Legend: ✅ done and verified · ⚠️ partial / needs action · ❌ not done (owner noted)

## Core functionality (§3)

| Requirement | Implemented in | Test | Docs | Verified | Status |
|---|---|---|---|---|---|
| Passenger signup/login | `auth.service.js`, `passenger.routes.js` | `auth.test.js` | README | Browser | ✅ |
| Ride request (pickup/dest/seats) + estimated fare | `ride.service.js`, `fare.service.js` | `ride-request.test.js`, `fare.service.test.js` | README §1, architecture.md §3 | Browser + live API | ✅ |
| Passenger status tracking, history, cancel | `ride.service.js` | `ride-request.test.js`, `cancellation.test.js` | README | Browser | ✅ |
| Driver signup/login + owns a Tesla | `driver.service.js` | `driver-auth.test.js` | README | Browser | ✅ |
| Driver online/offline | `driver.service.js` (`setStatus`) | `driver-auth.test.js` | README | Browser | ✅ |
| Driver sees relevant requests, accepts | `driver.service.js`, `pool.service.js` | `driver-flow.test.js`, `pool.test.js` | README §2 | Browser | ✅ |
| Driver marks arrived/started/completed | `ride.service.js` | `driver-flow.test.js` | README §3 | Browser | ✅ |
| Driver sees passengers/seats/history | `driver.service.js` (`getActivePool`, `getHistory`) | `driver-flow.test.js` | README | Browser | ✅ |
| Pool: capacity never exceeded, individual fares | `pool.service.js` | `pool.test.js` | README §1 | Browser (live worked example) | ✅ |
| Exact lifecycle `REQUESTED→MATCHED→DRIVER_ARRIVED→STARTED→COMPLETED(+CANCELLED)` | `rideStateMachine.js` | `rideStateMachine.test.js` | README §3 | — | ✅ |

## Architecture & database (§4–§6)

| Requirement | Implemented in | Test | Docs | Verified | Status |
|---|---|---|---|---|---|
| 3-layer architecture, no microservices/Kafka/K8s/Redis/queues | whole `backend/`, `frontend/` | — | README | Code review | ✅ |
| All 10 ERD tables | `backend/migrations/001–008` | `db-constraints.test.js` | README ERD, architecture.md §2 | `docker compose` + migrate | ✅ |
| `one_active_pool_per_tesla` partial unique index | `004_create_pools.js` | `db-constraints.test.js`, `pool.test.js` | README §5 | Live DB | ✅ |
| `pool_members.ride_request_id` UNIQUE | `006_create_pool_members.js` | `db-constraints.test.js` | README | Live DB | ✅ |
| CHECK constraints (capacity, seats, occupancy) | migrations 002/004/005 | `db-constraints.test.js` | README | Live DB | ✅ |
| Matching rule: same pickup zone + destination corridor | `pool.service.js` | `pool.test.js` (incompatible-zone rejection) | README §2, architecture.md §6 | Live API | ✅ |

## Fare model (§7)

| Requirement | Implemented in | Test | Docs | Verified | Status |
|---|---|---|---|---|---|
| `baseFare + distanceCharge − poolDiscount`, integer paisa | `fare.service.js` | `fare.service.test.js` | README §1 | — | ✅ |
| Exact figures: Nusrat 7200, Rafiq 6000 paisa | `fare.service.js`, `pool.service.js` (retroactive discount) | `fare.service.test.js`, `pool.test.js` | README §1 | **Live browser screenshot** showing ৳72.00 / ৳60.00 | ✅ |

## Concurrency (§8–§9)

| Requirement | Implemented in | Test | Docs | Verified | Status |
|---|---|---|---|---|---|
| Seat-claim race: `FOR UPDATE` lock, only one wins | `pool.service.js` | `pool.test.js` (real concurrent `Promise.all`, stress-run 5×) | README §4 | Automated | ✅ |
| Pool-creation race: unique constraint + catch-and-retry | `pool.service.js` | `pool.test.js` (real concurrent `Promise.all`) | README §5 | Automated | ✅ |
| Atomic multi-step operations (join/cancel/transition) | `pool.service.js`, `ride.service.js` | all feature test files | README §8 | — | ✅ |

## State machine & cancellation (§10–§11)

| Requirement | Implemented in | Test | Docs | Verified | Status |
|---|---|---|---|---|---|
| Single authoritative transition allow-list | `rideStateMachine.js` | `rideStateMachine.test.js` (13 cases) | README §3 | — | ✅ |
| Invalid transitions rejected (STARTED→REQUESTED etc.) | `rideStateMachine.js` | `rideStateMachine.test.js` | README §3 | — | ✅ |
| Cancellation: allowed states, pool cleanup, history | `ride.service.js` | `cancellation.test.js` (8 cases, permitted + rejected) | README §6, architecture.md §7 | Browser | ✅ |

## Authorization & auth (§12–§13)

| Requirement | Implemented in | Test | Docs | Verified | Status |
|---|---|---|---|---|---|
| Passenger views/modifies only own ride | `ride.service.js` | `ride-request.test.js`, `authorization.test.js` | README §7 | — | ✅ |
| No UUID-guessing access to another's ride | `ride.service.js` (ownership check) | `authorization.test.js` | README §7 | — | ✅ |
| Role checks (passenger can't do driver ops, vice versa) | `requireRole.js` | every feature test file | README §7 | — | ✅ |
| Driver operates only own Tesla/rides | `pool.service.js`, `ride.service.js` | `driver-flow.test.js`, `authorization.test.js` | README §7 | — | ✅ (gap found + fixed in `feature/authorization`, see `ai-usage-notes.md`) |
| Bcrypt hashing, never plaintext | `auth.service.js`, `driver.service.js` | `auth.test.js` (password_hash never in response) | README | — | ✅ |
| JWT identifies user + role, backend validates every route | `requireAuth.js`, `config/jwt.js` | `authorization.test.js` (401 sweep) | README | — | ✅ |

## Service layer, validation, auditability (§14–§16)

| Requirement | Implemented in | Test | Docs | Verified | Status |
|---|---|---|---|---|---|
| `route→controller→service→repository` separation | entire `backend/src/` | — | README §8, project structure | Code review | ✅ |
| Zod validation (body, params, UUIDs, enums) | `validation/*.schema.js` | every feature test file (400 cases) | README | — | ✅ |
| `ride_status_history` / `pool_status_history` append-only | migrations 007; no UPDATE/DELETE anywhere in code on these tables | `db-constraints.test.js`, `driver-flow.test.js` | README ERD | Code review (grep confirms no mutation) | ✅ |

## Tech stack, docs sync, scope discipline (§17, §22–§23)

| Requirement | Status | Notes |
|---|---|---|
| Tech stack matches PDF table, justified in README | ✅ | README "Tech stack & why" table |
| architecture.md kept in sync with every implementation change | ✅ | Updated in the same commit for every non-trivial decision throughout the build |
| Nothing from the "Do Not Add" list added | ✅ | No maps, payment gateway, ratings, Redis, Kafka, K8s, microservices, queues, event-sourcing, GPS, chat, surge pricing, notifications, analytics dashboards |

## Testing (§19) — summary

**88 tests across 12 suites, all against a real Postgres instance (no mocked DB).**
Every explicitly-required test case from §19 has a corresponding test — see the
tables above for the mapping; nothing on that list is untested.

## Frontend (§20)

| Requirement | Status |
|---|---|
| Passenger + driver flows implemented | ✅ |
| Loading/error/empty states | ✅ (`Spinner`, `ErrorBanner`, `EmptyState` components used throughout) |
| Current lifecycle state shown | ✅ (`StatusBadge`) |
| Each passenger sees only their own fare/status | ✅ |
| Pool membership/seats shown clearly | ✅ (driver's "My pool" section) |
| No disproportionate animation/polish time | ✅ (plain CSS, no animation library) |
| No maps/live routing | ✅ |

## AI usage (§21)

✅ Complete — [`docs/ai-usage-notes.md`](ai-usage-notes.md) + README AI Usage
section, including specific accepted/rejected examples and self-caught bugs.

---

## Gaps — not yet done, called out explicitly

| Item | Status | Owner / next step |
|---|---|---|
| `pre-release` branch | ❌ not cut | Can be cut now from `master` |
| `release/v1.0.0` branch | ❌ not cut | Cut from `pre-release` once integration checks pass |
| This formal audit document | ✅ **this file**, now committed | — |
| Live deployment URL | ❌ not attempted | PDF allows "documented reproducible Docker deploy" as the fallback — README already documents this. A free-tier deploy (Railway/Render/Fly.io) is possible if wanted, but not yet done |
| 6-minute demo video | ❌ not done | This requires the human to record their own screen/narration — not something that can be produced from here |
| Bonus: viral-scale reasoning (1M passengers / 100k drivers) | ❌ not done | Optional per PDF §29; not started |

**Bottom line:** every functional, correctness, concurrency, authorization, and
testing requirement is implemented and verified. What's left is process/delivery
scaffolding (git milestone branches, optionally a live deploy) and the two things
only you can produce (the video, and optionally the bonus scaling write-up).
