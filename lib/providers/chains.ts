import type { Provider } from "./types";
import { saplingProvider } from "./text/sapling";
import { gptZeroProvider } from "./text/gptzero";
import { zeroGptProvider } from "./text/zerogpt";
import { sightengineImageProvider } from "./image/sightengine";
import { aiOrNotImageProvider } from "./image/aiornot";
import { sightengineAudioProvider } from "./audio/sightengine";
import { aiOrNotAudioProvider } from "./audio/aiornot";

/**
 * Single source of truth for the provider chains (issue #4 / F3).
 *
 * Before this module, the API routes listed provider objects while
 * lib/health.ts separately re-listed their env keys, roles and notes — so a
 * new provider could silently miss health coverage, and role labels could
 * drift from what the routes actually do (the health report called GPTZero
 * "primary" while every route tries Sapling first).
 *
 * Routes import the `providers` arrays; lib/health.ts derives its report
 * from the same entries. Adding a provider to a chain here automatically
 * adds it to both.
 */

export type ChainRole = "primary" | "fallback" | "stub";

export type ProviderModality = "text" | "image" | "audio" | "video";

export interface ChainEntry {
  provider: Provider;
  /** Environment variables this provider requires; empty for stubs. */
  requiredEnvKeys: string[];
  role: ChainRole;
  note?: string;
}

export const TEXT_CHAIN: ChainEntry[] = [
  {
    provider: saplingProvider,
    requiredEnvKeys: ["SAPLING_API_KEY"],
    role: "primary",
  },
  {
    provider: gptZeroProvider,
    requiredEnvKeys: ["GPTZERO_API_KEY"],
    role: "fallback",
  },
  {
    provider: zeroGptProvider,
    requiredEnvKeys: [],
    role: "stub",
    note: "Stubbed — no documented authenticated API; always fails over.",
  },
];

export const IMAGE_CHAIN: ChainEntry[] = [
  {
    provider: sightengineImageProvider,
    requiredEnvKeys: ["SIGHTENGINE_API_USER", "SIGHTENGINE_API_SECRET"],
    role: "primary",
  },
  {
    provider: aiOrNotImageProvider,
    requiredEnvKeys: [],
    role: "stub",
    note: "Stubbed — no confirmed authenticated API; always fails over.",
  },
];

export const AUDIO_CHAIN: ChainEntry[] = [
  {
    provider: sightengineAudioProvider,
    requiredEnvKeys: ["SIGHTENGINE_API_USER", "SIGHTENGINE_API_SECRET"],
    role: "primary",
  },
  {
    provider: aiOrNotAudioProvider,
    requiredEnvKeys: [],
    role: "stub",
    note: "Stubbed — no confirmed authenticated audio API; always fails over.",
  },
];

/** Video samples frames and runs each through the image chain. */
export const VIDEO_CHAIN: ChainEntry[] = IMAGE_CHAIN;

export const ALL_CHAINS: Record<ProviderModality, ChainEntry[]> = {
  text: TEXT_CHAIN,
  image: IMAGE_CHAIN,
  audio: AUDIO_CHAIN,
  video: VIDEO_CHAIN,
};

/** Just the provider objects, in priority order — what the routes pass to detectWithFallback. */
export const TEXT_PROVIDERS = TEXT_CHAIN.map((e) => e.provider);
export const IMAGE_PROVIDERS = IMAGE_CHAIN.map((e) => e.provider);
export const AUDIO_PROVIDERS = AUDIO_CHAIN.map((e) => e.provider);
