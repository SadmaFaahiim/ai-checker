/**
 * Health reporting for /api/health.
 *
 * Reads only the *presence* of provider credentials in the environment —
 * no vendor API calls are made, so the endpoint is cheap and safe to poll
 * from uptime monitors. A missing key is not an error: the fallback chain
 * simply skips that provider, so the report distinguishes "configured" from
 * "stubbed" instead of failing.
 */

export type ProviderRole = "primary" | "fallback" | "stub";

export type ProviderModality = "text" | "image" | "audio" | "video";

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
  const sightengineKeys = ["SIGHTENGINE_API_USER", "SIGHTENGINE_API_SECRET"];
  const sightengineConfigured = hasEnv(...sightengineKeys);

  return [
    {
      id: "gptzero",
      modality: "text",
      role: "primary",
      envKeys: ["GPTZERO_API_KEY"],
      configured: hasEnv("GPTZERO_API_KEY"),
    },
    {
      id: "sapling",
      modality: "text",
      role: "fallback",
      envKeys: ["SAPLING_API_KEY"],
      configured: hasEnv("SAPLING_API_KEY"),
    },
    {
      id: "zerogpt",
      modality: "text",
      role: "stub",
      envKeys: [],
      configured: false,
      note: "Stubbed — no documented authenticated API; always fails over.",
    },
    {
      id: "sightengine",
      modality: "image",
      role: "primary",
      envKeys: sightengineKeys,
      configured: sightengineConfigured,
    },
    {
      id: "sightengine",
      modality: "audio",
      role: "primary",
      envKeys: sightengineKeys,
      configured: sightengineConfigured,
    },
    {
      id: "sightengine-frames",
      modality: "video",
      role: "primary",
      envKeys: sightengineKeys,
      configured: sightengineConfigured,
      note: "Video reuses the Sightengine image provider per sampled frame.",
    },
    {
      id: "aiornot",
      modality: "image",
      role: "stub",
      envKeys: [],
      configured: false,
      note: "Stubbed — no confirmed authenticated API; always fails over.",
    },
    {
      id: "aiornot-audio",
      modality: "audio",
      role: "stub",
      envKeys: [],
      configured: false,
      note: "Stubbed — no confirmed authenticated audio API; always fails over.",
    },
  ];
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
