# AI Usage Notes

Per CLAUDE.md §7 / PDF §21: AI use is disclosed here in full, not hidden. Claude
Code (Claude, Anthropic) was used for essentially the entire build — architecture
decisions were made collaboratively, but every decision below was reviewed,
tested, and is explainable by the human author.

## What it was used for

- Reading and reconciling the three source documents (CLAUDE.md, the master PDF,
  architecture.md) before writing any code, and flagging where they needed
  reconciliation
- Scaffolding the repo, Docker setup, and folder structure
- Implementing every feature branch (schema, auth, ride requests, pooling,
  concurrency fixes, driver flow, cancellation, authorization, frontend)
- Writing the test suite (103 tests across 15 suites), including the concurrency
  tests that issue genuinely concurrent HTTP requests
- Driving the actual running app through a real headless browser (Playwright) to
  verify UI flows, not just reviewing the code
- Writing this documentation
- A full security/logic/bug audit of the finished codebase, on request — see
  "The security and logic audit" below

## One suggestion accepted as-is

**The concurrency design**: `SELECT ... FOR UPDATE` row locking for the seat-claim
race, combined with catch-and-retry on the `one_active_pool_per_tesla` unique
constraint for the pool-creation race. This is exactly the mechanism
`docs/architecture.md` §4 called for. It was implemented in one pass, stress-tested
5× with real concurrent `Promise.all` HTTP requests against a live Postgres
instance, and never needed correction — first-try-correct on the hardest
requirement in the project.

## One suggestion rejected/changed, and why

**Git commit/PR attribution.** Claude Code's default behavior is to add
`Co-Authored-By: Claude` lines to commits and PR descriptions. The user explicitly
rejected this early in the build ("make sure u do not add claude as a contributor
to git"), and it was removed for every commit going forward. This is disclosed
here instead — the commit history itself will not show AI co-authorship, but this
document and the README are explicit that Claude Code was used throughout.

## Bugs the AI introduced and caught itself

Being transparent about this matters more than pretending everything was correct
on the first pass:

1. **A weak test that didn't test what it claimed.** An early "atomic rollback"
   test for driver signup passed a Tesla capacity of `0` through the HTTP API,
   expecting the transaction to roll back at the database's `positive_capacity`
   CHECK constraint. In reality, Zod validation rejected the request before the
   transaction ever started, so the test was passing for the wrong reason. Caught
   during review of the test's own logic, before it was ever committed, and
   rewritten to call the service function directly (bypassing Zod) so the real
   database constraint is what triggers the rollback.

2. **Dead code left in a transaction handler.** `ride.service.js`'s pool-completion
   logic briefly included an unused `allTerminalExceptThisOne` variable — a
   leftover from an earlier draft of the completion-check logic that was never
   actually used. Caught during a self-review before committing, removed.

3. **A real stale-closure bug in the passenger dashboard**, caught only by
   actually running the app in a browser rather than by reading the code. The
   `loadData` callback's dependency array only included `session`, so its closure
   captured `pickupZoneId`'s *initial* empty-string value forever — meaning every
   reload (e.g., right after submitting a ride request) silently reset both zone
   dropdowns back to the first zone in the list. This is exactly the class of bug
   that code review alone tends to miss, because the code reads correctly in
   isolation; it only breaks against React's actual re-render behavior. Fixed
   with a `useRef` guard instead of relying on state in the memoized callback, and
   re-verified via a scripted Playwright run that the destination selection now
   survives a full request→reload cycle.

## Non-trivial design decisions flagged during the build

These were called out explicitly to the user as they came up (per CLAUDE.md §7),
not silently folded in:

- **No `docs/PRD.md` existed** at project start — only the master PDF. Created a
  short PRD summarizing the brief and explicitly pointing to the PDF as the
  authoritative source, rather than treating its absence as something to guess
  past.
- **Plain JavaScript over TypeScript**, both backend and frontend — justified by
  the PDF's own reasoning for picking Express ("simple, minimal setup overhead")
  under a multi-day deadline.
- **Raw SQL migrations (`node-pg-migrate`) over an ORM** — every CHECK constraint
  and the partial unique index stay literal and hand-checkable rather than
  translated through a schema DSL.
- **`bcryptjs` over native `bcrypt`** — avoids native-binding build issues across
  Docker and Windows, at the cost of being slightly slower (irrelevant at this
  scale).
- **Driver signup creates their Tesla in the same transactional call**, rather
  than a separate step — the roadmap has no dedicated "register a Tesla" branch,
  and the story treats driver+Tesla as inseparable.
- **Fare is computed in two phases**: a no-discount estimate at ride-request time,
  then a retroactive recompute of *every* current pool member's fare (not just
  the new joiner's) once a pool crosses from 1 to 2 members — and symmetrically
  reverted if a cancellation drops it back to 1. Neither direction is stated
  explicitly in the brief; both were derived from the worked example (both Nusrat
  and Rafiq are discounted once pooled) and documented in `architecture.md` before
  being implemented.
- **Distance is haversine over stored zone `lat`/`lng`, with coordinates
  deliberately calibrated** so the required routes round to exactly 4km and 3km —
  chosen over a fixed zone-pair distance lookup table because it needed no schema
  change and keeps distance a real (if illustrative) computation rather than a
  hardcoded number.
- **A driver must be online to accept a match**, and **matching-rule compatibility
  is enforced at join time** (a pool's first member sets its zone/corridor
  profile; incompatible joiners are rejected) — both are real invariants enforced
  in code, not just described in prose.
- **An emptied pool auto-cancels** after the last member leaves via cancellation,
  so the Tesla isn't permanently blocked from a new pool by the
  `one_active_pool_per_tesla` constraint.
- **Per-ride-request driver actions** (`arrive`/`start`/`complete`) rather than one
  bulk pool-wide action — pooled passengers can share a pickup but have different
  destinations, so the schema's per-ride-request timestamps are honored directly.
- **A real authorization gap was found and fixed** during the dedicated
  `feature/authorization` audit pass: `GET /api/ride-requests/:id` originally let
  any authenticated driver view any ride request system-wide, not just ones on
  their own Tesla's pool. This had been explicitly left as a TODO comment in an
  earlier branch; the audit branch's purpose was exactly to catch and close gaps
  like this one, and it did.

## The security and logic audit

After the build was otherwise feature-complete, the user asked for a full,
unprompted scan of the entire project for security issues, logical bugs, and
typos — not a re-review of things already known, a genuinely open-ended look.
That audit found 14 real issues, none of which had been caught by the existing
103 tests at the time (tests prove the code does what it was written to do; several of
these were cases where what it was written to do was itself wrong or
incomplete). All 14 were fixed on `feature/hardening`, each with a regression
test, verified against a real running stack — not just asserted fixed:

**Would have broken the upcoming deployment:**
- `NEXT_PUBLIC_API_URL` was only ever set via `docker-compose`'s runtime
  `environment:`, but Next.js inlines `NEXT_PUBLIC_*` variables into the
  client bundle at **build** time. Proven empirically (not just from
  documentation) by setting a distinctive test value, rebuilding, and
  confirming the old value was still baked into the compiled output. Fixed by
  passing it as a Docker build `arg` instead.

**Security:**
- Login's "same error for wrong-password and no-such-user" anti-enumeration
  design was undermined by a timing side-channel — the no-such-user path
  returned instantly while the wrong-password path took as long as bcrypt
  does, making the two distinguishable by response time despite the identical
  error message. Fixed by always running `bcrypt.compare` against a dummy
  hash.
- Two concurrent signups with the same phone number had no protection beyond
  a check-then-insert race — the loser's raw Postgres error (internal
  constraint names, query structure) would reach the client verbatim via a
  generic 500 handler. Both the missing concurrency handling and the
  error-handler's info leakage were real gaps, fixed together.
