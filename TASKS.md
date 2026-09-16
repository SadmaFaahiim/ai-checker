# AI-Checker — Phase 1 Task Board (Hardening)

> Working checklist for **Phase 1 — Hardening (weeks 1–4)** from [ROADMAP.md](./ROADMAP.md).
> Theme: **make what exists trustworthy** — without changing any existing behavior.
> Task IDs are referenced from the roadmap. Mark tasks `[x]` as they complete.

---

## Legend

- **Owner** maps to the role matrix in ROADMAP §2 (one named person per role at execution time).
- **Priority:** P0 = blocks CI gate · P1 = must land in Phase 1 · P2 = stretch.
- **AC** = acceptance criteria (the definition of done, reviewable in PR).

---

## EPIC-1 · Test Suite (QA/Testing + Tech Lead)

| ID | Task | Owner | Pri | Acceptance Criteria |
|---|---|---|---|---|
| T1 | Add Vitest + test script (`npm test`, `npm run test:watch`) | Tech Lead | P0 | `npm test` runs green locally; no source file modified except `package.json` scripts |
| T2 | Unit tests — `lib/scoring.ts` | QA | P0 | Boundary coverage: 0, 34, 34.9, 35, 65, 65.1, 66, 100; all three verdicts asserted |
| T3 | Unit tests — `lib/fallback.ts` | QA | P0 | First-provider success short-circuits (later providers never called); each failure type falls through in order (429, 401, 5xx, timeout, malformed); all-fail aggregates every reason into the thrown error; timeout path does not hang the suite |
| T4 | Adapter tests — text/image/audio providers | QA | P1 | Happy path → correct `aiProbability` normalization; 429/401/5xx/timeout/invalid-shape → throws `ProviderUnavailableError` with reason; zero real network calls (axios mocked) |
| T5 | Route integration tests — `/api/check/*` | QA | P1 | 400 paths (validation), 200 happy path shape `{ percentage, verdict, provider }`, 503 when all providers fail; providers mocked |
| T6 | Coverage config + threshold (≥60% on `lib/`) | Tech Lead | P2 | `vitest run --coverage` enforces the roadmap KPI |

**Status:** T1–T4 landed in this PR; T5–T6 open.

---

## EPIC-2 · CI Pipeline (DevOps/SRE)

| ID | Task | Owner | Pri | Acceptance Criteria |
|---|---|---|---|---|
| C1 | GitHub Actions workflow: lint → typecheck → test → build | DevOps | P0 | Workflow file committed; runs on every PR + push to `main`; all four gates pass on the Phase 1 codebase |
| C2 | CI badge in README | DevOps | P2 | Badge renders after first successful run |

**Status:** C1 landed in this PR (`.github/workflows/ci.yml` — lint → typecheck → test → build on PRs and pushes to `main`). C2 open.

---

## EPIC-3 · Rate Limiting (Backend + Cybersecurity)

| ID | Task | Owner | Pri | Acceptance Criteria |
|---|---|---|---|---|
| R1 | IP-based rate limiter middleware for `/api/check/*` | Backend | P1 | Configurable window + max requests per modality; `429` with `Retry-After`; keyed by `x-forwarded-for` first value |
| R2 | Per-modality caps (video stricter than text) | Backend | P1 | Video route caps lower than text; caps live in one config module |
| R3 | Magic-byte file validation server-side | Cybersecurity | P1 | Uploads rejected when declared MIME ≠ actual bytes; covers JPG/PNG/audio/MP4 |

**Status:** R1 + R2 landed in this PR (`lib/rateLimit.ts` — in-memory sliding window, per-modality caps text 20/min · image 10/min · audio 6/min · video 4/min, `429` + `Retry-After`, wired into all four check routes ahead of body parsing). R3 open.

---

## EPIC-4 · Observability (DevOps/SRE + Tech Support)

| ID | Task | Owner | Pri | Acceptance Criteria |
|---|---|---|---|---|
| O1 | Health endpoint `GET /api/health` | Backend | P0 | Returns `{ status, providers: { sapling: boolean, sightengine: boolean, … } }` reporting which provider keys are configured; 200 even when keys are missing (status reflects degradation) |
| O2 | Sentry (or equivalent) error tracking | DevOps | P1 | Server-side capture on all routes; source maps uploaded; DSN via env |
| O3 | Uptime monitoring on `/api/health` | Tech Support | P2 | External checker configured; alert channel chosen |

**Status:** O1 landed in this PR (`lib/health.ts` + `app/api/health/route.ts`). O2, O3 open.

---

## EPIC-5 · Docs & Baseline (PO/BA + Docs owner)

| ID | Task | Owner | Pri | Acceptance Criteria |
|---|---|---|---|---|
| D1 | ROADMAP.md committed (Phase 0 baseline freeze) | PO/BA | P0 | Roadmap present at repo root; roles/tracks/phases match §2–§4 |
| D2 | README: document the Audio modality (close the drift flagged in ROADMAP §0) | Docs owner | P1 | README features + endpoints + provider tables include audio; setup guide updated if needed |
| D3 | README: test commands (`npm test`) documented | Docs owner | P1 | Build & Production section includes test commands |
| D4 | Benchmark corpus spec defined | PO/BA + Interns | P2 | Corpus source, size, labeling rules, and per-provider metric definitions written down |

**Status:** D1, D2, D3 landed in this PR (Audio now documented in README — features, endpoints, provider table, usage guide, project structure); D4 open.

---

## Definition of Done — Phase 1 exit gate

- [ ] `npm test` green; coverage ≥ 60% on `lib/` (KPI from ROADMAP §5) — suite green (45 tests), coverage tooling still open (T6)
- [x] CI green gate on all PRs (lint → typecheck → test → build) — workflow committed
- [x] Rate limiting active on all `/api/check/*` routes with 429 + `Retry-After`
- [x] `/api/health` live and monitored — endpoint live; external monitor still open (O3)
- [ ] Error tracking capturing server exceptions
- [ ] Magic-byte validation on all upload routes
- [x] README documents all four modalities incl. Audio
- [ ] Benchmark corpus spec approved by PO/BA

---

*Board owner: Tech Lead · Update at each standup · Links: [ROADMAP.md](./ROADMAP.md) · Phase target: weeks 1–4*
