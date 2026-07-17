/**
 * Shared provider contract. Every detection provider (text/image/video-frame),
 * regardless of vendor, implements this same shape so lib/fallback.ts can
 * iterate over a priority list without caring which one it's calling.
 */

export interface DetectionResult {
  /** 0..1, normalized across all providers regardless of the vendor's native scale. */
  aiProbability: number;
  /** e.g. "gptzero", "sightengine" */
  providerName: string;
  /** Original response payload, kept for debugging/logging only — never sent to the client. */
  raw?: unknown;
}

export type ProviderInput =
  | { kind: "text"; text: string }
  | { kind: "image"; buffer: Buffer; mimeType: string }
  | { kind: "video-frame"; buffer: Buffer; mimeType: string };

export interface Provider {
  name: string;
  detect(input: ProviderInput): Promise<DetectionResult>;
}

/**
 * Thrown by providers for any failure the orchestrator should treat as
 * "move on to the next provider" — quota exceeded, bad key, timeout,
 * 5xx, or a response that fails schema validation.
 */
export class ProviderUnavailableError extends Error {
  public readonly providerName: string;
  public readonly reason: string;

  constructor(providerName: string, reason: string) {
    super(`${providerName} unavailable: ${reason}`);
    this.name = "ProviderUnavailableError";
    this.providerName = providerName;
    this.reason = reason;
  }
}
