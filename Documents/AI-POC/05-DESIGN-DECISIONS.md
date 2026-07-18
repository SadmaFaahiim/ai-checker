# AI-Checker — Design Decisions

**Document Version:** 1.0
**Last Updated:** July 2026
**Author:** Development Team — NeoNexor Software

---

## Table of Contents

- [1. Purpose of This Document](#1-purpose-of-this-document)
- [2. Why Third-Party APIs Instead of Self-Hosted Models](#2-why-third-party-apis-instead-of-self-hosted-models)
- [3. Why a Fallback Chain Architecture](#3-why-a-fallback-chain-architecture)
- [4. Why Next.js App Router](#4-why-nextjs-app-router)
- [5. Why Server-Side API Routes Instead of Direct Client Calls](#5-why-server-side-api-routes-instead-of-direct-client-calls)
- [6. Why a Uniform Provider Interface](#6-why-a-uniform-provider-interface)
- [7. Why Frame Sampling for Video](#7-why-frame-sampling-for-video)
- [8. Why 8 Frames](#8-why-8-frames)
- [9. Why Percentage + Verdict Instead of Binary Yes/No](#9-why-percentage--verdict-instead-of-binary-yesno)
- [10. Why These Specific Verdict Thresholds](#10-why-these-specific-verdict-thresholds)
- [11. Why Client-Side File Validation](#11-why-client-side-file-validation)
- [12. Why No Authentication](#12-why-no-authentication)
- [13. Why No Database or Persistent Storage](#13-why-no-database-or-persistent-storage)
- [14. Why These Specific Providers](#14-why-these-specific-providers)
- [15. Why the Mandatory Disclaimer](#15-why-the-mandatory-disclaimer)
- [16. UI/UX Design Decisions](#16-uiux-design-decisions)
- [17. Package Selection Rationale](#17-package-selection-rationale)
- [18. Decisions Deferred to Production](#18-decisions-deferred-to-production)

---

## 1. Purpose of This Document

This document records the significant technical and product decisions made during the AI-Checker POC development, along with the reasoning behind each. It serves as a reference for the team and for any future developer who needs to understand *why* the system was built this way, not just *how*.

Each decision follows the format: **Context** (what situation prompted the decision), **Decision** (what was chosen), **Rationale** (why), and **Trade-offs** (what was given up).

---

## 2. Why Third-Party APIs Instead of Self-Hosted Models

**Context:** AI content detection requires specialized machine learning models. We needed to decide whether to self-host open-source detector models or delegate detection to third-party API providers.

**Decision:** Delegate all detection to third-party APIs via their free tiers.

**Rationale:**
- A POC needs to demonstrate the concept quickly, not optimize inference infrastructure
- Self-hosting models (e.g., running a HuggingFace detector on our own GPU) introduces significant operational complexity: model serving, GPU provisioning, model version management, and latency optimization
- Free-tier APIs from established providers offer production-quality detection with zero infrastructure overhead
- The provider abstraction layer means switching to self-hosted models later requires only implementing a new `Provider` class — the rest of the system remains unchanged

**Trade-offs:**
- Dependency on third-party uptime and rate limits (mitigated by the fallback chain)
- Detection quality is limited to what the providers offer (no ability to fine-tune)
- Free-tier quotas are restrictive for heavy usage

---

## 3. Why a Fallback Chain Architecture

**Context:** Free-tier APIs have strict rate limits and occasional downtime. A single-provider architecture would leave the POC non-functional whenever the provider is unavailable.

**Decision:** Implement an ordered fallback chain that automatically retries with the next provider on failure.

**Rationale:**
- Free-tier rate limits (e.g., GPTZero's 7 scans/hour, Sightengine's 2,000/month) are easily exhausted during development and demos
- Different providers fail for different reasons at different times — having multiple providers dramatically increases overall availability
- The fallback is transparent to the user: they receive a result regardless of which provider fulfilled it
- This architecture is a core differentiator of the POC — it demonstrates resilience thinking, not just basic API integration

**Trade-offs:**
- Slight increase in response time when the primary provider fails (up to 8 seconds for timeout)
- Different providers may return different scores for the same input (acceptable for a POC — consistency is a production concern)
- More provider integrations to maintain

---

## 4. Why Next.js App Router

**Context:** We needed a React-based full-stack framework that handles both the frontend UI and the backend API routes in a single project.

**Decision:** Next.js 16 with the App Router (not Pages Router).

**Rationale:**
- App Router is the current recommended architecture for new Next.js projects
- Server-side API routes (`app/api/*/route.ts`) provide a clean way to proxy third-party API calls without exposing keys to the client
- TypeScript-first support with excellent type inference
- Built-in file-based routing eliminates boilerplate
- The team has existing familiarity with the Next.js ecosystem

**Trade-offs:**
- App Router has a steeper learning curve than Pages Router for developers unfamiliar with it
- Some ecosystem libraries have not fully migrated to App Router conventions

---

## 5. Why Server-Side API Routes Instead of Direct Client Calls

**Context:** We could either call third-party detection APIs directly from the browser (client-side) or proxy them through our own server-side API routes.

**Decision:** All third-party API calls go through Next.js API route handlers on the server.

**Rationale:**
- API keys must never be sent to the client — they would be visible in browser DevTools and could be extracted
- Server-side routing provides a single point for fallback orchestration logic
- CORS restrictions on some provider APIs would prevent direct browser calls
- The server can pre-process inputs (e.g., extract video frames) before calling providers

**Trade-offs:**
- Adds a network hop (client → our server → provider API → our server → client)
- Our server becomes a proxy point that must handle file uploads temporarily

---

## 6. Why a Uniform Provider Interface

**Context:** Different detection providers have different API contracts, authentication methods, request formats, and response shapes. We needed to decide how to structure the integration code.

**Decision:** Define a single `Provider` interface that all providers implement, regardless of modality or API specifics.

**Rationale:**
- The fallback orchestrator can operate on any provider without knowing its implementation details
- Adding a new provider is a single-file task: implement the interface, add to the provider array
- Testing and mocking are straightforward: any object satisfying the interface works
- Provider-specific logic (authentication, request format, response parsing) is fully encapsulated

**Trade-offs:**
- Some providers may have capabilities (e.g., sentence-level scoring, per-generator breakdown) that don't fit cleanly into the `DetectionResult` shape — these are preserved in the `raw` field but not surfaced in the UI
- The uniform interface forces a lowest-common-denominator output (a single probability score)

---

## 7. Why Frame Sampling for Video

**Context:** Most free-tier image detection APIs do not accept video input. We needed a strategy to analyze video content.

**Decision:** Extract evenly-spaced JPEG frames from the video using FFmpeg, then run each frame through the image detection fallback chain.

**Rationale:**
- Reuses the existing image detection infrastructure — no additional provider integration needed
- Evenly-spaced frames give a representative sample across the video's duration
- The per-frame scores enable a timeline chart showing which segments appear more synthetic
- FFmpeg is the industry standard for media processing and handles all common video codecs

**Trade-offs:**
- Frame sampling loses temporal information (motion, frame interpolation artifacts) that a dedicated video detection model might catch
- 8 frames may miss brief synthetic segments in longer videos
- FFmpeg adds a processing step and temporary disk usage

---

## 8. Why 8 Frames

**Context:** We needed to choose how many frames to extract from each video.

**Decision:** Extract 8 frames by default.

**Rationale:**
- 8 frames provide reasonable coverage across the video duration without excessive API calls
- With parallel execution (`Promise.all`), processing time remains manageable (roughly equal to a single-frame latency plus overhead)
- 8 data points produce a readable timeline chart — enough to show trends, not so many that the chart becomes noisy
- Each frame consumes one Sightengine API operation; 8 operations per video keeps free-tier usage sustainable

**Trade-offs:**
- Short videos (under 5 seconds) may have near-duplicate frames
- Very long videos may have insufficient coverage at only 8 sample points
- The frame count is a constant but could be made dynamic based on video duration in a future iteration

---

## 9. Why Percentage + Verdict Instead of Binary Yes/No

**Context:** We needed to decide the output format for detection results.

**Decision:** Return a percentage (0–100) with a three-tier verdict label, never a binary "AI" or "Human" answer.

**Rationale:**
- AI detection is inherently probabilistic — no model is 100% accurate
- A percentage gives the user a sense of confidence level, not false certainty
- The three-tier verdict (Likely Human / Uncertain / Likely AI-generated) provides a human-readable interpretation while preserving nuance
- The "Uncertain" bucket explicitly acknowledges cases where the detector cannot make a confident call

**Trade-offs:**
- More complex UI than a simple yes/no badge
- Users may misinterpret a moderate percentage as a definitive answer (mitigated by the mandatory disclaimer)

---

## 10. Why These Specific Verdict Thresholds

**Context:** The percentage needs to be mapped to verdict labels. We needed to choose threshold boundaries.

**Decision:** 0–34% = Likely Human, 35–65% = Uncertain, 66–100% = Likely AI-generated.

**Rationale:**
- A wide "Uncertain" band (31 percentage points) reduces false confidence on borderline cases
- The thresholds align roughly with common detection provider recommendations
- The boundaries are deliberately asymmetric: 34% upper bound for "Likely Human" is stricter than 66% lower bound for "Likely AI-generated," meaning the system is slightly more cautious about declaring content human than declaring it AI

**Trade-offs:**
- These thresholds are somewhat arbitrary for a POC — in production, they should be calibrated against provider-specific accuracy data
- Different providers may require different thresholds for optimal performance

---

## 11. Why Client-Side File Validation

**Context:** File uploads need to be validated for type and size. Validation can happen client-side, server-side, or both.

**Decision:** Validate client-side before upload, with server-side validation as a safety net.

**Rationale:**
- Client-side validation provides instant feedback without a network round-trip
- Prevents unnecessary upload of oversized files (which can be slow on poor connections)
- Keeps the demo experience responsive — a 30MB file rejection after a 20-second upload is a terrible user experience
- Server-side validation remains in place as defense-in-depth (never trust client-side validation alone)

**Trade-offs:**
- Validation logic is duplicated across client and server (acceptable for a POC scope)

---

## 12. Why No Authentication

**Context:** We needed to decide whether to implement user accounts, login, or API authentication.

**Decision:** No authentication of any kind.

**Rationale:**
- This is a POC. Authentication adds significant complexity (session management, password hashing, token validation) that does not demonstrate the core detection concept
- The POC is intended for internal demos, not public deployment
- Adding auth later is straightforward and does not require architectural changes

**Trade-offs:**
- Cannot track per-user usage or enforce per-user rate limits
- Not suitable for public-facing deployment without adding auth

---

## 13. Why No Database or Persistent Storage

**Context:** We could store detection results for history, analytics, or caching.

**Decision:** No database. All results are computed on-demand and not persisted.

**Rationale:**
- A POC should demonstrate the detection flow, not data management capabilities
- No database means no migrations, no connection management, no schema design — reduced complexity
- Detection results are not sensitive enough to warrant long-term storage in a POC context

**Trade-offs:**
- No result history for users
- Identical inputs result in redundant API calls (no caching)
- No analytics on usage patterns

---

## 14. Why These Specific Providers

### Text: Sapling (primary)

- Free tier is generous (50,000 chars/day) and requires no credit card
- Simple JSON API with clean documentation
- Adequate accuracy for a POC demonstration
- GPTZero (former primary) switched to paid-only during development — Sapling was promoted to primary

### Image: Sightengine (primary)

- Real documented REST API with a clean `ai_generated` probability field
- Covers detection of content from major generators (Stable Diffusion, DALL-E, Midjourney, etc.)
- Free tier (2,000 ops/month) is sufficient for demo purposes
- Returns structured JSON that maps cleanly to our `DetectionResult` interface

### Stubbed providers (ZeroGPT, AI or Not)

- Both were evaluated but lack confirmed public developer APIs as of July 2026
- Rather than remove them, they are implemented as stubs that immediately throw `ProviderUnavailableError`
- This preserves the fallback chain architecture and makes it trivial to activate them if/when their APIs become available

---

## 15. Why the Mandatory Disclaimer

**Context:** Detection results may be inaccurate. We needed to decide how to communicate this to users.

**Decision:** Every result card includes a permanently visible disclaimer: *"This is a detection signal, not proof. Treat it as one input among several."*

**Rationale:**
- AI detection is not foolproof — false positives and false negatives occur regularly
- Presenting results as definitive could lead to incorrect accusations or false confidence
- The disclaimer protects the team during client demos when results may look unexpected
- Independent testing reports false-positive rates of 5–33% across popular detectors

**Trade-offs:**
- Adds visual noise to the result card (acceptable — accuracy of expectations is more important than visual cleanliness)

---

## 16. UI/UX Design Decisions

### Dark-first design with light mode support

The primary design is optimized for dark mode, with light mode as a supported alternative. Dark interfaces reduce eye strain during extended use and align with the aesthetic of modern AI-focused products (ChatGPT, Raycast, Linear).

### Tab-based single-page layout

All three modalities are accessible from a single page via tabs, rather than separate pages or a multi-step wizard. This reduces navigation friction and makes it obvious that the tool supports text, image, and video without the user having to discover separate features.

### Per-frame timeline chart for video

Rather than showing only an aggregate score for video, the timeline chart reveals how detection confidence varies across the video's duration. This provides actionable insight (e.g., "the middle section looks more synthetic") rather than a single opaque number.

### Animated percentage counter

The result percentage animates from 0 to the final value. This serves a functional purpose: it draws the user's attention to the result and creates a brief moment of anticipation that makes the reveal feel intentional rather than abrupt.

### Color-coded gradient progress bar

Green (0–34%) → amber (35–65%) → red (66–100%) leverages pre-existing color associations (green = safe, red = warning) to communicate the verdict before the user reads the label text.

---

## 17. Package Selection Rationale

| Package | Why chosen | Alternatives considered |
|---|---|---|
| `axios` | Cleaner multipart/form-data handling than native `fetch`; built-in timeout support; interceptor pattern aligns with fallback retry logic | Native `fetch`, `got`, `ky` |
| `zod` | Type-safe schema validation with excellent TypeScript inference; small bundle | `joi`, `yup`, manual validation |
| `react-dropzone` | Minimal drag-and-drop file upload with hooks API; well-maintained; handles browser inconsistencies | Native drag-and-drop events, `react-dropzone-uploader` |
| `fluent-ffmpeg` | Node.js wrapper around FFmpeg with a clean promise-based API; well-documented | Direct FFmpeg CLI via `child_process`, `ffmpeg.wasm` |
| `@ffmpeg-installer/ffmpeg` | Bundles a prebuilt FFmpeg binary — no system-level install required | System FFmpeg, Docker-based FFmpeg |
| `recharts` | Declarative React charting with built-in responsive containers; TypeScript support | Chart.js, D3 (too low-level for a POC), Victory |
| `framer-motion` | Production-quality React animation library with layout animations and gesture support | CSS transitions only, `react-spring`, GSAP |
| `react-hot-toast` | Lightweight toast notifications with a simple API; customizable styling | `sonner`, `notistack`, custom implementation |
| `clsx` | Tiny utility for conditional CSS class composition | `classnames`, template literals |
| `lucide-react` | Modern icon library with tree-shakable imports; consistent with Tailwind ecosystem | `react-icons`, `heroicons` |

---

## 18. Decisions Deferred to Production

The following decisions were intentionally deferred to keep the POC focused:

| Decision | POC Approach | Production Consideration |
|---|---|---|
| Provider scoring consistency | Accept that different providers return different scores for the same input | Normalize scores using provider-specific calibration curves |
| Result caching | No caching — every request hits a provider | Cache by input hash to reduce API consumption |
| Rate limiting | Rely on provider rate limits | Implement application-level rate limiting per user/IP |
| Monitoring and alerting | `console.warn` logging | Structured logging with Sentry or Datadog |
| Multi-provider aggregation | Use the first successful provider's score | Aggregate scores from multiple providers for higher confidence |
| Support for more formats | JPEG/PNG images, MP4 video only | WebP, GIF, AVI, MOV, WEBM |
| Accessibility audit | Basic semantic HTML and ARIA labels | Full WCAG 2.2 AA compliance audit |
| Internationalization | English only | i18n framework for multi-language support |

---

*This document captures decisions made during POC development. It should be updated as the project evolves.*