- No rate limiting on login/signup — added, explicitly disabled in the test
  environment so the existing suite's legitimate rapid-fire requests aren't
  throttled.
- JWT verification didn't explicitly restrict accepted algorithms — pinned to
  HS256 as defense in depth, with a test proving a token forged with a
  different algorithm is rejected.
- CORS was wide open (`cors()` with no origin restriction) — made
  configurable via `CORS_ORIGIN`, defaulting to permissive for local dev.

**Logic bugs:**
- Phone number validation was `min(6).max(20)` on an unconstrained string —
  `"abcdef"` passed as a valid "phone number." This was the user's own
  example when asking for the audit, and it was real. Fixed with a proper
  regex plus normalization (so `"+880 170-0000002"` and `"+8801700000002"`
  resolve to the same account).
- `POST /api/pools/accept` returned a ride request with `matchedAt` always
  `null` — the database correctly set it, but the API response was
  reconstructed from the pre-update row rather than using the database's own
  returned row. A subsequent `GET` would show it correctly; only the
  immediate accept response was wrong.
- No upper bound on seats requested or Tesla capacity, and no check that a
  ride's pickup and destination weren't the same zone — all three now
  validated.
- `zones.lat`/`lng` were nullable with no enforcement; a null would silently
  coerce to `0` and compute fare distance from the equator instead of
  failing — now `NOT NULL` at the database level (new migration).

**Minor:**
- `driver.service.js` imported the Postgres connection pool as `pool` in a
  file otherwise entirely about ride-pools (`poolRepository`, `poolRow`,
  etc.) — renamed to `dbPool` for clarity.
- Dockerfiles used `npm install` (non-deterministic) and ran as root; switched
  to `npm ci` and an explicit unprivileged user.
- The frontend's API client had no request timeout — a hung backend left the
  loading spinner running forever.

This is disclosed in this much detail deliberately: the point of an AI usage
section is showing engineering judgment was actually exercised, and a list of
real bugs found and fixed — with the reasoning for each — demonstrates that
more honestly than a claim that nothing was wrong.

## What was verified, not just written

Every feature branch's backend logic was proven against a real Postgres instance
(not mocks), and every frontend flow was driven through a real headless Chromium
browser via Playwright before being considered done — including full passenger
and driver journeys, and the exact worked-example fares (৳72.00 / ৳60.00)
rendering correctly in the live UI, not just in unit tests.
