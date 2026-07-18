# AI-Checker — Project Structure

**Document Version:** 1.0
**Last Updated:** July 2026
**Author:** Development Team — NeoNexor Software

---

## Table of Contents

- [Overview](#overview)
- [Complete File Tree](#complete-file-tree)
- [Directory Breakdown](#directory-breakdown)
  - [app/](#app)
  - [components/](#components)
  - [lib/](#lib)
  - [Configuration Files](#configuration-files)
- [Module Dependency Graph](#module-dependency-graph)
- [File Responsibilities](#file-responsibilities)
- [Conventions](#conventions)

---

## Overview

The project follows the Next.js App Router convention with a clear separation of concerns:

- **`app/`** — Pages, layouts, and API route handlers (Next.js routing layer)
- **`components/`** — Reusable React UI components (presentation layer)
- **`lib/`** — Business logic, provider integrations, and utility functions (logic layer)

There is no `src/` directory — the project uses the default Next.js structure where `app/`, `components/`, and `lib/` sit at the project root.

---

## Complete File Tree

```
ai-checker/
│
├── app/                                    # Next.js App Router — pages and API routes
│   ├── layout.tsx                          # Root layout — HTML shell, ThemeProvider, Toaster, metadata
│   ├── page.tsx                            # Main page — hero section, tab switcher, detection panels
│   ├── globals.css                         # Global styles — CSS custom properties, theme variables,
│   │                                       #   Tailwind directives, keyframe animations, utility classes
│   ├── favicon.ico                         # Browser tab icon
│   └── api/                               # Server-side API route handlers
│       └── check/                         # Detection endpoint group
│           ├── text/
│           │   └── route.ts               # POST /api/check/text — text AI detection
│           ├── image/
│           │   └── route.ts               # POST /api/check/image — image AI detection
│           └── video/
│               └── route.ts               # POST /api/check/video — video AI detection (frame extraction)
│
├── components/                             # React UI components
│   ├── TabSwitcher.tsx                     # Segmented tab control — Text | Image | Video
│   │                                       #   Animated active indicator (framer-motion layoutId)
│   │                                       #   Lucide icons per tab, hover/focus states
│   │
│   ├── TextCheckPanel.tsx                  # Text analysis panel
│   │                                       #   Textarea input with live character count
│   │                                       #   Minimum 20-character client-side validation
│   │                                       #   Skeleton loading state, ResultCard on completion
│   │
│   ├── ImageCheckPanel.tsx                 # Image analysis panel
│   │                                       #   react-dropzone for drag-and-drop file upload
│   │                                       #   Accepts JPG/PNG, enforces 10MB client-side limit
│   │                                       #   Thumbnail preview, file metadata display
│   │                                       #   Skeleton loading state, ResultCard on completion
│   │
│   ├── VideoCheckPanel.tsx                 # Video analysis panel
│   │                                       #   react-dropzone for MP4 upload
│   │                                       #   Enforces 20MB client-side limit, MP4 only
│   │                                       #   Skeleton loading state with "Analyzing frames..." text
│   │                                       #   ResultCard + FrameTimelineChart on completion
│   │
│   ├── ResultCard.tsx                      # Detection result display (shared across all panels)
│   │                                       #   Animated percentage counter (counts up from 0)
│   │                                       #   Gradient progress bar (green → amber → red)
│   │                                       #   Verdict label, provider attribution ("via sapling")
│   │                                       #   Mandatory disclaimer caption (always visible)
│   │
│   ├── FrameTimelineChart.tsx              # Per-frame score timeline for video results
│   │                                       #   Recharts LineChart with monotone curve interpolation
│   │                                       #   Gradient fill under the line
│   │                                       #   Custom tooltip showing frame number and score
│   │                                       #   Themed for both light and dark mode
│   │
│   ├── ThemeProvider.tsx                   # Theme context provider
│   │                                       #   Detects system preference (prefers-color-scheme)
│   │                                       #   Supports manual toggle via cookie persistence
│   │                                       #   Applies dark/light class to <html> element
│   │                                       #   Exposes theme state and toggle function via context
│   │
│   └── ThemeToggle.tsx                     # Day/night toggle button
│                                           #   Sun/moon icon with rotation animation
│                                           #   Reads and toggles theme from ThemeProvider context
│
├── lib/                                    # Business logic and utilities
│   ├── fallback.ts                         # Provider fallback orchestrator
│   │                                       #   detectWithFallback(providers[], input) → DetectionResult
│   │                                       #   Sequential execution with 8-second timeout per provider
│   │                                       #   Logs failures via console.warn for observability
│   │                                       #   Throws aggregated error if all providers fail
│   │
│   ├── scoring.ts                          # Score normalization and verdict mapping
│   │                                       #   toVerdict(percentage) → "Likely Human" | "Uncertain" | "Likely AI-generated"
│   │                                       #   Thresholds: <35 = Human, 35-65 = Uncertain, >65 = AI
│   │
│   ├── videoFrames.ts                      # Video frame extraction utility
│   │                                       #   extractFrames(videoPath, count) → Buffer[]
│   │                                       #   Uses fluent-ffmpeg to extract evenly-spaced JPEG frames
│   │                                       #   Writes to os.tmpdir(), returns buffers, cleans up temp files
│   │
│   └── providers/                          # Third-party detection provider integrations
│       ├── types.ts                        # Shared TypeScript interfaces
│       │                                   #   Provider — { name, detect(input) → DetectionResult }
│       │                                   #   DetectionResult — { aiProbability, providerName, raw? }
│       │                                   #   ProviderInput — union type (text | image | video-frame)
│       │                                   #   ProviderUnavailableError — custom error class for fallback
│       │
│       ├── text/                           # Text detection providers
│       │   ├── sapling.ts                  # Sapling AI — PRIMARY text provider
│       │   │                               #   POST https://api.sapling.ai/api/v1/aidetect
│       │   │                               #   Free tier: 50,000 chars/day
│       │   │                               #   Extracts score (0..1) from response
│       │   │
│       │   ├── gptzero.ts                  # GPTZero — FALLBACK text provider
│       │   │                               #   POST https://api.gptzero.me/v2/predict/text
│       │   │                               #   Requires paid subscription (as of July 2026)
│       │   │                               #   Extracts documents[0].class_probabilities.ai
│       │   │
│       │   └── zerogpt.ts                  # ZeroGPT — STUBBED (last resort)
│       │                                   #   No confirmed public API
│       │                                   #   Immediately throws ProviderUnavailableError
│       │
│       └── image/                          # Image detection providers
│           ├── sightengine.ts              # Sightengine — PRIMARY image provider
│           │                               #   POST https://api.sightengine.com/1.0/check.json
│           │                               #   Multipart upload with models=genai
│           │                               #   Free tier: 2,000 ops/month
│           │                               #   Extracts type.ai_generated (0..1) from response
│           │
│           └── aiornot.ts                  # AI or Not — STUBBED (fallback)
│                                           #   No confirmed public developer API
│                                           #   Immediately throws ProviderUnavailableError
│
├── public/                                 # Static assets served at site root
│   └── (empty — no custom static assets)
│
├── .env.example                            # Environment variable template (committed)
│                                           #   Documents all required and optional API keys
│                                           #   Copy to .env.local and fill in real values
│
├── .env.local                              # Actual API keys (GITIGNORED — never committed)
│
├── .gitignore                              # Git ignore rules
│                                           #   Excludes: node_modules, .next, .env.local,
│                                           #   .claude/, AGENTS.md, CLAUDE.md
│
├── eslint.config.mjs                       # ESLint configuration (flat config format)
│
├── next.config.ts                          # Next.js configuration
│                                           #   serverExternalPackages: fluent-ffmpeg, @ffmpeg-installer/ffmpeg
│                                           #   Required for FFmpeg to work in Node.js runtime
│
├── next-env.d.ts                           # Next.js TypeScript declarations (auto-generated)
│
├── postcss.config.mjs                      # PostCSS configuration for Tailwind CSS v4
│
├── tsconfig.json                           # TypeScript compiler configuration
│                                           #   Strict mode enabled
│                                           #   Path alias: @/* → ./*
│
├── package.json                            # Project manifest — dependencies, scripts, metadata
│
└── package-lock.json                       # Locked dependency versions (committed for reproducibility)
```

---

## Directory Breakdown

### app/

The `app/` directory follows the Next.js App Router convention where the file system defines the routing structure.

| File | Route | Purpose |
|---|---|---|
| `layout.tsx` | (wraps all pages) | HTML structure, theme provider, toast notification container, page metadata |
| `page.tsx` | `/` | The single-page application UI |
| `globals.css` | (imported by layout) | CSS custom properties, Tailwind directives, theme variables, animations |
| `api/check/text/route.ts` | `POST /api/check/text` | Text detection API endpoint |
| `api/check/image/route.ts` | `POST /api/check/image` | Image detection API endpoint |
| `api/check/video/route.ts` | `POST /api/check/video` | Video detection API endpoint |

All API route files export `const runtime = "nodejs"` to ensure they run on the Node.js runtime (required for FFmpeg and the `form-data` package).

### components/

All UI components are React functional components written in TypeScript. They receive data via props and manage local state via `useState`. There is no global state management library.

| Component | Props | Used By |
|---|---|---|
| `TabSwitcher` | `activeTab`, `onTabChange` | `page.tsx` |
| `TextCheckPanel` | (none — self-contained) | `page.tsx` |
| `ImageCheckPanel` | (none — self-contained) | `page.tsx` |
| `VideoCheckPanel` | (none — self-contained) | `page.tsx` |
| `ResultCard` | `percentage`, `verdict`, `provider` | All three panels |
| `FrameTimelineChart` | `scores` (number array) | `VideoCheckPanel` |
| `ThemeProvider` | `children` | `layout.tsx` |
| `ThemeToggle` | (none — reads context) | `page.tsx` |

### lib/

The `lib/` directory contains all business logic, completely decoupled from React and the UI framework.

| Module | Exports | Consumers |
|---|---|---|
| `fallback.ts` | `detectWithFallback()` | All three API route handlers |
| `scoring.ts` | `toVerdict()` | All three API route handlers |
| `videoFrames.ts` | `extractFrames()` | Video API route handler only |
| `providers/types.ts` | `Provider`, `DetectionResult`, `ProviderInput`, `ProviderUnavailableError` | All provider files, `fallback.ts` |
| `providers/text/sapling.ts` | `saplingProvider` | Text API route handler |
| `providers/text/gptzero.ts` | `gptZeroProvider` | Text API route handler |
| `providers/text/zerogpt.ts` | `zeroGptProvider` | Text API route handler |
| `providers/image/sightengine.ts` | `sightengineImageProvider` | Image and video API route handlers |
| `providers/image/aiornot.ts` | `aiOrNotImageProvider` | Image and video API route handlers |

### Configuration Files

| File | Purpose | Committed to Git? |
|---|---|---|
| `.env.example` | Template documenting all environment variables | Yes |
| `.env.local` | Actual API keys for local development | No (gitignored) |
| `next.config.ts` | Next.js server configuration (external packages for FFmpeg) | Yes |
| `tsconfig.json` | TypeScript strict mode, path aliases | Yes |
| `postcss.config.mjs` | PostCSS plugins for Tailwind CSS v4 | Yes |
| `eslint.config.mjs` | ESLint rules (flat config) | Yes |
| `package.json` | Dependencies, scripts, project metadata | Yes |
| `package-lock.json` | Locked dependency tree for reproducible installs | Yes |

---

## Module Dependency Graph

```
page.tsx
├── TabSwitcher
├── TextCheckPanel
│   └── ResultCard
├── ImageCheckPanel
│   └── ResultCard
├── VideoCheckPanel
│   ├── ResultCard
│   └── FrameTimelineChart
└── ThemeToggle
    └── ThemeProvider (context)

API Routes:
text/route.ts ──── fallback.ts ──── sapling.ts
                       │              gptzero.ts
                       │              zerogpt.ts
                       └── scoring.ts

image/route.ts ─── fallback.ts ──── sightengine.ts
                       │              aiornot.ts
                       └── scoring.ts

video/route.ts ─── fallback.ts ──── sightengine.ts
                       │              aiornot.ts
                       ├── scoring.ts
                       └── videoFrames.ts (fluent-ffmpeg)

All providers ──── providers/types.ts (shared interfaces)
```

---

## File Responsibilities

### Single Responsibility Principle

Each file has exactly one job:

| File | Single Responsibility |
|---|---|
| `fallback.ts` | Try providers in order until one succeeds |
| `scoring.ts` | Convert a percentage to a verdict label |
| `videoFrames.ts` | Extract JPEG frames from a video file |
| `types.ts` | Define the contract all providers must follow |
| Each provider file | Translate between the Provider interface and one specific external API |
| Each route handler | Validate input, call the orchestrator, format the HTTP response |
| Each panel component | Manage the input/upload UI and display results for one modality |
| `ResultCard.tsx` | Render the detection result (shared — modality-agnostic) |
| `FrameTimelineChart.tsx` | Render the per-frame score chart (video-specific) |

---

## Conventions

### Naming

| Convention | Example | Scope |
|---|---|---|
| PascalCase | `ResultCard.tsx`, `TabSwitcher.tsx` | React components |
| camelCase | `fallback.ts`, `scoring.ts`, `videoFrames.ts` | Utility modules |
| camelCase | `saplingProvider`, `detectWithFallback` | Exported functions/objects |
| PascalCase | `Provider`, `DetectionResult` | TypeScript interfaces/types |
| kebab-case | `app/api/check/text/route.ts` | Route handler paths |

### Imports

All internal imports use the `@/*` path alias (configured in `tsconfig.json`):

```typescript
import { detectWithFallback } from "@/lib/fallback";
import { saplingProvider } from "@/lib/providers/text/sapling";
```

### Component Pattern

All components follow this structure:

1. Imports
2. Interface/type definitions for props
3. Component function (default export)
4. Internal state declarations (`useState`)
5. Event handlers
6. Return JSX

No class components. No default exports mixed with named exports. No barrel files (`index.ts` re-exports).

---

*This document reflects the project structure as of the completed POC. File additions or reorganization for production should be documented separately.*
