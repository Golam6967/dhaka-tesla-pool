# Project Instructions — Dhaka Tesla Pool

This file is the standing instruction set for this repo. Read it in full before doing any
work, and re-check it before starting a new feature branch, writing tests, or touching git
history. When something here conflicts with a quick shortcut that seems faster, follow this
file — the process is explicitly part of what's being evaluated, not just the final app.

Reference docs in this repo:
- `docs/PRD.md` — the original assignment brief (source of truth for requirements)
- `docs/architecture.md` — architecture, ERD, fare model, concurrency design (source of truth
  for how the system is built — implementation must match this or the docs must be updated)

Deadline: **Sept 27**. Work incrementally and keep something runnable at all times — do not
leave the repo in a broken state between sessions.

---

## 1. The story cast — never break this

Every piece of seed data, every test, every demo screenshot, every example in the README must
use this cast, consistently:

- **Jashim** — driver
- **Bullet** — Jashim's Tesla, 3-seat capacity
- **Nusrat** — passenger, Banani → Mohakhali
- **Rafiq** — passenger, Banani → Gulshan 1
- **Shirin** — passenger, the "grabs the last seat" edge case

Never use `user1`, `driver1`, `testuser`, `foo`, or other generic placeholders anywhere —
not in seed scripts, not in test fixtures, not in throwaway manual testing. If a new
passenger/driver is genuinely needed for a specific test scenario, name them in keeping with
the setting and document why.

## 2. Core scope — build this, nothing more

Three actors: **Passenger**, **Driver/Tesla**, **Ride/Pool**. Implement exactly what's in
`docs/PRD.md` Section 3 and `docs/architecture.md`. Do not introduce microservices, Kafka,
Kubernetes, Redis, or message queues — the brief explicitly penalizes unjustified complexity.
Do not solve real-world routing or integrate a real maps API — use the zones/corridors model
from the architecture doc.

Lifecycle (must match exactly, all transitions logged to `ride_status_history`):
```
REQUESTED → MATCHED/ACCEPTED → DRIVER_ARRIVED → STARTED → COMPLETED (+ CANCELLED)
```

Fare formula (must match `docs/architecture.md` exactly, integer paisa, no floats):
```
passengerFare = baseFare + distanceCharge − poolDiscount
```

## 3. Mandated stack

| Layer | Requirement |
|---|---|
| Frontend | React or Next.js (App Router recommended) |
| Backend | Node.js — Express, Fastify, or NestJS (justify the pick in README) |
| Database | Postgres (per `docs/architecture.md` — relational, transactional) |
| Other | ORM, validation, auth, test framework, hosting — candidate's choice, justify each in README |

For every non-mandated choice: document in the README what was picked, what the realistic
alternatives were, why it fits *this* MVP specifically, and what would trigger switching later.
Don't add a trendy tool without being able to defend it live.

## 4. Git workflow — follow exactly

Branches:
- `master` — long-lived, integration point for finished features
- `pre-release` — cut once MVP features are integrated, used for integration fixes/docs/deploy checks
- `release/v1.0.0` — cut from `pre-release`, this is the version shown in the final video
- `feature/*` — one branch per logical feature (e.g. `feature/passenger-auth`,
  `feature/tesla-pooling`, `feature/driver-flow`, `feature/db-schema`, `feature/fare-calc`)

Flow per feature:
1. Branch off `master` (or the current integration branch) as `feature/<name>`
2. Commit incrementally as the feature is actually built — never one giant commit dumping a
   finished feature
3. Merge into `master` once it works and has tests
4. When all MVP features are integrated: cut `pre-release`, do integration/doc/deploy fixes there
5. Cut `release/v1.0.0` from `pre-release`

**Never push feature work directly to `master`.** Never submit a single "initial commit"
containing the finished system — history must show a real build-up.

