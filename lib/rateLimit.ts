import { NextResponse } from "next/server";

/**
 * In-memory sliding-window rate limiter for the /api/check/* routes.
 *
 * Phase 1 scope (TASKS.md EPIC-3): single-instance, zero-dependency, no
 * external store. Multi-instance deployments (Phase 3) should swap the
 * Map store for Redis or similar — the isAllowed() contract stays the same.
 *
 * Video is capped stricter than text/image because each video request fans
 * out into multiple provider calls (up to 8 frames), burning scarce
 * free-tier provider quota fastest.
 */

export type RateLimitModality = "text" | "image" | "audio" | "video";

export interface RateLimitConfig {
  /** Sliding window length in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per window per client. */
  max: number;
}

export const RATE_LIMIT_CONFIG: Record<RateLimitModality, RateLimitConfig> = {
  text: { windowMs: 60_000, max: 20 },
  image: { windowMs: 60_000, max: 10 },
  audio: { windowMs: 60_000, max: 6 },
  video: { windowMs: 60_000, max: 4 },
};

/** One timestamp store per modality: clientKey -> hit timestamps. */
const stores = new Map<RateLimitModality, Map<string, number[]>>();

function getStore(modality: RateLimitModality): Map<string, number[]> {
  let store = stores.get(modality);
  if (!store) {
    store = new Map<string, number[]>();
    stores.set(modality, store);
  }
  return store;
}

/** Exposed for tests and observability; not part of the route contract. */
export function getRateLimitStore(
  modality: RateLimitModality
): Map<string, number[]> {
  return getStore(modality);
}

export function resetRateLimitStores(): void {
  stores.clear();
}

/**
 * Best-effort client identity. Behind a proxy, x-forwarded-for carries the
 * original client; its first value is the client, the rest are proxies.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();
  return "unknown";
}

export interface RateLimitOutcome {
  allowed: boolean;
  remaining: number;
  /** Seconds the client should wait; only meaningful when blocked. */
  retryAfterSeconds: number;
}

export function isAllowed(
  modality: RateLimitModality,
  key: string,
  now: number = Date.now()
): RateLimitOutcome {
  const { windowMs, max } = RATE_LIMIT_CONFIG[modality];
  const store = getStore(modality);
  const cutoff = now - windowMs;

  // Drop hits that slid out of the window.
  const hits = (store.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= max) {
    const oldest = hits[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - now) / 1000)
    );
    store.set(key, hits);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  hits.push(now);
  store.set(key, hits);
  return { allowed: true, remaining: max - hits.length, retryAfterSeconds: 0 };
}

export function rateLimitResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: "Too many requests. Please wait before trying again.",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

/**
 * Guard for route handlers. Returns the 429 response when the client is over
 * the modality's cap, or null when the request may proceed. Call it at the
 * very top of a POST handler:
 *
 *   const limited = checkRateLimit("text", req);
 *   if (limited) return limited;
 */
export function checkRateLimit(
  modality: RateLimitModality,
  req: Request
): NextResponse | null {
  const outcome = isAllowed(modality, getClientIp(req));
  if (outcome.allowed) return null;
  console.warn(
    `[rate-limit] ${modality} request blocked for ${outcome.retryAfterSeconds}s`
  );
  return rateLimitResponse(outcome.retryAfterSeconds);
}
