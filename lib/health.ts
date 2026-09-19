/**
 * Health reporting for /api/health.
 *
 * The report is **derived from the provider chains registry**
 * (lib/providers/chains.ts) — the same single source of truth the API
 * routes use to build their fallback chains (issue #4 / F3). A provider
 * added to a chain automatically appears here with the right env keys and
 * role; nothing can drift.
 *
 * Reads only the *presence* of provider credentials in the environment —
 * no vendor API calls are made, so the endpoint is cheap and safe to poll
 * from uptime monitors. A missing key is not an error: the fallback chain
 * simply skips that provider, so the report distinguishes "configured" from
 * "stubbed" instead of failing.
 */

import { ALL_CHAINS } from "./providers/chains";
import type { ProviderModality } from "./providers/chains";

export type ProviderRole = "primary" | "fallback" | "stub";

export interface ProviderStatus {
  id: string;
  modality: ProviderModality;
  role: ProviderRole;
  /** Environment variables this provider needs; empty for stubs. */
  envKeys: string[];
  /** True when every envKey is present and non-blank. Stubs are always false. */
  configured: boolean;
  note?: string;
}

function hasEnv(...keys: string[]): boolean {
  return keys.every((key) => {
    const value = process.env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function getProviderStatus(): ProviderStatus[] {
  const statuses: ProviderStatus[] = [];

  for (const [modality, chain] of Object.entries(ALL_CHAINS) as [
    ProviderModality,
    typeof ALL_CHAINS[ProviderModality],
  ][]) {
    for (const entry of chain) {
      statuses.push({
        id: entry.provider.name,
        modality,
        role: entry.role,
        envKeys: entry.requiredEnvKeys,
        configured:
          entry.role === "stub"
            ? false
            : hasEnv(...entry.requiredEnvKeys),
        ...(entry.note ? { note: entry.note } : {}),
      });
    }
  }

  return statuses;
}

export interface HealthReport {
  /** "ok" when at least one provider is configured, "degraded" when none are. */
  status: "ok" | "degraded";
  uptimeSeconds: number;
  timestamp: string;
  providers: ProviderStatus[];
}

export function getHealthReport(now: Date = new Date()): HealthReport {
  const providers = getProviderStatus();
  const anyConfigured = providers.some((p) => p.configured);

  return {
    status: anyConfigured ? "ok" : "degraded",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: now.toISOString(),
    providers,
  };
}
