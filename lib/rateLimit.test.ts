import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_TRACKED_CLIENTS,
  RATE_LIMIT_CONFIG,
  checkRateLimit,
  getClientIp,
  getRateLimitStore,
  hashClientIp,
  isAllowed,
  resetRateLimitStores,
  sweepRateLimitStore,
} from "@/lib/rateLimit";

const T0 = 1_700_000_000_000;

function requestWithIp(ip: string): Request {
  return new Request("http://localhost/api/check/text", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  vi.stubEnv("RATE_LIMIT_IP_SECRET", "test-secret");
  resetRateLimitStores();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAllowed", () => {
  it("allows requests up to the cap, then blocks", () => {
    const max = RATE_LIMIT_CONFIG.text.max;

    for (let i = 0; i < max; i++) {
      expect(isAllowed("text", "client-a", T0).allowed).toBe(true);
    }
    expect(isAllowed("text", "client-a", T0).allowed).toBe(false);
  });

  it("tracks clients independently", () => {
    const max = RATE_LIMIT_CONFIG.video.max;

    for (let i = 0; i < max; i++) {
      isAllowed("video", "client-a", T0);
    }
    expect(isAllowed("video", "client-a", T0).allowed).toBe(false);
    expect(isAllowed("video", "client-b", T0).allowed).toBe(true);
  });

  it("applies stricter caps to video than text", () => {
    expect(RATE_LIMIT_CONFIG.video.max).toBeLessThan(
      RATE_LIMIT_CONFIG.text.max
    );
  });

  it("keeps modalities isolated from each other", () => {
    const textMax = RATE_LIMIT_CONFIG.text.max;
    for (let i = 0; i < textMax; i++) {
      isAllowed("text", "client-a", T0);
    }
    // Text is exhausted, but audio still has its full budget.
    expect(isAllowed("audio", "client-a", T0).allowed).toBe(true);
  });

  it("recovers after the window slides past the oldest hits", () => {
    const max = RATE_LIMIT_CONFIG.audio.max;
    for (let i = 0; i < max; i++) {
      isAllowed("audio", "client-a", T0);
    }
    expect(isAllowed("audio", "client-a", T0 + 1).allowed).toBe(false);

    // One second past the first hit's expiry (60s window, first hit at T0).
    const recovered = isAllowed("audio", "client-a", T0 + 60_001);
    expect(recovered.allowed).toBe(true);
  });

  it("reports remaining budget as the cap minus hits", () => {
    const first = isAllowed("text", "client-a", T0);
    expect(first.remaining).toBe(RATE_LIMIT_CONFIG.text.max - 1);

    const second = isAllowed("text", "client-a", T0 + 1);
    expect(second.remaining).toBe(RATE_LIMIT_CONFIG.text.max - 2);
  });

  it("computes a positive retry-after when blocked", () => {
    const max = RATE_LIMIT_CONFIG.video.max;
    for (let i = 0; i < max; i++) {
      isAllowed("video", "client-a", T0);
    }

    const blocked = isAllowed("video", "client-a", T0 + 1_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(59);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe("hashClientIp (issue #4 / F2)", () => {
  it("produces a stable hex digest for the same input", () => {
    const a = hashClientIp("203.0.113.7");
    const b = hashClientIp("203.0.113.7");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("never returns the raw IP", () => {
    expect(hashClientIp("203.0.113.7")).not.toContain("203.0.113.7");
    expect(getClientIp(requestWithIp("203.0.113.7"))).not.toContain(
      "203.0.113.7"
    );
  });

  it("produces different digests for different IPs", () => {
    expect(hashClientIp("203.0.113.7")).not.toBe(hashClientIp("203.0.113.8"));
  });

  it("changes with the configured secret", () => {
    vi.stubEnv("RATE_LIMIT_IP_SECRET", "secret-one");
    resetRateLimitStores();
    const one = hashClientIp("203.0.113.7");

    vi.stubEnv("RATE_LIMIT_IP_SECRET", "secret-two");
    resetRateLimitStores();
    const two = hashClientIp("203.0.113.7");

    expect(one).not.toBe(two);
  });

  it("keeps rate limiting effective under hashed keys", () => {
    const ip = requestWithIp("203.0.113.42");
    const max = RATE_LIMIT_CONFIG.text.max;
    for (let i = 0; i < max; i++) {
      expect(checkRateLimit("text", ip)).toBeNull();
    }
    const res = checkRateLimit("text", ip);
    expect(res?.status).toBe(429);
  });
});

describe("sweepRateLimitStore (issue #4 / F1)", () => {
  it("removes fully-stale entries", () => {
    isAllowed("text", "stale-client", T0);
    // Advance well past the 60s window.
    const removed = sweepRateLimitStore("text", T0 + 61_000);
    expect(removed).toBe(1);
    expect(getRateLimitStore("text").size).toBe(0);
  });

  it("keeps live clients while trimming expired hits inside them", () => {
    // Five hits at T0 (well under the text cap so a fresh hit is admitted).
    for (let i = 0; i < 5; i++) {
      isAllowed("text", "mixed-client", T0);
    }
    // One fresh hit keeps the client alive; hits at T0 expire at T0+60s.
    expect(isAllowed("text", "mixed-client", T0 + 59_000).allowed).toBe(true);
    sweepRateLimitStore("text", T0 + 60_500);

    const hits = getRateLimitStore("text").get("mixed-client") ?? [];
    expect(hits).toEqual([T0 + 59_000]);
  });

  it("evicts least-recently-active clients when the cap is exceeded", () => {
    const store = getRateLimitStore("text");
    const now = T0;
    for (let i = 0; i < MAX_TRACKED_CLIENTS + 5; i++) {
      store.set(`client-${String(i).padStart(6, "0")}`, [now - 1_000 + i]);
    }
    expect(store.size).toBe(MAX_TRACKED_CLIENTS + 5);

    sweepRateLimitStore("text", now);

    expect(store.size).toBe(MAX_TRACKED_CLIENTS);
    // The five least-recently-active clients are evicted; the newest kept.
    expect(store.has("client-000000")).toBe(false);
    expect(store.has("client-000004")).toBe(false);
    expect(store.has("client-000005")).toBe(true);
    expect(
      store.has(`client-${String(MAX_TRACKED_CLIENTS + 4).padStart(6, "0")}`)
    ).toBe(true);
  });

  it("runs at most once per sweep interval when called from isAllowed", () => {
    // First call triggers the initial sweep and records the timestamp.
    isAllowed("text", "client-a", T0);
    // Seed a fully-stale entry by hand.
    getRateLimitStore("text").set("dead", [T0 - 61_000]);

    // Within the interval: no sweep runs, the stale entry survives.
    isAllowed("text", "client-b", T0 + 1);
    expect(getRateLimitStore("text").has("dead")).toBe(true);

    // Past the interval: the next isAllowed sweeps it away.
    isAllowed("text", "client-c", T0 + 60_001);
    expect(getRateLimitStore("text").has("dead")).toBe(false);
  });
});

describe("getClientIp (hashed output)", () => {
  it("prefers the first x-forwarded-for value, hashed", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" },
    });
    expect(getClientIp(req)).toBe(hashClientIp("203.0.113.7"));
  });

  it("falls back to x-real-ip, hashed", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "198.51.100.2" },
    });
    expect(getClientIp(req)).toBe(hashClientIp("198.51.100.2"));
  });

  it("returns a stable hash for 'unknown' when no headers exist", () => {
    const req = new Request("http://localhost/");
    expect(getClientIp(req)).toBe(hashClientIp("unknown"));
  });

  it("still prefers x-forwarded-for over x-real-ip when both exist", () => {
    const req = new Request("http://localhost/", {
      headers: {
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        "x-real-ip": "198.51.100.2",
      },
    });
    expect(getClientIp(req)).toBe(hashClientIp("203.0.113.7"));
  });
});

describe("checkRateLimit (route guard)", () => {
  it("returns null while the client is within the cap", () => {
    expect(checkRateLimit("text", requestWithIp("203.0.113.7"))).toBeNull();
  });

  it("returns a 429 response with Retry-After once over the cap", async () => {
    const ip = "203.0.113.99";
    const max = RATE_LIMIT_CONFIG.text.max;
    for (let i = 0; i < max; i++) {
      checkRateLimit("text", requestWithIp(ip));
    }

    const res = checkRateLimit("text", requestWithIp(ip));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    expect(res!.headers.get("Retry-After")).toMatch(/^\d+$/);

    const body = await res!.json();
    expect(body.error).toContain("Too many requests");
    expect(typeof body.retryAfterSeconds).toBe("number");
  });

  it("keeps distinct clients isolated under hashing", () => {
    expect(checkRateLimit("video", requestWithIp("198.51.100.1"))).toBeNull();
    expect(checkRateLimit("video", requestWithIp("198.51.100.2"))).toBeNull();
  });
});
