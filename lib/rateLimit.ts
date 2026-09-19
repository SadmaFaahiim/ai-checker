import { NextResponse } from "next/server";
import crypto from "crypto";

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
 *
 * Hardening (issue #4, F1 + F2):
 * - F1: the per-modality stores are capped at MAX_TRACKED_CLIENTS. A sweep
 *   runs before insertions; once the cap is reached, the least-recently-active
 *   clients are evicted and stale entries are dropped, so memory stays
 *   bounded under adversarial IP churn.
 * - F2: client identities are one-way hashed (HMAC-SHA256 with a server
 *   secret) before they become store keys or appear in logs. Raw IPs are
 *   never persisted — they are personal data under GDPR.
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

/** Hard ceiling on tracked clients per modality store (issue #4 / F1). */
export const MAX_TRACKED_CLIENTS = 10_000;

/**
 * How often, in milliseconds, the background sweep may run. Sweeps remove
 * fully-stale client entries so long-lived processes don't accumulate dead
 * keys even when the cap is never reached.
 */
export const SWEEP_INTERVAL_MS = 60_000;

/**
 * Secret used to key the HMAC that hashes client identities (issue #4 / F2).
 * RATE_LIMIT_IP_SECRET wins if set; otherwise the limiter derives a
 * process-stable fallback so hashing still works in dev without extra setup.
 * A stable shared secret across instances is required before Phase 3's
 * multi-instance swap, so the derived fallback is intentionally logged once.
 */
let cachedSecret: string | null = null;

function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  const configured = process.env.RATE_LIMIT_IP_SECRET?.trim();
  if (configured) {
    cachedSecret = configured;
  } else {
    cachedSecret = crypto
      .createHash("sha256")
      .update(`ai-checker-rate-limit::${process.pid}`)
      .digest("hex");
    console.warn(
      "[rate-limit] RATE_LIMIT_IP_SECRET not set — using a process-derived fallback for IP hashing. Set it in production so all instances hash identically."
    );
  }
  return cachedSecret;
}

/** One-way hash of a client identity (HMAC-SHA256, hex). Never reversible. */
export function hashClientIp(ip: string): string {
  return crypto.createHmac("sha256", getSecret()).update(ip).digest("hex");
}

/** One timestamp store per modality: hashedClientKey -> hit timestamps. */
const stores = new Map<RateLimitModality, Map<string, number[]>>();

/** Timestamp of the last sweep per modality store. */
const lastSweepAt = new Map<RateLimitModality, number>();

function getStore(modality: RateLimitModality): Map<string, number[]> {
  let store = stores.get(modality);
  if (!store) {
    store = new Map<string, number[]>();
    stores.set(modality, store);
  }
  return store;
}

/**
 * Drop fully-stale entries (every hit older than the modality window) and,
 * if still at capacity, evict least-recently-active clients (smallest latest
 * hit timestamp) until there is room for one more insertion.
 */
export function sweepRateLimitStore(
  modality: RateLimitModality,
  now: number = Date.now()
): number {
  const { windowMs } = RATE_LIMIT_CONFIG[modality];
  const store = getStore(modality);
  let removed = 0;

  for (const [key, hits] of store) {
    const live = hits.filter((t) => t > now - windowMs);
    if (live.length === 0) {
      store.delete(key);
      removed++;
    } else if (live.length !== hits.length) {
      store.set(key, live);
    }
  }

  if (store.size > MAX_TRACKED_CLIENTS) {
    // Snapshot the excess count first — store.size shrinks as we delete.
    const excess = store.size - MAX_TRACKED_CLIENTS;
    const entries = [...store.entries()].sort(
      (a, b) => latestHit(a[1]) - latestHit(b[1])
    );
    for (let i = 0; i < excess; i++) {
      store.delete(entries[i][0]);
      removed++;
    }
  }

  lastSweepAt.set(modality, now);
  return removed;
}

function latestHit(hits: number[]): number {
  return hits.length ? hits[hits.length - 1] : 0;
}

/** True when a sweep is due (rate-limited to once per SWEEP_INTERVAL_MS). */
function sweepDue(modality: RateLimitModality, now: number): boolean {
  const last = lastSweepAt.get(modality);
  return last === undefined || now - last >= SWEEP_INTERVAL_MS;
}

/** Exposed for tests and observability; not part of the route contract. */
export function getRateLimitStore(
  modality: RateLimitModality
): Map<string, number[]> {
  return getStore(modality);
}

export function resetRateLimitStores(): void {
  stores.clear();
  lastSweepAt.clear();
  cachedSecret = null;
}

/**
 * Best-effort client identity. Behind a proxy, x-forwarded-for carries the
 * original client; its first value is the client, the rest are proxies.
 * The returned value is hashed with HMAC-SHA256 (issue #4 / F2) before it
 * is used as a store key or logged — raw IPs never leave this module.
 */
export function getClientIp(req: Request): string {
  let raw = "unknown";
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) raw = first;
  }
  if (raw === "unknown") {
    const realIp = req.headers.get("x-real-ip");
    if (realIp && realIp.trim()) raw = realIp.trim();
  }
  return hashClientIp(raw);
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

  if (sweepDue(modality, now)) {
    sweepRateLimitStore(modality, now);
  }

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
