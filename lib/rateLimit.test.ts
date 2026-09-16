import { beforeEach, describe, expect, it } from "vitest";
import {
  RATE_LIMIT_CONFIG,
  checkRateLimit,
  getClientIp,
  isAllowed,
  resetRateLimitStores,
} from "@/lib/rateLimit";

const T0 = 1_700_000_000_000;

function requestWithIp(ip: string): Request {
  return new Request("http://localhost/api/check/text", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  resetRateLimitStores();
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

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for value", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" },
    });
    expect(getClientIp(req)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "198.51.100.2" },
    });
    expect(getClientIp(req)).toBe("198.51.100.2");
  });

  it("returns 'unknown' when no identifying headers exist", () => {
    const req = new Request("http://localhost/");
    expect(getClientIp(req)).toBe("unknown");
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
});