### Commit message format
```
<type>(<scope>): <short description>
```
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`

Good examples:
```
feat(auth): add passenger login endpoint
feat(pool): enforce Bullet's seat capacity
fix(pool): prevent overbooking available seats
build(docker): add compose setup for api and postgres
```

Rules:
- One commit = one understandable logical change
- Never use "update", "changes", "fix", "final", "latest", "working now", "asdf", etc.
- Don't split work into 50 meaningless micro-commits just to satisfy this rule either —
  useful history, not git theatre

Before ending a work session: check `git log --oneline` and `git status` reflect real,
explainable progress — not a mess that needs squashing to look presentable.

## 5. Database & concurrency

Implement exactly the schema in `docs/architecture.md` §2, including:
- `zones` / `corridors` lookup tables (not free-text zone matching)
- `pool_members.ride_request_id` unique constraint
- Partial unique index: at most one `forming`/`active` pool per Tesla
- Separate `ride_status_history` and `pool_status_history` (both append-only)
- All money fields as integer paisa columns — never float/decimal

Concurrency: implement the last-seat race condition fix using `SELECT ... FOR UPDATE` inside a
transaction, exactly as documented in `docs/architecture.md` §4. This must have a test proving
it (two near-simultaneous claims on a 1-seat-remaining pool, only one succeeds).

If any implementation detail diverges from `docs/architecture.md`, update that doc in the same
commit/PR — the docs and the code must stay in sync.

## 6. Testing — meaningful, not coverage-chasing

Must have real tests (not just happy-path) covering:
- Bullet's capacity can never be exceeded, including under concurrent requests
- Invalid state transitions are rejected (e.g. can't go STARTED → REQUESTED)
- Nusrat's and Rafiq's pooled fares calculate correctly (hand-checkable against
  `docs/architecture.md` §3's worked example)
- A user cannot view or modify another user's ride
- Cancellation rules hold (e.g. rejected after `started_at` is set)
- Two concurrent requests for the last seat can't corrupt pool capacity

## 7. AI usage — use it, but own everything

AI tools (Claude Code included) are explicitly allowed and expected. But:
- Never generate code you (the human) can't explain, debug, or modify live afterward
- Track in `docs/ai-usage-notes.md` (or directly drafted into the README's AI Usage section):
  which tools were used, for what, one suggestion that was accepted as-is, one suggestion that
  was rejected or changed and why
- Do not hide AI use — the brief scores engineering understanding, not "least AI used"

When Claude Code proposes a non-trivial design choice (schema change, library choice, an
approach to the concurrency problem, etc.), it should flag it clearly in its response so it can
be logged for the AI Usage section rather than silently folded in.

## 8. What NOT to do (hard rules)

- No paid infrastructure or services — free tier only
- Never commit API keys, passwords, tokens, or real `.env` values — only `.env.example` with
  placeholder values
- No single giant "initial commit" containing the finished system
- No pushing feature work directly to `master`
- No technology added just to make the architecture diagram look impressive
- No polishing UI/animations while core data integrity (capacity, fares, auth) is unfinished
  or broken
- Don't strip the story cast out of seed data/tests/README in favor of generic placeholders

## 9. Definition of done for each feature branch

Before merging a `feature/*` branch into `master`:
- [ ] Code matches `docs/architecture.md` (or the doc was updated to match a justified change)
- [ ] Uses the story cast consistently in any new seed data / fixtures
- [ ] Has tests for the behavior that's actually risky (not just a smoke test)
- [ ] Commits follow the `<type>(<scope>): <description>` format, incrementally
- [ ] No secrets committed; `.env.example` updated if new env vars were introduced
- [ ] Still runs via `docker compose up` after the change

## 10. Deliverables checklist (final state before submission)

- [ ] Public/evaluator-accessible repo, working MVP (frontend + backend + database)
- [ ] Docker setup, `.env.example`, no secrets committed
- [ ] Migrations + seed data using the story cast
- [ ] `docs/architecture.md` (diagram + ERD) kept in sync with implementation
- [ ] `master` / `pre-release` / `release/v1.0.0` branches with real incremental history
- [ ] Meaningful tests (see §6) + self-explanatory README
- [ ] Deployment link (free tier) if available, or documented reproducible Docker deploy
- [ ] 6-minute video linked in README (structure per `docs/PRD.md` §13)
- [ ] README AI Usage section (see §7)
- [ ] Bonus: viral-scale reasoning (§12 of PRD) if time allows — reasoning over box-counting

---

When in doubt about an unspecified requirement: make a reasonable assumption, document it
inline (code comment or README "Assumptions" section), implement it consistently, and be
ready to explain the reasoning — don't silently guess and move on without a trace.
