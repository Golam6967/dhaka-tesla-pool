# Dhaka Tesla Pool

A ride-pooling MVP for Dhaka: passengers request rides, a driver's fixed-capacity
Tesla pools compatible passengers together, and each passenger gets an individually
calculated, pool-discounted fare.

Internship take-home challenge (RoBenDevs). Full spec: [`docs/Dhaka_Tesla_Pool_Master_Instructions_v2.pdf`](docs/Dhaka_Tesla_Pool_Master_Instructions_v2.pdf).
Design detail beyond this README: [`docs/architecture.md`](docs/architecture.md).

---

## Table of contents

- [The story](#the-story)
- [Features implemented](#features-implemented)
- [Architecture](#architecture)
- [Tech stack \& why](#tech-stack--why)
- [Database schema (ERD)](#database-schema-erd)
- [How it actually works — core mechanisms](#how-it-actually-works--core-mechanisms)
  - [1. The fare model](#1-the-fare-model)
  - [2. The matching rule](#2-the-matching-rule)
  - [3. The ride lifecycle (state machine)](#3-the-ride-lifecycle-state-machine)
  - [4. Concurrency fix #1 — the seat-claim race](#4-concurrency-fix-1--the-seat-claim-race)
  - [5. Concurrency fix #2 — the pool-creation race](#5-concurrency-fix-2--the-pool-creation-race)
  - [6. Cancellation](#6-cancellation)
  - [7. Authorization](#7-authorization)
  - [8. Service-layer organization](#8-service-layer-organization)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Environment variables](#environment-variables)
- [Getting started](#getting-started)
- [Running tests](#running-tests)
- [Demo credentials](#demo-credentials)
- [Known limitations \& next improvements](#known-limitations--next-improvements)
- [AI usage](#ai-usage)
- [Git workflow](#git-workflow)

---

## The story

| Name | Role | Detail |
|---|---|---|
| **Jashim** | Driver | Owns the Tesla |
| **Bullet** | Vehicle | 3-seat capacity |
| **Nusrat** | Passenger | Banani → Mohakhali |
| **Rafiq** | Passenger | Banani → Gulshan 1 (books ~2 min after Nusrat) |
| **Shirin** | Passenger | Books ~30s later — the last-seat concurrency case |

This cast is used everywhere: seed data, every automated test, and this README.

## Features implemented

- Passenger sign up/in, ride request (pickup, destination, seats), live fare estimate, status tracking, ride history, cancellation
- Driver sign up/in (with their Tesla), online/offline toggle, sees compatible pending requests, accepts them into a pool, marks arrived → started → completed, sees pool members and ride history
- Pooling: multiple compatible requests share one Tesla, capacity is never exceeded (even under concurrent claims), each passenger gets an individually discounted fare
- Full audit trail: every ride and pool state change is recorded in append-only history tables
- Authorization enforced server-side on every protected route (ownership + role, not just role)

## Architecture

```mermaid
flowchart LR
    Browser["Browser"]
    subgraph Docker["docker compose"]
        Frontend["Next.js App Router\n(React, port 3000)"]
        Backend["Node.js + Express API\n(port 4000)"]
        DB[("PostgreSQL\n(port 5433 on host)")]
    end

    Browser -->|HTTP| Frontend
    Frontend -->|"REST + JWT (Bearer token)"| Backend
    Backend --> DB
    Backend -.->|migrations + seed script| DB
```

Kept deliberately simple — no microservices, no queues, no Redis. Three actors, a
handful of state transitions, and one Postgres database with real transactions is
the whole system. The brief explicitly penalizes complexity that doesn't earn its
keep.

Inside the backend, every request flows through the same layering:

```mermaid
flowchart LR
    Route["Route\n(Express Router)"] --> MW["requireAuth / requireRole\n(identity + role)"]
    MW --> Controller["Controller\n(parse + respond)"]
    Controller --> Service["Service\n(business rules, transactions)"]
    Service --> Repo["Repository\n(SQL queries)"]
    Repo --> DB[(PostgreSQL)]
```

Business rules (capacity checks, the matching rule, the state-transition allow-list,
ownership checks) live in the **service** layer, never in route handlers and never
trusted from the frontend.

## Tech stack & why

| Layer | Choice | Why | Alternative considered |
|---|---|---|---|
| Frontend | Next.js (App Router), plain JS, custom CSS | File-based routing for passenger/driver flows; plain CSS keeps dependencies minimal for a 3-day MVP | Tailwind/a UI library — more setup for a project this size |
| Backend | Node.js + Express | Simple, minimal setup overhead, matches the resource model's shallow shape | NestJS — more structure than this scope needs |
| Database | PostgreSQL | Transactional row-locking (`SELECT ... FOR UPDATE`) is the actual mechanism behind both concurrency fixes | SQLite — fine for dev, no real story for concurrent-write correctness |
| Migrations | `node-pg-migrate`, raw SQL | Every constraint (CHECK, partial unique index) stays literal and hand-checkable — no ORM schema DSL to translate through | Prisma/Knex — both still need raw-SQL escape hatches for the partial unique index and `FOR UPDATE` anyway |
| Validation | Zod | Declarative per-route schemas, good error messages, minimal boilerplate | express-validator, hand-written checks |
| Auth | JWT (`{sub, role}`, 8h expiry, no refresh tokens) + bcryptjs | Simplest defensible option for an MVP; bcryptjs (pure JS) avoids native-binding build issues across Docker/Windows | `bcrypt` (native bindings) |
| Testing | Jest + Supertest, real Postgres (no mocks) | Tests exercise real transactions and constraints — the whole point is proving DB-level correctness | Mocking the DB layer — would hide the actual concurrency bugs this project is graded on |
| Deployment | Docker Compose, free-tier friendly | No paid infra per the brief | — |

## Database schema (ERD)

```mermaid
erDiagram
    USERS ||--o{ TESLAS : owns
    USERS ||--o{ RIDE_REQUESTS : requests
    TESLAS ||--o{ POOLS : serves
    POOLS ||--o{ POOL_MEMBERS : contains
    POOLS ||--o{ POOL_STATUS_HISTORY : logs
    RIDE_REQUESTS ||--|| POOL_MEMBERS : "joins via"
    RIDE_REQUESTS ||--|| FARES : has
    RIDE_REQUESTS ||--o{ RIDE_STATUS_HISTORY : logs
    ZONES ||--o{ RIDE_REQUESTS : "pickup/destination"
    CORRIDORS ||--o{ ZONES : groups

    USERS {
        uuid id PK
        string name
        string phone
        string password_hash
        enum role "passenger|driver"
    }
    TESLAS {
        uuid id PK
        uuid driver_id FK
        string label
        int capacity
        enum status "offline|online"
    }
    ZONES {
        uuid id PK
        string name
        uuid corridor_id FK
        decimal lat
        decimal lng
    }
    CORRIDORS {
        uuid id PK
        string name
    }
    RIDE_REQUESTS {
        uuid id PK
        uuid passenger_id FK
        uuid pickup_zone_id FK
        uuid destination_zone_id FK
        int seats_requested
        enum status "requested|matched|driver_arrived|started|completed|cancelled"
        uuid pool_id FK "nullable"
    }
    POOLS {
        uuid id PK
        uuid tesla_id FK
        int seats_occupied
        enum status "forming|active|completed|cancelled"
    }
    POOL_MEMBERS {
        uuid id PK
        uuid pool_id FK
        uuid ride_request_id FK "UNIQUE"
        int seats
    }
    FARES {
        uuid id PK
        uuid ride_request_id FK "UNIQUE"
        int base_fare_paisa
        int distance_charge_paisa
        int pool_discount_paisa
        int total_fare_paisa
    }
    POOL_STATUS_HISTORY {
        uuid id PK
        uuid pool_id FK
        int seats_occupied_before
        int seats_occupied_after
        enum event "member_joined|member_left|status_changed|cancelled"
    }
    RIDE_STATUS_HISTORY {
        uuid id PK
        uuid ride_request_id FK
        enum from_status
        enum to_status
    }
```

Database-level invariants (enforced by constraints, not just app code — see
[`backend/migrations/`](backend/migrations/)):

```sql
-- at most one forming/active pool per Tesla, ever
CREATE UNIQUE INDEX one_active_pool_per_tesla
  ON pools (tesla_id) WHERE status IN ('forming', 'active');

-- a ride request can only ever belong to one pool
ALTER TABLE pool_members ADD CONSTRAINT pool_members_ride_request_id_key UNIQUE (ride_request_id);

-- seats, capacity, and seat requests can never be non-positive/negative
ALTER TABLE pools ADD CONSTRAINT seats_within_capacity CHECK (seats_occupied >= 0);
ALTER TABLE teslas ADD CONSTRAINT positive_capacity CHECK (capacity > 0);
ALTER TABLE ride_requests ADD CONSTRAINT positive_seats_requested CHECK (seats_requested > 0);
```

Full detail: [`docs/architecture.md`](docs/architecture.md) §2.

## How it actually works — core mechanisms

### 1. The fare model

```
passengerFare = baseFare + distanceCharge − poolDiscount
```

- `baseFare` = 3000 paisa, `perKmRate` = 1500 paisa/km, `poolDiscount` = 20%
- All money is stored as **integer paisa** — never float — to avoid rounding drift
- Distance is computed via the haversine formula from each zone's stored `lat`/`lng`
  (rounded to the nearest whole km) — this is arithmetic over static reference data,
  not live routing, so it doesn't conflict with the "no real map APIs" rule
  ([`fare.service.js`](backend/src/services/fare.service.js))

**The estimate-vs-final split** (the one genuinely non-obvious piece of this system):
a pool discount is a real cost-sharing benefit that only exists once a ride is
actually pooled with someone else — it can't be known at request time. So:

1. When a ride request is created, its `fares` row is inserted with
   `pool_discount_paisa = 0` — an honest no-discount estimate.
2. When a **second** passenger joins that pool, **both** members' fares are
   recomputed in the same transaction — the first passenger's fare updates
   retroactively, not just the new joiner's.
3. If a passenger later cancels out of a 2-person pool back down to 1, the
   remaining passenger's fare reverts to the no-discount rate, symmetrically.

Worked example (exactly reproduced by [`fare.service.test.js`](backend/tests/fare.service.test.js) and verified live through the running app):

| Passenger | Route | Distance | Subtotal | Discount (20%) | Total |
|---|---|---|---|---|---|
| Nusrat | Banani → Mohakhali | 4 km | 9000 paisa | 1800 paisa | **7200 paisa (৳72)** |
| Rafiq | Banani → Gulshan 1 | 3 km | 7500 paisa | 1500 paisa | **6000 paisa (৳60)** |

### 2. The matching rule

Two ride requests pool together when they share the **same pickup zone** and their
destinations belong to the **same destination corridor** — a real SQL join over the
`zones`/`corridors` tables, not string matching or geodistance. A pool's first
member sets its "profile"; every later joiner is checked against that profile and
rejected if it doesn't match ([`pool.service.js`](backend/src/services/pool.service.js)).

### 3. The ride lifecycle (state machine)

```mermaid
stateDiagram-v2
    [*] --> requested
    requested --> matched: driver accepts
    requested --> cancelled: passenger cancels
    matched --> driver_arrived: driver arrives
    matched --> cancelled: passenger cancels
    driver_arrived --> started: driver starts
    started --> completed: driver completes
    completed --> [*]
    cancelled --> [*]
```

One authoritative allow-list ([`rideStateMachine.js`](backend/src/services/rideStateMachine.js))
decides every transition — no route ever writes a status directly. Anything not
drawn above is rejected: `STARTED → REQUESTED`, `COMPLETED → CANCELLED`,
`CANCELLED → STARTED`, etc. Every successful transition writes an append-only
`ride_status_history` row in the same transaction as the status change.

The pool itself has a derived lifecycle: `forming` → `active` (the first time any
member is marked `started`) → `completed` (once **every** member reaches a
terminal ride status). Pooled passengers can share a pickup but have different
destinations, so `arrive`/`start`/`complete` are per-ride-request driver actions —
the driver calls the same action once per passenger.

### 4. Concurrency fix #1 — the seat-claim race

**Scenario:** Bullet has 1 seat left. Rafiq and Shirin both try to claim it at
nearly the same instant.

```mermaid
sequenceDiagram
    participant Rafiq
    participant Shirin
    participant DB as Postgres (pools row)

    Note over DB: Bullet capacity 3, seats_occupied 2 (1 left)
    Rafiq->>DB: BEGIN, SELECT pool FOR UPDATE
    DB-->>Rafiq: row locked
    Shirin->>DB: BEGIN, SELECT pool FOR UPDATE
    Note over Shirin,DB: Shirin's query blocks — row already locked
    Rafiq->>Rafiq: 2 + 1 <= 3 ✓ OK
    Rafiq->>DB: UPDATE seats_occupied = 3, INSERT pool_members, COMMIT
    Note over DB: lock released — Shirin now sees seats_occupied = 3
    Shirin->>Shirin: 3 + 1 <= 3? ✗ reject
    Shirin->>DB: ROLLBACK
    DB-->>Rafiq: 200 OK — matched
    DB-->>Shirin: 409 Conflict — not enough seats
```

`SELECT ... FOR UPDATE` locks the pool row for the whole transaction. The losing
request doesn't see stale data — it blocks until the winner commits, then correctly
sees the seat is gone. Proven with real concurrent HTTP requests (`Promise.all`,
not mocked timing) in [`pool.test.js`](backend/tests/pool.test.js), stress-run
5× with no flakiness.

### 5. Concurrency fix #2 — the pool-creation race

**Scenario:** Nusrat's and Rafiq's requests are both compatible with Bullet, and
neither has a pool yet. Both accept calls race to create the first one.

```mermaid
sequenceDiagram
    participant Nusrat as Nusrat's accept
    participant Rafiq as Rafiq's accept
    participant DB as Postgres (pools table)

    Note over DB: no pool exists yet for Bullet
    Nusrat->>DB: SELECT pool FOR UPDATE → none found
    Rafiq->>DB: SELECT pool FOR UPDATE → none found
    Nusrat->>DB: INSERT pool (forming) — wins
    DB-->>Nusrat: COMMIT
    Rafiq->>DB: INSERT pool (forming)
    DB-->>Rafiq: 23505 unique_violation (one_active_pool_per_tesla)
    Rafiq->>Rafiq: ROLLBACK, retry from scratch
    Rafiq->>DB: SELECT pool FOR UPDATE → finds Nusrat's pool
    Rafiq->>DB: joins that pool instead, COMMIT
    Note over DB: exactly one pool ever exists for this Tesla
```

A prior "does a pool already exist?" check is **not** trusted — it has the same
race window as the seat-claim problem. The real protection is the
`one_active_pool_per_tesla` partial unique index: the loser's `INSERT` fails, the
application catches that specific constraint violation and retries against the
pool the winner just created, so the second passenger still gets pooled correctly.
Proven the same way in [`pool.test.js`](backend/tests/pool.test.js).

### 6. Cancellation

- Allowed only while status is `requested` or `matched`. Rejected from
  `driver_arrived` onward — the driver is already present or en route.
- Cancelling a pooled ride atomically removes the `pool_members` row, decrements
  `seats_occupied`, and writes a `pool_status_history` (`member_left`) row — all
  in the same transaction as the ride's status update.
- If the cancellation empties the pool, the pool itself is auto-cancelled (so the
  Tesla isn't permanently blocked from a new pool by the partial unique index).
- If it drops a pool from 2 members to 1, the remaining passenger's fare reverts
  to the no-discount rate — the symmetric case of the retroactive-discount logic.

### 7. Authorization

Enforced server-side on every protected route, never inferred from frontend button
visibility:

- A passenger can view/modify only their own ride (a driver can't view a ride that
  isn't on their own Tesla's pool either — this exact gap was found and fixed in
  `feature/authorization` after an audit pass)
- A passenger can never execute a driver-only operation, and vice versa
  (`requireRole` middleware)
- A driver can only accept requests into, and operate on, their own Tesla
  (ownership checked against `teslas.driver_id`, not just role)

### 8. Service-layer organization

`route → middleware (auth/role) → controller → service (business rules +
transactions) → repository (SQL)`. Each service owns one concern:

| Service | Owns |
|---|---|
| `auth.service.js` | Passenger signup/login |
| `driver.service.js` | Driver signup, status, available requests, active pool, history |
| `ride.service.js` | Ride lifecycle, ownership checks, cancellation |
| `pool.service.js` | Matching, both concurrency fixes, retroactive fare recompute |
| `fare.service.js` | Fare calculation |
| `rideStateMachine.js` | The one authoritative transition allow-list |

## Project structure

```
tesla/
├── docker-compose.yml
├── .env.example
├── docs/
│   ├── architecture.md              # full design detail — read this for depth
│   ├── PRD.md
│   └── Dhaka_Tesla_Pool_Master_Instructions_v2.pdf
├── backend/
│   ├── migrations/                  # 001..008, raw SQL via node-pg-migrate
│   ├── scripts/seed.js              # seeds the story cast + zones
│   ├── src/
│   │   ├── app.js                   # express app, route mounting, error handler
│   │   ├── routes/                  # one file per resource
│   │   ├── controllers/             # parse request, call service, respond
│   │   ├── services/                # business rules + transactions live here
│   │   ├── repositories/            # all SQL queries
│   │   ├── middleware/              # requireAuth, requireRole
│   │   ├── validation/              # Zod schemas
│   │   └── config/jwt.js
│   └── tests/                       # 12 suites, 88 tests, real Postgres
└── frontend/
    ├── app/
    │   ├── login/, passenger/, driver/    # pages (App Router)
    │   └── providers.js                   # auth context (localStorage-backed)
    ├── components/                        # shared UI (cards, badges, states)
    └── lib/                                # api client, auth helpers, money formatting
```

## API reference

All routes are prefixed `/api`. Protected routes require `Authorization: Bearer <token>`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/login` | — | Login (passenger or driver) |
| POST | `/passengers/signup` | — | Passenger signup |
| POST | `/drivers/signup` | — | Driver signup (creates their Tesla too) |
| PATCH | `/drivers/me/status` | driver | Toggle online/offline |
| GET | `/drivers/me/available-requests` | driver | Pending requests compatible with their Tesla |
| GET | `/drivers/me/active-pool` | driver | Current pool + members |
| GET | `/drivers/me/history` | driver | Past completed/cancelled pools |
| GET | `/zones` | — | List zones + corridors (for pickers) |
| POST | `/ride-requests` | passenger | Create a ride request + fare estimate |
| GET | `/ride-requests` | passenger | List my ride requests |
| GET | `/ride-requests/:id` | passenger or owning driver | View one ride request |
| POST | `/ride-requests/:id/cancel` | passenger (owner) | Cancel |
| POST | `/pools/accept` | driver | Match a ride request into my pool |
| POST | `/ride-requests/:id/arrive` | driver (owner) | Mark driver arrived |
| POST | `/ride-requests/:id/start` | driver (owner) | Start the ride |
| POST | `/ride-requests/:id/complete` | driver (owner) | Complete the ride |

## Environment variables

See [`.env.example`](.env.example) — copy it to `.env` before running anything.
No real secrets are committed; only placeholder values.

| Variable | Used by | Purpose |
|---|---|---|
| `POSTGRES_USER/PASSWORD/DB/PORT` | docker-compose, backend | Database connection |
| `DATABASE_URL` | backend | Full Postgres connection string |
| `JWT_SECRET` | backend | Signs/verifies auth tokens |
| `TEST_DATABASE_URL` | backend tests | Isolated DB so tests never touch dev/demo data |
| `NEXT_PUBLIC_API_URL` | frontend | Where the browser sends API requests |

## Getting started

**Prerequisites:** Docker Desktop, Node.js 20+ (only needed for running migrations/seed/tests from the host).

```bash
cp .env.example .env
docker compose up -d --build

# one-time (or after a fresh volume): migrate + seed
cd backend
export DATABASE_URL="postgres://tesla:tesla@localhost:5433/tesla"
npx node-pg-migrate up
node scripts/seed.js
```

Frontend: **http://localhost:3000**. Backend health check: **http://localhost:4000/health**.

To stop: `docker compose down` (keeps data) or `docker compose down -v` (wipes the database).

## Running tests

```bash
cd backend
cp ../.env.example ../.env    # if not already done
docker compose up -d postgres
npm install
npm test
```

12 suites, 88 tests, all against a real Postgres instance (no mocked DB) — including
the two concurrency tests, which issue genuinely concurrent HTTP requests via
`Promise.all`.

## Demo credentials

All seeded users share the password `password123`:

| Phone | Role |
|---|---|
| `+8801700000001` | Jashim (driver, owns Bullet) |
| `+8801700000002` | Nusrat (passenger) |
| `+8801700000003` | Rafiq (passenger) |
| `+8801700000004` | Shirin (passenger) |

## Known limitations & next improvements

- No real payment gateway, maps/routing, ratings, or notifications — deliberately
  out of scope per the brief
- Zone coordinates are illustrative, calibrated to produce round-number demo
  distances, not surveyed real-world positions ([`docs/architecture.md`](docs/architecture.md) §8)
- Jest runs with `maxWorkers: 1` — test suites share one physical test database,
  so parallel workers caused real cross-suite truncation races; correctness was
  prioritized over test speed
- At real scale, both concurrency fixes (row locking, retry-on-conflict) become
  contention points on popular Teslas/corridors. Documented next step: optimistic
  concurrency (a `version` column, retry-on-conflict) or a per-Tesla reservation
  queue instead of serializing every join behind one row lock

## AI usage

Claude Code was used throughout this build — for scaffolding, implementing every
feature branch, writing tests, and catching bugs via actual browser testing (not
just code review). Full detail, including specific accepted/rejected suggestions:
[`docs/ai-usage-notes.md`](docs/ai-usage-notes.md).

## Git workflow

`master` (integration) ← `feature/*` branches, never pushed to directly. See
[`docs/ai-usage-notes.md`](docs/ai-usage-notes.md) and `git log --oneline` for the
real incremental history — every feature has its own branch, merged only once it
had passing tests and was verified end-to-end through the running app.
