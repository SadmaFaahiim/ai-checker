# AI-Checker — Architecture Documentation

**Document Version:** 1.0
**Last Updated:** July 2026
**Author:** Development Team — NeoNexor Software
**Status:** Approved for POC

---

## Table of Contents

- [1. System Overview](#1-system-overview)
- [2. High-Level Architecture](#2-high-level-architecture)
- [3. Request Lifecycle](#3-request-lifecycle)
- [4. Provider Abstraction Layer](#4-provider-abstraction-layer)
- [5. Fallback Orchestration](#5-fallback-orchestration)
- [6. Video Processing Pipeline](#6-video-processing-pipeline)
- [7. Frontend Architecture](#7-frontend-architecture)
- [8. Data Flow Diagrams](#8-data-flow-diagrams)
- [9. Error Handling Strategy](#9-error-handling-strategy)
- [10. Security Considerations](#10-security-considerations)
- [11. Performance Characteristics](#11-performance-characteristics)
- [12. Scalability Notes](#12-scalability-notes)

---

## 1. System Overview

AI-Checker is a proof-of-concept web application that determines the likelihood of content being AI-generated. It accepts three input modalities — text, image, and video — and returns a normalized percentage score (0–100) with a human-readable verdict bucket.

The system delegates all detection work to third-party APIs rather than running any models on its own infrastructure. This decision is intentional: it minimizes operational complexity for a POC while allowing the team to evaluate multiple detection providers under real-world conditions.

The defining architectural feature is the **provider fallback chain**: if the primary detection provider for a given modality fails (rate limit, timeout, server error, or malformed response), the system automatically retries with the next provider in a priority list. This happens transparently — the end user receives a result without knowing which provider fulfilled it.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser)                          │
│                                                                     │
│   ┌──────────┐   ┌──────────────┐   ┌──────────────┐               │
│   │ Text Tab │   │  Image Tab   │   │  Video Tab   │               │
│   └────┬─────┘   └──────┬───────┘   └──────┬───────┘               │
│        │                │                   │                       │
│        │    Client-side validation          │                       │
│        │    (type, size, format)            │                       │
│        └────────────┬───────────────────────┘                       │
│                     │  HTTP POST (JSON or multipart/form-data)      │
└─────────────────────┼───────────────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────────────────┐
│                     ▼       NEXT.JS SERVER (Node.js Runtime)        │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────┐       │
│   │                    API Route Handlers                    │       │
│   │  POST /api/check/text                                   │       │
│   │  POST /api/check/image                                  │       │
│   │  POST /api/check/video                                  │       │
│   └──────────────────────┬──────────────────────────────────┘       │
│                          │                                          │
│   ┌──────────────────────▼──────────────────────────────────┐       │
│   │              detectWithFallback(providers[], input)       │       │
│   │                                                          │       │
│   │   ┌───────────┐    ┌───────────┐    ┌───────────┐       │       │
│   │   │ Provider 1 │──▶│ Provider 2 │──▶│ Provider 3 │       │       │
│   │   │ (primary)  │    │ (fallback) │    │ (last     │       │       │
│   │   │            │    │            │    │  resort)   │       │       │
│   │   └───────────┘    └───────────┘    └───────────┘       │       │
│   │                                                          │       │
│   │   On success: return immediately                         │       │
│   │   On failure: log, try next                              │       │
│   │   All failed: throw → HTTP 503                           │       │
│   └──────────────────────────────────────────────────────────┘       │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────┐      │
│   │              Video Processing (video only)                │      │
│   │   Upload → temp file → FFmpeg frame extraction            │      │
│   │   → per-frame detection → score aggregation               │      │
│   └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    THIRD-PARTY DETECTION APIs                       │
│                                                                     │
│   Text:    Sapling AI  ──▶  GPTZero  ──▶  ZeroGPT (stubbed)       │
│   Image:   Sightengine ──▶  AI or Not (stubbed)                    │
│   Video:   Reuses image provider chain per extracted frame          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Request Lifecycle

### 3.1 Text Detection

1. User pastes text into the textarea (minimum 20 characters enforced client-side)
2. Client sends `POST /api/check/text` with JSON body `{ "text": "..." }`
3. Route handler validates input length
4. `detectWithFallback` is called with the text provider array `[sapling, gptzero, zerogpt]`
5. First available provider processes the text and returns `aiProbability` (0.0–1.0)
6. Route handler converts to percentage (0–100), maps to verdict bucket, returns JSON response
7. Client renders `ResultCard` with animated percentage counter and gradient progress bar

### 3.2 Image Detection

1. User drops or selects a JPG/PNG file (max 10MB enforced client-side)
2. Client sends `POST /api/check/image` with `multipart/form-data`
3. Route handler validates file type and size
4. File is read into a `Buffer`
5. `detectWithFallback` is called with the image provider array `[sightengine, aiornot]`
6. Provider sends the buffer to the external API (multipart upload for Sightengine)
7. Response follows the same percentage + verdict path as text

### 3.3 Video Detection

1. User drops or selects an MP4 file (max 20MB enforced client-side)
2. Client sends `POST /api/check/video` with `multipart/form-data`
3. Route handler writes the upload to a temporary file on disk
4. `extractFrames()` uses FFmpeg to extract up to 8 evenly-spaced JPEG frames
5. Each frame is run through `detectWithFallback` using the image provider array
6. Per-frame scores are collected; the overall score is the arithmetic mean
7. Response includes both the aggregate percentage and a `perFrame` array for the timeline chart
8. Temporary files (video + extracted frames) are cleaned up in a `finally` block

---

## 4. Provider Abstraction Layer

Every detection provider — regardless of modality — implements a single uniform interface. This decouples the orchestration logic from any specific API's implementation details.

### 4.1 Core Interfaces

```typescript
// lib/providers/types.ts

export interface DetectionResult {
  aiProbability: number;      // Normalized 0..1 (0 = certainly human, 1 = certainly AI)
  providerName: string;       // Identifier for attribution (e.g. "sapling", "sightengine")
  raw?: unknown;              // Original API response preserved for debugging
}

export interface Provider {
  name: string;
  detect(input: ProviderInput): Promise<DetectionResult>;
}

export type ProviderInput =
  | { kind: "text"; text: string }
  | { kind: "image"; buffer: Buffer; mimeType: string }
  | { kind: "video-frame"; buffer: Buffer; mimeType: string };
```

### 4.2 Error Contract

Providers signal unavailability by throwing `ProviderUnavailableError`. This tells the orchestrator "skip me, try the next one" rather than treating the error as a fatal failure.

```typescript
export class ProviderUnavailableError extends Error {
  constructor(
    public providerName: string,
    public reason: string
  ) {
    super(`${providerName} unavailable: ${reason}`);
  }
}
```

Providers must throw this error for any of the following conditions:

| Condition | Example |
|---|---|
| Rate limit exceeded | HTTP 429 from the external API |
| Authentication failure | HTTP 401 or 403 (bad/expired/missing key) |
| Server error | HTTP 5xx from the provider |
| Malformed response | Response JSON does not match expected schema |
| Network failure | Connection refused, DNS resolution failure |

### 4.3 Provider Registration

Providers are registered as ordered arrays in each API route handler. The order defines the priority:

```typescript
// Text detection priority
const textProviders = [saplingProvider, gptZeroProvider, zeroGptProvider];

// Image detection priority
const imageProviders = [sightengineImageProvider, aiOrNotImageProvider];
```

Adding a new provider requires only two steps:
1. Implement the `Provider` interface in a new file under `lib/providers/<modality>/`
2. Add the instance to the provider array in the corresponding route handler

---

## 5. Fallback Orchestration

The `detectWithFallback` function is the central coordination point. It accepts an ordered array of providers and an input, then calls each provider sequentially until one succeeds.

### 5.1 Algorithm

```
function detectWithFallback(providers, input):
    errors = []

    for each provider in providers:
        try:
            result = call provider.detect(input) with 8-second timeout
            return result                          // success — stop immediately
        catch error:
            log warning: "{provider} failed: {reason}"
            append error to errors
            continue to next provider              // try next

    throw "All providers failed" with collected errors
```

### 5.2 Timeout Mechanism

Each provider call is wrapped in a `Promise.race` against a timeout promise. If the provider does not respond within 8 seconds (configurable via `PROVIDER_TIMEOUT_MS`), the timeout fires a `ProviderUnavailableError` and the orchestrator moves to the next provider.

### 5.3 Observability

Every fallback event is logged via `console.warn` with the provider name and failure reason. This provides a clear audit trail during demos and debugging:

```
[fallback] sapling failed: quota exceeded. Trying next provider...
[fallback] gptzero failed: timeout. Trying next provider...
```

---

## 6. Video Processing Pipeline

Video detection is the most complex path. Rather than sending an entire video to a detection API (most free-tier APIs do not accept video), the system extracts representative frames and analyzes each as an image.

### 6.1 Frame Extraction

```
Input: MP4 video file (max 20MB)
    │
    ▼
Write to temporary file (os.tmpdir)
    │
    ▼
FFmpeg extracts 8 evenly-spaced JPEG frames
    │
    ├── frame-1.jpg (0% of duration)
    ├── frame-2.jpg (14% of duration)
    ├── frame-3.jpg (28% of duration)
    ├── frame-4.jpg (42% of duration)
    ├── frame-5.jpg (57% of duration)
    ├── frame-6.jpg (71% of duration)
    ├── frame-7.jpg (85% of duration)
    └── frame-8.jpg (100% of duration)
    │
    ▼
Read each frame into a Buffer
    │
    ▼
Clean up temporary frame files
```

### 6.2 Per-Frame Detection

Each frame buffer is passed through `detectWithFallback` using the image provider chain. All 8 frames are processed in parallel via `Promise.all` for performance.

### 6.3 Score Aggregation

The overall video score is the arithmetic mean of all per-frame scores:

```
overallScore = sum(frameScores) / frameCount
```

The `perFrame` array is returned alongside the aggregate score, enabling the frontend to render a timeline chart showing which segments of the video appear more or less synthetic.

### 6.4 Cleanup

All temporary files (the uploaded video and extracted frames) are deleted in a `finally` block to prevent disk exhaustion on the server.

---

## 7. Frontend Architecture

### 7.1 Component Hierarchy

```
app/page.tsx
├── ThemeToggle                     // Day/night theme switcher
├── Hero Section                    // Title, badge, subtitle
├── TabSwitcher                     // Segmented control (Text | Image | Video)
└── Active Panel (one of):
    ├── TextCheckPanel
    │   ├── Textarea + character count
    │   ├── Skeleton loader
    │   └── ResultCard
    ├── ImageCheckPanel
    │   ├── Dropzone (react-dropzone)
    │   ├── Image preview
    │   ├── Skeleton loader
    │   └── ResultCard
    └── VideoCheckPanel
        ├── Dropzone (react-dropzone)
        ├── Skeleton loader
        ├── ResultCard
        └── FrameTimelineChart (recharts)
```

### 7.2 State Management

All state is local to each panel component via React `useState`. There is no global state management (Redux, Zustand, Context) — the POC's scope does not warrant it. Each panel independently manages:

- Input state (text content, selected file)
- Loading state (boolean)
- Result state (percentage, verdict, provider, per-frame scores for video)
- Error state (handled via toast notifications)

### 7.3 Theme System

The application supports light and dark themes via a `ThemeProvider` context component. Theme preference is detected from the system (`prefers-color-scheme`) and can be manually toggled. The selected theme is persisted via a cookie to avoid flash-of-wrong-theme on subsequent page loads.

The theme is applied by toggling a `dark` class on the `<html>` element, which activates Tailwind CSS's `dark:` variant utilities.

---

## 8. Data Flow Diagrams

### 8.1 Text Detection Flow

```
User Input          Client                  Server                  External API
    │                  │                       │                        │
    │  Paste text      │                       │                        │
    │─────────────────▶│                       │                        │
    │                  │  POST /api/check/text  │                        │
    │                  │──────────────────────▶│                        │
    │                  │                       │  POST /api/v1/aidetect  │
    │                  │                       │───────────────────────▶│
    │                  │                       │                        │
    │                  │                       │  { score: 0.78 }       │
    │                  │                       │◀───────────────────────│
    │                  │                       │                        │
    │                  │  { percentage: 78,    │                        │
    │                  │    verdict: "Likely   │                        │
    │                  │    AI-generated",     │                        │
    │                  │    provider: "sapling"}│                        │
    │                  │◀──────────────────────│                        │
    │  Show result     │                       │                        │
    │◀─────────────────│                       │                        │
```

### 8.2 Fallback Flow (provider failure)

```
Server                          Provider A              Provider B
  │                                │                       │
  │  detect(input)                 │                       │
  │───────────────────────────────▶│                       │
  │                                │                       │
  │  HTTP 429 (rate limited)       │                       │
  │◀───────────────────────────────│                       │
  │                                │                       │
  │  [log] "Provider A failed"    │                       │
  │                                │                       │
  │  detect(input)                                         │
  │───────────────────────────────────────────────────────▶│
  │                                                        │
  │  { aiProbability: 0.65 }                               │
  │◀───────────────────────────────────────────────────────│
  │                                                        │
  │  return result (user unaware of failover)              │
```

---

## 9. Error Handling Strategy

### 9.1 Layers

| Layer | Responsibility |
|---|---|
| Provider | Catch API errors, throw `ProviderUnavailableError` |
| Orchestrator | Catch provider errors, log, try next provider |
| Route Handler | Catch orchestrator failure, return HTTP 503 with friendly message |
| Frontend | Catch HTTP errors, show toast notification to user |

### 9.2 HTTP Status Codes

| Code | Meaning | When |
|---|---|---|
| 200 | Success | Detection completed by at least one provider |
| 400 | Bad Request | Invalid input (text too short, wrong file type, file too large) |
| 503 | Service Unavailable | All providers in the chain failed |

### 9.3 User-Facing Error Messages

The frontend never displays raw error messages, stack traces, or provider-specific details. All errors are translated to friendly messages:

- Provider failure (503): *"Detection is temporarily unavailable. Please try again shortly."*
- Invalid input (400): Specific validation message (e.g., *"Please provide at least 20 characters of text."*)

---

## 10. Security Considerations

| Concern | Mitigation |
|---|---|
| API key exposure | Keys stored in `.env.local` (gitignored), read server-side only via `process.env`, never sent to client |
| File upload abuse | Client-side and server-side validation of file type and size |
| Temporary file persistence | Video frames written to `os.tmpdir()`, deleted in `finally` block |
| Provider response injection | Responses are validated for expected shape before use |
| CORS | Next.js API routes are same-origin by default |

---

## 11. Performance Characteristics

| Operation | Expected Latency | Bottleneck |
|---|---|---|
| Text detection | 1–3 seconds | External API response time |
| Image detection | 2–5 seconds | File upload to provider + API processing |
| Video detection | 10–30 seconds | FFmpeg extraction + 8 sequential/parallel API calls |
| Provider fallback | +1–8 seconds per failed provider | Timeout wait before moving to next |

### 11.1 Video Optimization

Per-frame detection calls are dispatched via `Promise.all`, meaning all 8 frames are analyzed concurrently rather than sequentially. This reduces total video processing time from `8 × (per-frame latency)` to approximately `1 × (per-frame latency)` plus overhead.

---

## 12. Scalability Notes

This architecture is designed for a POC with low concurrent usage. For production scaling, the following changes would be recommended:

| Area | POC Approach | Production Recommendation |
|---|---|---|
| Provider selection | Static ordered array | Dynamic selection based on real-time quota/latency metrics |
| Video processing | In-process FFmpeg | Offload to a background job queue (Bull, BullMQ) |
| File storage | Temporary local disk | Cloud storage (S3) with signed upload URLs |
| Rate limiting | None (relies on provider limits) | Application-level rate limiting per user/IP |
| Caching | None | Cache identical text/image hashes to avoid redundant API calls |
| Monitoring | `console.warn` logging | Structured logging with alerting (Datadog, Sentry) |

---

*This document describes the architecture as implemented for the POC phase. Architectural changes for production readiness should be discussed and documented separately.*
