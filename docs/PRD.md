# Dhaka Tesla Pool — Project Brief

Internship take-home challenge (RoBenDevs). Deadline: September 27.

## Note on source of truth

This repo does not have a separate original PRD document — the assignment was provided as
`docs/Dhaka_Tesla_Pool_Master_Instructions_v2.pdf`, which explicitly states that it merges and
supersedes the original 14-page brief with a follow-up implementation directive. That PDF is
the authoritative spec for every requirement in this project. `docs/architecture.md` is kept in
sync with it for schema, fare model, concurrency, state machine, and cancellation design.

This file exists only to give a short, human-readable summary of the problem and story context
for anyone opening the repo before diving into the PDF.

## The problem

A ride-pooling MVP set in Dhaka with three actors:

- **Passenger** — requests a ride (pickup zone, destination zone, seat count), sees an
  estimated fare, tracks ride status, views history, cancels while the ride is still cancellable.
- **Driver** — runs a fixed-capacity vehicle (a "Tesla"), goes online/offline, accepts ride
  requests, marks arrival/start/completion, sees which passengers are pooled into their ride.
- **Ride/Pool** — multiple compatible ride requests may share one Tesla; occupied seats can
  never exceed capacity; each pooled passenger gets their own individually-calculated fare.

Evaluation covers correctness (data integrity, concurrency safety, authorization), git process
discipline, and the ability to explain every decision live.

## The story cast

| Name | Role | Detail |
|---|---|---|
| Jashim | Driver | Owns the Tesla |
| Bullet | Vehicle | 3-seat capacity, battery-powered |
| Nusrat | Passenger | Banani → Mohakhali |
| Rafiq | Passenger | Banani → Gulshan 1 (books ~2 min after Nusrat) |
| Shirin | Passenger | Books ~30s later — the last-seat concurrency case |

This cast is used everywhere: seed data, tests, README examples, demo screenshots, and the
video. Never replaced with generic placeholders (`user1`, `driver1`, etc.).

## Ride lifecycle

```
REQUESTED -> MATCHED/ACCEPTED -> DRIVER_ARRIVED -> STARTED -> COMPLETED (+ CANCELLED)
```

## Scope boundary

No microservices, Kafka, Kubernetes, Redis, message queues, real map/routing integration, real
payment gateway, ratings, live GPS, chat, or surge pricing — see
`docs/Dhaka_Tesla_Pool_Master_Instructions_v2.pdf` §23 for the full "do not add" list. The goal
is the smallest system that is fully correct, explainable, testable, auditable,
concurrency-safe, authorized, and reproducible — not the most impressive-looking architecture.

For full requirement detail (database design, fare model, concurrency fixes, state machine,
cancellation rules, authorization, git workflow, testing requirements, README/video structure,
and the definition of done), see `docs/Dhaka_Tesla_Pool_Master_Instructions_v2.pdf` directly.
