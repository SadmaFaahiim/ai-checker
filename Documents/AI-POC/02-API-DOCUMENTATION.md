# AI-Checker — API Documentation

**Document Version:** 1.0
**Last Updated:** July 2026
**Author:** Development Team — NeoNexor Software

---

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Common Response Format](#common-response-format)
- [Verdict Buckets](#verdict-buckets)
- [Endpoints](#endpoints)
  - [POST /api/check/text](#post-apichecktext)
  - [POST /api/check/image](#post-apicheckimage)
  - [POST /api/check/video](#post-apicheckvideo)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)
- [Provider Attribution](#provider-attribution)

---

## Overview

The AI-Checker API exposes three detection endpoints — one per input modality (text, image, video). All endpoints are implemented as Next.js API Route Handlers running on the Node.js runtime.

The API is internal to the application. There is no external authentication layer — these endpoints are called by the frontend client on the same origin.

---

## Base URL

```
Development:  http://localhost:3000
Production:   https://<deployment-domain>
```

---

## Common Response Format

All successful detection responses share this structure:

```json
{
  "percentage": 78,
  "verdict": "Likely AI-generated",
  "provider": "sapling"
}
```

| Field | Type | Description |
|---|---|---|
| `percentage` | `number` | Integer 0–100 representing the AI-generation likelihood |
| `verdict` | `string` | Human-readable label derived from the percentage (see Verdict Buckets) |
| `provider` | `string` | Name of the provider that produced the result |

The video endpoint extends this format with an additional `perFrame` field.

---

## Verdict Buckets

The percentage is mapped to a verdict using the following thresholds, defined in `lib/scoring.ts`:

| Percentage Range | Verdict | Intended Interpretation |
|---|---|---|
| 0–34% | `Likely Human` | Low probability of AI generation |
| 35–65% | `Uncertain` | Inconclusive — detection signal is ambiguous |
| 66–100% | `Likely AI-generated` | High probability of AI generation |

These thresholds are configurable by modifying the `toVerdict` function.

---

## Endpoints

### POST /api/check/text

Analyzes a text string for AI-generation likelihood.

**Runtime:** Node.js

#### Request

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |

**Body (JSON):**

```json
{
  "text": "The text content to analyze. Must be at least 20 characters long."
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `text` | `string` | Yes | Minimum 20 characters after trimming |

#### Success Response (200)

```json
{
  "percentage": 78,
  "verdict": "Likely AI-generated",
  "provider": "sapling"
}
```

#### Error Responses

**400 — Bad Request (text too short):**
```json
{
  "error": "Please provide at least 20 characters of text."
}
```

**503 — All Providers Unavailable:**
```json
{
  "error": "All detection providers are currently unavailable."
}
```

#### Example — cURL

```bash
curl -X POST http://localhost:3000/api/check/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Artificial intelligence has transformed the way we interact with technology, enabling machines to perform tasks that previously required human intelligence."
  }'
```

#### Example — JavaScript (fetch)

```javascript
const response = await fetch("/api/check/text", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Your text content here...",
  }),
});

const data = await response.json();
// { percentage: 78, verdict: "Likely AI-generated", provider: "sapling" }
```

#### Provider Chain

| Priority | Provider | Endpoint |
|---|---|---|
| 1 | Sapling | `POST https://api.sapling.ai/api/v1/aidetect` |
| 2 | GPTZero | `POST https://api.gptzero.me/v2/predict/text` |
| 3 | ZeroGPT | Stubbed — throws `ProviderUnavailableError` immediately |

---

### POST /api/check/image

Analyzes an uploaded image for AI-generation likelihood.

**Runtime:** Node.js

#### Request

| Header | Value |
|---|---|
| `Content-Type` | `multipart/form-data` |

**Body (FormData):**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `image` | `File` | Yes | JPEG or PNG, maximum 10MB |

#### Success Response (200)

```json
{
  "percentage": 12,
  "verdict": "Likely Human",
  "provider": "sightengine"
}
```

#### Error Responses

**400 — No File:**
```json
{
  "error": "No image provided."
}
```

**400 — Invalid Type or Size:**
```json
{
  "error": "Invalid image. Only JPG/PNG under 10MB are accepted."
}
```

**503 — All Providers Unavailable:**
```json
{
  "error": "Image/Video detection is temporarily unavailable. Provider API keys need to be configured."
}
```

#### Example — cURL

```bash
curl -X POST http://localhost:3000/api/check/image \
  -F "image=@/path/to/photo.jpg"
```

#### Example — JavaScript (fetch)

```javascript
const formData = new FormData();
formData.append("image", fileInput.files[0]);

const response = await fetch("/api/check/image", {
  method: "POST",
  body: formData,
});

const data = await response.json();
// { percentage: 12, verdict: "Likely Human", provider: "sightengine" }
```

#### Provider Chain

| Priority | Provider | Endpoint |
|---|---|---|
| 1 | Sightengine | `POST https://api.sightengine.com/1.0/check.json` |
| 2 | AI or Not | Stubbed — throws `ProviderUnavailableError` immediately |

---

### POST /api/check/video

Analyzes an uploaded video by extracting frames and running per-frame image detection.

**Runtime:** Node.js

#### Request

| Header | Value |
|---|---|
| `Content-Type` | `multipart/form-data` |

**Body (FormData):**

| Field | Type | Required | Constraints |
|---|---|---|---|
| `video` | `File` | Yes | MP4 only, maximum 20MB |

#### Success Response (200)

```json
{
  "percentage": 45,
  "verdict": "Uncertain",
  "perFrame": [32, 41, 55, 48, 39, 52, 47, 44]
}
```

| Field | Type | Description |
|---|---|---|
| `percentage` | `number` | Aggregate score (arithmetic mean of all per-frame scores) |
| `verdict` | `string` | Verdict based on the aggregate score |
| `perFrame` | `number[]` | Array of per-frame AI-likelihood scores (0–100), one per sampled frame |

#### Error Responses

**400 — No File:**
```json
{
  "error": "No video provided."
}
```

**400 — Invalid Type or Size:**
```json
{
  "error": "Invalid video. Only MP4 under 20MB is accepted."
}
```

**503 — Analysis Failed:**
```json
{
  "error": "Video analysis failed."
}
```

#### Example — cURL

```bash
curl -X POST http://localhost:3000/api/check/video \
  -F "video=@/path/to/clip.mp4"
```

#### Example — JavaScript (fetch)

```javascript
const formData = new FormData();
formData.append("video", fileInput.files[0]);

const response = await fetch("/api/check/video", {
  method: "POST",
  body: formData,
});

const data = await response.json();
// {
//   percentage: 45,
//   verdict: "Uncertain",
//   perFrame: [32, 41, 55, 48, 39, 52, 47, 44]
// }
```

#### Processing Details

1. The uploaded MP4 is written to a temporary file
2. FFmpeg extracts up to 8 evenly-spaced JPEG frames
3. Each frame is analyzed via the image provider chain (Sightengine → AI or Not)
4. Per-frame scores are collected and averaged
5. Temporary files are cleaned up regardless of success or failure

#### Provider Chain

Uses the same image provider chain as the image endpoint.

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|---|---|---|
| `200` | Detection successful | Parse and display the result |
| `400` | Invalid input | Display the error message to the user |
| `503` | All providers failed | Show a friendly "temporarily unavailable" message; retry later |

### Error Response Format

All error responses use a consistent structure:

```json
{
  "error": "Human-readable error description."
}
```

The `error` field always contains a user-safe message. No stack traces, internal provider details, or debugging information is included in error responses.

---

## Rate Limits

The API itself does not impose rate limits. However, the underlying third-party providers have their own quotas:

| Provider | Free Tier Limit | Limit Type |
|---|---|---|
| Sapling | 50,000 characters per 24 hours | Rolling daily |
| Sightengine | 2,000 operations per month (approximately 500/day) | Monthly with daily soft cap |
| GPTZero | Paid subscription required | N/A for free tier |

When a provider's quota is exhausted, it returns HTTP 429, which triggers automatic fallback to the next provider in the chain. The user is not informed of quota exhaustion unless all providers in the chain are unavailable.

---

## Provider Attribution

Every successful response includes a `provider` field indicating which third-party service produced the detection result. This serves two purposes:

1. **Transparency:** The frontend displays "via {provider}" in a subtle label on the result card, so the user knows the source of the analysis
2. **Debugging:** During development and demos, the team can verify which provider fulfilled a request and whether fallback occurred (fallback events are logged server-side)

Provider names used in the API response:

| Value | Provider |
|---|---|
| `"sapling"` | Sapling AI |
| `"gptzero"` | GPTZero |
| `"sightengine"` | Sightengine |

---

*This document covers the API as implemented for the POC. Production deployment may require additional considerations such as authentication, CORS configuration, and rate limiting at the application level.*
