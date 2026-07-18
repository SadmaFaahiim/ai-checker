# AI-Checker — Environment Variables Reference

**Document Version:** 1.0
**Last Updated:** July 2026
**Author:** Development Team — NeoNexor Software

---

## Table of Contents

- [Overview](#overview)
- [Configuration File](#configuration-file)
- [Variable Reference](#variable-reference)
- [Provider Key Acquisition](#provider-key-acquisition)
- [Security Policy](#security-policy)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Validation & Debugging](#validation--debugging)

---

## Overview

The AI-Checker application uses environment variables to store sensitive API credentials for third-party detection providers. These variables are read server-side only by the Next.js API route handlers and are never exposed to the client-side JavaScript bundle.

The application requires a minimum of **three** environment variables to function (one for text detection, two for image/video detection). Additional variables for fallback providers are optional.

---

## Configuration File

### .env.example (committed to repository)

This template file is tracked in version control and serves as documentation for the required variables:

```bash
# =============================================================================
# AI-Checker — Environment Variables
# =============================================================================
# Copy this file to .env.local and fill in your API keys:
#   cp .env.example .env.local
#
# IMPORTANT:
#   - .env.local is gitignored and must NEVER be committed
#   - All keys are read server-side only (never sent to the browser)
#   - Restart the dev server after changing any value
# =============================================================================

# -----------------------------------------------------------------------------
# TEXT DETECTION
# -----------------------------------------------------------------------------

# Sapling AI — Primary text detection provider
# Sign up: https://sapling.ai → Dashboard → API Key → Generate
# Free tier: 50,000 characters per 24-hour rolling window
# Documentation: https://sapling.ai/docs/api/detector
SAPLING_API_KEY=

# GPTZero — Fallback text detection provider
# Sign up: https://gptzero.me → Dashboard → API Key
# NOTE: Requires a paid API subscription as of July 2026
# Leave blank if not subscribed — the fallback chain will skip this provider
GPTZERO_API_KEY=

# -----------------------------------------------------------------------------
# IMAGE / VIDEO DETECTION
# -----------------------------------------------------------------------------

# Sightengine — Primary image and video detection provider
# Sign up: https://sightengine.com → Dashboard → API Settings
# Free tier: 2,000 operations per month (~500/day soft cap)
# Documentation: https://sightengine.com/docs/ai-generated-image-detection
# BOTH values are required — the API uses a user/secret pair, not a single key
SIGHTENGINE_API_USER=
SIGHTENGINE_API_SECRET=

# AI or Not — Fallback image detection provider
# NOTE: No confirmed public developer API exists as of July 2026
# Leave blank — the provider is stubbed and will be skipped automatically
AIORNOT_API_KEY=
```

### .env.local (local only, never committed)

Create this file by copying the template:

```bash
cp .env.example .env.local
```

Fill in your actual API keys. This file is listed in `.gitignore` and will not be tracked by Git.

---

## Variable Reference

### Required Variables

These must be set for the application to function. Without them, the corresponding detection modality will return HTTP 503 for all requests.

| Variable | Type | Provider | Used By | Description |
|---|---|---|---|---|
| `SAPLING_API_KEY` | `string` | Sapling AI | Text detection route | API key for Sapling's AI text detection endpoint |
| `SIGHTENGINE_API_USER` | `string` | Sightengine | Image & video detection routes | API user identifier for Sightengine |
| `SIGHTENGINE_API_SECRET` | `string` | Sightengine | Image & video detection routes | API secret for Sightengine (paired with API user) |

### Optional Variables

These enable fallback providers. If left blank, the corresponding provider is skipped in the fallback chain without causing errors.

| Variable | Type | Provider | Used By | Description |
|---|---|---|---|---|
| `GPTZERO_API_KEY` | `string` | GPTZero | Text detection route | API key for GPTZero's text detection endpoint (paid) |
| `AIORNOT_API_KEY` | `string` | AI or Not | Image detection route | API key for AI or Not image detection (no confirmed API) |

---

## Provider Key Acquisition

### Sapling AI

| Detail | Value |
|---|---|
| Website | https://sapling.ai |
| Signup | Email + password (no credit card) |
| Key location | Dashboard → API Key → Generate |
| Key format | 32-character alphanumeric string |
| Free tier | 50,000 characters per 24-hour rolling window |
| Rate limit behavior | HTTP 429 when quota exceeded |
| Quota reset | Rolling 24-hour window |
| Documentation | https://sapling.ai/docs/api/detector |

### Sightengine

| Detail | Value |
|---|---|
| Website | https://sightengine.com |
| Signup | Email + password (no credit card) |
| Credentials location | Dashboard home page or API Settings |
| Credential format | API User (numeric) + API Secret (alphanumeric) |
| Free tier | 2,000 operations per month |
| Rate limit behavior | HTTP 429 when quota exceeded |
| Quota reset | Monthly |
| Documentation | https://sightengine.com/docs/ai-generated-image-detection |

**Important:** Sightengine uses a **two-part credential** (user + secret), not a single API key. Both `SIGHTENGINE_API_USER` and `SIGHTENGINE_API_SECRET` must be set.

### GPTZero (Optional)

| Detail | Value |
|---|---|
| Website | https://gptzero.me |
| Signup | Requires paid API subscription |
| Key location | Dashboard → API Key |
| Free tier | Not available as of July 2026 |
| Documentation | https://gptzero.stoplight.io |

---

## Security Policy

### Storage Rules

| Rule | Details |
|---|---|
| File location | `.env.local` in project root only |
| Git tracking | `.env.local` is listed in `.gitignore` — never committed |
| Sharing | Never share via Slack, email, or any unencrypted channel |
| Client exposure | Keys are read via `process.env` on the server only — never bundled into client JS |
| Rotation | If a key is compromised, regenerate it from the provider dashboard immediately |

### How Keys Are Protected at Runtime

1. Next.js only exposes environment variables to the client if they are prefixed with `NEXT_PUBLIC_`. None of our variables use this prefix.
2. API keys are read inside API route handlers (`app/api/check/*/route.ts`), which execute exclusively on the server.
3. The keys are passed directly to `axios` request headers/bodies when calling external provider APIs. They are never included in the JSON response sent back to the client.

### What Happens If Keys Are Missing

| Variable | Missing Behavior |
|---|---|
| `SAPLING_API_KEY` | Sapling provider throws `ProviderUnavailableError` → fallback to GPTZero → if also missing, fallback to ZeroGPT (stubbed) → HTTP 503 |
| `SIGHTENGINE_API_USER` or `SIGHTENGINE_API_SECRET` | Sightengine provider throws `ProviderUnavailableError` → fallback to AI or Not (stubbed) → HTTP 503 |
| `GPTZERO_API_KEY` | GPTZero provider is skipped in the fallback chain — no error |
| `AIORNOT_API_KEY` | AI or Not provider is skipped — no error |

The application does **not** crash or fail to start when keys are missing. Missing keys simply cause the corresponding provider to be unavailable, triggering the fallback chain.

---

## Environment-Specific Configuration

### Local Development

```bash
# File: .env.local
SAPLING_API_KEY=sk_live_abc123...
SIGHTENGINE_API_USER=12345678
SIGHTENGINE_API_SECRET=AbCdEfGhIjKl...
GPTZERO_API_KEY=
AIORNOT_API_KEY=
```

### Staging / Production (hosted deployment)

Set environment variables through your hosting platform's dashboard or CLI:

**Vercel:**
```bash
vercel env add SAPLING_API_KEY
vercel env add SIGHTENGINE_API_USER
vercel env add SIGHTENGINE_API_SECRET
```

**Railway:**
Configure via the Railway dashboard under Settings → Variables.

**Docker:**
```bash
docker run -e SAPLING_API_KEY=sk_live_abc123 \
           -e SIGHTENGINE_API_USER=12345678 \
           -e SIGHTENGINE_API_SECRET=AbCdEfGhIjKl \
           ai-checker
```

---

## Validation & Debugging

### Verify Keys Are Loaded

When starting the development server, check the console output for:

```
  - Environments: .env.local
```

If `.env.local` does not appear, the file may be misplaced or incorrectly named.

### Test a Provider Directly

Use cURL to verify a key works before integrating:

**Sapling:**
```bash
curl -X POST https://api.sapling.ai/api/v1/aidetect \
  -H "Content-Type: application/json" \
  -d '{
    "key": "YOUR_SAPLING_API_KEY",
    "text": "This is a test sentence for AI detection verification."
  }'
```

Expected response: `{ "score": 0.xx, ... }` (HTTP 200)

**Sightengine:**
```bash
curl -X POST https://api.sightengine.com/1.0/check.json \
  -F "media=@/path/to/test-image.jpg" \
  -F "models=genai" \
  -F "api_user=YOUR_API_USER" \
  -F "api_secret=YOUR_API_SECRET"
```

Expected response: `{ "type": { "ai_generated": 0.xx }, ... }` (HTTP 200)

### Common Issues

| Symptom | Likely Cause | Fix |
|---|---|---|
| All text detections return 503 | `SAPLING_API_KEY` is missing or invalid | Verify the key in `.env.local`, restart dev server |
| All image detections return 503 | `SIGHTENGINE_API_USER` or `SIGHTENGINE_API_SECRET` is missing | Verify both values, restart dev server |
| Console shows "quota exceeded" | Provider free tier limit reached | Wait for quota reset or configure a fallback provider |
| Keys work in cURL but not in the app | `.env.local` not in the correct directory, or server not restarted | Confirm file location, run `npm run dev` again |

---

*This document covers all environment variables used in the POC. Additional variables may be introduced as the project evolves toward production.*
