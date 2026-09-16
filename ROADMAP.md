# AI-Checker — Product & Engineering Roadmap

> Role-wise roadmap for the AI-Checker project, mapped to the organization hierarchy (CEO → CTO → … → Interns + 10 parallel specialist teams). Phased from the current POC to a production-grade product.
>
> **Ground rule: nothing in the existing v0.1 codebase is removed or redesigned.** Every phase builds *on top of* the locked baseline below.

---

## Table of Contents

- [0. Baseline — What Exists Today (v0.1, Locked)](#0-baseline--what-exists-today-v01-locked)
- [1. Vision & Principles](#1-vision--principles)
- [2. Role-wise Ownership Matrix](#2-role-wise-ownership-matrix)
- [3. Parallel Specialist Team Tracks](#3-parallel-specialist-team-tracks)
- [4. Phased Timeline](#4-phased-timeline)
- [5. KPIs per Phase](#5-kpis-per-phase)
- [6. Risk Register](#6-risk-register)
- [7. Immediate Next Actions](#7-immediate-next-actions)

---

## 0. Baseline — What Exists Today (v0.1, Locked)

The following is the current state of the repository. These features are **frozen as the v0.1 baseline**: all later phases are strictly additive, and no phase may break or remove them.

### Capabilities

| Modality | Status | Implementation |
|---|---|---|
| **Text** | Live | `/api/check/text` → Sapling → GPTZero → ZeroGPT fallback chain |
| **Image** | Live | `/api/check/image` → Sightengine → AI or Not fallback chain (JPG/PNG ≤ 10MB) |
| **Audio** | Live | `/api/check/audio` → Sightengine audio → AI or Not fallback chain (MP3/WAV/M4A/OGG/FLAC/WEBM ≤ 20MB) |
| **Video** | Live | `/api/check/video` → FFmpeg samples up to 8 frames → each frame through the image chain → averaged score + per-frame timeline chart (MP4 ≤ 20MB) |

> ⚠️ **Documentation gap:** Audio is fully implemented in code (`components/AudioCheckPanel.tsx`, `app/api/check/audio/route.ts`, `lib/providers/audio/*`) but is **not documented in README.md**. Closing this gap is a Phase 1 task.

### Core engineering assets (keep intact)

| Asset | File | Role |
|---|---|---|
| Provider fallback orchestrator | `lib/fallback.ts` | `detectWithFallback()` — ordered provider chain, 8s per-provider timeout, silent failover, aggregates errors into a single throw |
| Shared provider contract | `lib/providers/types.ts` | `Provider`, `DetectionResult` (`aiProbability` 0–1), `ProviderInput` union, `ProviderUnavailableError` |
| Score normalization | `lib/scoring.ts` | `toVerdict()` buckets: 0–34 → Likely Human · 35–65 → Uncertain · 66–100 → Likely AI-generated |
| Video frame extraction | `lib/videoFrames.ts` | FFmpeg via `fluent-ffmpeg` + bundled binary; evenly-spaced JPEG frames |
| Providers | `lib/providers/{text,image,audio}/*` | Sapling, GPTZero, ZeroGPT, Sightengine (image + audio), AI or Not (stub) |
| UI shell | `app/page.tsx`, `components/*` | 4-tab switcher, dark/light theme with system detection + persistence, Framer Motion animations, client-side file validation, toasts, Recharts frame timeline |
| Result shape | All routes | Unified `{ percentage, verdict, provider }` (+ `perFrame` for video) |

### Known gaps (driving the roadmap)

- Zero automated tests (no unit, integration, or E2E)
- No CI/CD pipeline
- No rate limiting, auth, or persistence
- No error/uptime monitoring
- No API versioning or public API surface
- Documentation drift (audio modality missing from README)

---

## 1. Vision & Principles

### Vision

Evolve AI-Checker from a provider-proxied POC into a trusted, multi-modal AI-content detection product: first a hardened free tool, then an account-based product with history and quotas, then a public API/platform.

### Phased product stages

1. **POC (done)** — proves the provider-fallback architecture across four modalities.
2. **Hardened public beta** — reliable, monitored, rate-limited, tested.
3. **Account product** — auth, saved history, API keys, quotas.
4. **Platform** — public API v1, webhooks, ensemble scoring, enterprise features.

### Non-negotiable principles

- **Provider-agnostic core.** The `Provider` contract in `lib/providers/types.ts` is the seams-and-bolts of the product; vendors are pluggable and replaceable. Never couple product features to one vendor.
- **"Signal, not proof."** The probabilistic disclaimer stays on every result surface, permanently. Detection is inherently probabilistic; we never sell certainty.
- **Graceful degradation.** Provider failure is an expected path, not an exception. The UI must always degrade to a useful state.
- **Privacy-first.** No content retention without explicit user consent and a clear retention policy; user uploads are never used for training or resale.
- **Additive evolution.** New phases wrap the existing baseline; the fallback architecture and result shape are the stable contract.

---

## 2. Role-wise Ownership Matrix

How the organization hierarchy maps onto concrete AI-Checker responsibilities and deliverables.

| Role | Responsibility on AI-Checker | Concrete deliverables |
|---|---|---|
| **CEO / Founder** | Vision, positioning, monetization, external partnerships | Pricing model, launch strategy, compliance stance, provider partnerships |
| **CTO / Head of Engineering** | Architecture governance, build-vs-buy calls | Self-hosted detection models vs third-party decision; serverless vs long-running infra; security posture; tech-radar ownership |
| **Engineering Manager / Product Director** | Delivery planning and cadence | Epics, milestones, release trains, team capacity planning |
| **Project Manager** | Cross-track coordination | Dependency tracking across the 10 specialist tracks, status reporting, unblocking |
| **Product Manager** | Feature roadmap | History dashboard, batch checking, browser extension, public API product spec |
| **Product Owner / Business Analyst** | Backlog quality and acceptance | User stories with acceptance criteria, provider research briefs, benchmark corpus definition |
| **Solution Architect / Software Architect** | Technical roadmap | Queue-backed video pipeline design, caching layer, DB schema, multi-tenancy model, API versioning strategy |
| **Tech Lead** | Quality gates and standards | Testing strategy, CI/CD standards, code review checklist, refactor priorities |
| **Senior Engineers** | Hardest technical problems | Provider adapter SDK, response caching, webhooks, ensemble scoring, migration of the video pipeline to queues |
| **Mid-Level Engineers** | Feature delivery | Auth integration, history persistence, rate limiting implementation, dashboard CRUD |
| **Junior Engineers** | UI polish and small features | Loading/error/empty states, responsive fixes, accessibility fixes, docs pages |
| **Interns** | Support and tooling work | Test-data corpus collection, provider benchmark scripts, changelog upkeep, doc maintenance |

**Escalation path:** Interns → Mid → Senior → Tech Lead → Architect → PO/PM → EM → CTO → CEO. Provider outage or accuracy disputes go Architect → CTO; monetization and compliance go PM → CEO.

---

## 3. Parallel Specialist Team Tracks

Each track owns a goal and maps its work onto the phases in §4.

| Team | Track goal | Phase mapping |
|---|---|---|
| **UI/UX** | Coherent design system, trustworthy result-explanation UX, WCAG 2.1 AA accessibility | Design tokens from `globals.css` → Phase 1; result-explanation & history UX → Phase 2; accessibility audit → Phase 2 |
| **Frontend** | Dashboard, PWA (installable, offline shell), **Bangla i18n** | Dashboard → Phase 2; PWA → Phase 4; i18n (Bangla first-class) → Phase 4 |
| **Backend** | Versioned public API (`/api/v1`), rate limiting, job queue, webhooks | Rate limiting + health endpoint → Phase 1; versioning → Phase 2; queue + webhooks → Phase 3 |
| **Mobile** | PWA-first mobile experience; native app later if demand justifies | Responsive audit → Phase 1; PWA → Phase 4; React Native evaluation → Phase 4 gate |
| **Database/Data** | Postgres schema for users/checks/history, analytics aggregates, retention policy | Schema design → Phase 2; analytics & retention automation → Phase 3 |
| **QA/Testing** | Unit → integration → E2E coverage; load testing of the video route | Vitest unit tests on `lib/` → Phase 1; route integration tests → Phase 1; Playwright E2E + video load test → Phase 2; regression suite gates CI from Phase 1 onward |
| **DevOps / Cloud / SRE** | CI pipeline, containerized deploys, error tracking, uptime monitoring | GitHub Actions CI → Phase 1; Docker + deploy target (long-running host for the FFmpeg video route) → Phase 2; Sentry + uptime checks → Phase 1 |
| **Cybersecurity** | Abuse prevention, file sanitization, secrets hygiene, GDPR posture | Rate limiting + file-type sniffing (magic bytes, not just MIME) → Phase 1; secrets via platform vault → Phase 2; GDPR data-mapping + DPA review → Phase 2; pen-test → Phase 4 |
| **AI/ML** | Local model R&D, multi-provider ensemble scoring, confidence calibration, benchmark corpus | Benchmark corpus + provider accuracy harness → Phase 1 (intern-led); ensemble scoring POC → Phase 3; local/self-hosted model evaluation → Phase 4 |
| **Technical Support** | Status page, docs/FAQ, SLA definition, feedback funnel | FAQ + feedback form → Phase 1; status page → Phase 2; SLA for API tier → Phase 3 |

---

## 4. Phased Timeline

Target window: **Q4 2026 → Q2 2027**. Phases overlap at the edges; the phase gates are the KPIs in §5.

### Phase 0 — Baseline Freeze (now)
- Commit this roadmap; tag the current state as the v0.1 baseline.
- No behavioral changes to existing code.

### Phase 1 — Hardening (weeks 1–4)
**Theme: make what exists trustworthy.**
- Test suite: Vitest unit tests for `lib/` (fallback orchestrator, scoring buckets, provider adapters with mocked HTTP); route-level integration tests with mocked providers.
- CI: GitHub Actions — lint + typecheck + test on every PR; build gate before merge.
- Rate limiting on all `/api/check/*` routes (IP-based, per-modality caps).
- Health endpoint (`/api/health`) with provider-key presence checks.
- Error tracking (Sentry) + basic uptime monitoring.
- File-upload hardening: validate magic bytes server-side, not just client MIME.
- Docs: add the Audio modality to README (fix the documentation drift).
- Provider benchmark harness (intern-led): fixed corpus → per-provider accuracy/cost matrix.

### Phase 2 — Product (weeks 5–10)
**Theme: turn the tool into a product.**
- Auth (NextAuth or equivalent), email + OAuth.
- Postgres persistence: users, checks (modality, score, verdict, provider, timestamp), history.
- History dashboard UI with filters and re-check.
- Per-user API keys with quotas and usage metering.
- Versioned API surface (`/api/v1/*`) while keeping legacy routes working.
- Playwright E2E suite; Docker image; production deploy to a long-running host (the video route needs more than strict serverless timeouts).
- GDPR data map; retention policy for stored checks.
- Status page + SLA draft.

### Phase 3 — Scale (months 3–4)
**Theme: make it fast, cheap, and open.**
- Queue-backed video pipeline (offload FFmpeg frame extraction + multi-frame scoring to workers; job status polling or webhooks).
- Response caching (hash content → cached verdict) to cut provider spend and latency.
- Ensemble scoring: run multiple providers, combine into a weighted consensus with a confidence measure (AI/ML team POC, behind a flag).
- Public API v1 launch with documented endpoints, keys, and quotas.
- Analytics aggregates and retention automation.

### Phase 4 — Expansion (months 5–6)
**Theme: new surfaces and enterprise.**
- Browser extension (right-click → check image/text/video URL).
- PWA: installable app, offline shell, push notifications for long video jobs.
- Bangla i18n across the UI; evaluate Bangla-language text detection capability (a differentiator if provider support exists).
- Enterprise: SSO, audit logs, team seats.
- Local/self-hosted detection model evaluation (CTO/Architect decision gate).
- Security pen-test and remediation.

---

## 5. KPIs per Phase

| Phase | KPIs |
|---|---|
| **Phase 1** | CI green gate on all PRs; ≥60% unit-test coverage on `lib/`; p95 API latency < 8s (text/image); zero unhandled 5xx over 7 days; rate-limit effectiveness (abuse blocked without affecting legit users) |
| **Phase 2** | Signup→first-check conversion; history retention ≥ 99.9% writes; p95 latency incl. video within deploy-target limits; E2E suite covering all 4 modalities; provider-key rotation with zero downtime |
| **Phase 3** | Video-check success rate ≥ 98%; cache hit rate ≥ 30% on repeat content; ensemble vs single-provider accuracy delta (measured on the benchmark corpus); public API adoption (keys issued, weekly active keys) |
| **Phase 4** | Extension installs / weekly checks via extension; PWA install rate; Bangla UI usage share; enterprise pilot signups; pen-test findings closed |

---

## 6. Risk Register

| Risk | Impact | Mitigation | Owner |
|---|---|---|---|
| Provider quota exhaustion / free-tier cutoff | Detection outage | Multi-provider fallback (exists), cached verdicts (P3), paid-tier budget, self-hosted model as long-term hedge (P4) | Architect → CTO |
| Detection-model drift (accuracy decays as generators evolve) | Trust erosion | Benchmark corpus re-run each release; per-provider accuracy dashboards; ensemble reduces single-model bias | AI/ML team |
| Serverless timeout on the video route | Failed video checks | Long-running host (P2 deploy target), queue-backed processing (P3) | DevOps/SRE |
| Abuse of the free public API (scraping, cost blowup) | Provider bills, downtime | Rate limiting (P1), API keys + quotas (P2), abuse detection (P3) | Cybersecurity + Backend |
| Provider API deprecation or ToS change | Forced rework | Provider-agnostic `Provider` contract (exists), adapters isolated per file, benchmark harness detects regressions early | Tech Lead |
| Privacy/GDPR non-compliance on stored checks | Legal exposure | Retention policy (P2), data map + DPA review (P2), minimal storage by default | CTO + Cybersecurity |
| Single-vendor pricing changes (e.g., Sapling free tier ends) | Cost spike | Fallback chain makes vendors swappable; ensemble mode normalizes multi-provider cost | CTO |

---

## 7. Immediate Next Actions

1. **Tech Lead:** stand up the Vitest test skeleton for `lib/fallback.ts`, `lib/scoring.ts`, and the provider adapters (mocked HTTP) — this unblocks CI.
2. **DevOps:** add the GitHub Actions workflow (lint → typecheck → test → build).
3. **Backend:** implement IP-based rate limiting on `/api/check/*`.
4. **Docs owner:** add the Audio modality section to README (close the documentation drift flagged in §0).
5. **PO/BA:** write acceptance criteria for the Phase 1 epic; define the benchmark corpus spec.
6. **CEO/CTO:** decide the Phase 2 deploy target (long-running host vs serverless+queue) before Phase 2 starts.

---

*Roadmap owner: CTO / Head of Engineering · Review cadence: end of each phase · Baseline ref: v0.1 (this repository's initial state)*
