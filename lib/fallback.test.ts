import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectWithFallback } from "@/lib/fallback";
import {
  DetectionResult,
  Provider,
  ProviderUnavailableError,
} from "@/lib/providers/types";

function okResult(providerName: string, aiProbability = 0.5): DetectionResult {
  return { aiProbability, providerName };
}

function failingProvider(name: string, reason: string): Provider {
  return {
    name,
    detect: vi.fn().mockRejectedValue(new ProviderUnavailableError(name, reason)),
  };
}

function succeedingProvider(name: string, aiProbability = 0.5): Provider {
  return {
    name,
    detect: vi.fn().mockResolvedValue(okResult(name, aiProbability)),
  };
}

const textInput = { kind: "text" as const, text: "sample text input" };

describe("detectWithFallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the first provider's result without calling later providers", async () => {
    const first = succeedingProvider("primary");
    const second = succeedingProvider("secondary");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await detectWithFallback([first, second], textInput);

    expect(result.providerName).toBe("primary");
    expect(first.detect).toHaveBeenCalledTimes(1);
    expect(second.detect).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls through to the next provider when the first fails", async () => {
    const first = failingProvider("primary", "rate limit");
    const second = succeedingProvider("secondary");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await detectWithFallback([first, second], textInput);

    expect(result.providerName).toBe("secondary");
    expect(first.detect).toHaveBeenCalledTimes(1);
    expect(second.detect).toHaveBeenCalledTimes(1);
  });

  it("tries every provider in order and returns the first success", async () => {
    const p1 = failingProvider("p1", "quota");
    const p2 = failingProvider("p2", "bad key");
    const p3 = succeedingProvider("p3");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await detectWithFallback([p1, p2, p3], textInput);

    expect(result.providerName).toBe("p3");
    expect(p3.detect).toHaveBeenCalledTimes(1);
  });

  it("logs a warning naming the failed provider and reason", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = failingProvider("primary", "quota exceeded");
    const second = succeedingProvider("secondary");

    await detectWithFallback([first, second], textInput);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("[fallback] primary failed:")
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("quota exceeded")
    );
  });

  it("aggregates every failure reason when all providers fail", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const p1 = failingProvider("p1", "quota");
    const p2 = failingProvider("p2", "bad key");
    const p3 = failingProvider("p3", "server error");

    const err = await detectWithFallback([p1, p2, p3], textInput).catch(
      (e: unknown) => e
    );

    expect(err).toBeInstanceOf(Error);
    const message = (err as Error).message;
    expect(message).toContain("All providers failed");
    expect(message).toContain("p1: p1 unavailable: quota");
    expect(message).toContain("p2: p2 unavailable: bad key");
    expect(message).toContain("p3: p3 unavailable: server error");
  });

  it("survives a provider that throws a non-Error value", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwingProvider: Provider = {
      name: "weird",
      detect: vi.fn().mockRejectedValue("boom"),
    };
    const second = succeedingProvider("secondary");

    const result = await detectWithFallback([throwingProvider, second], textInput);

    expect(result.providerName).toBe("secondary");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("unknown error")
    );
  });

  it("survives a provider whose detect is not a function", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = { name: "broken" } as unknown as Provider;
    const second = succeedingProvider("secondary");

    const result = await detectWithFallback([broken, second], textInput);

    expect(result.providerName).toBe("secondary");
  });

  it("moves past a provider that times out", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const slow: Provider = {
      name: "slow",
      detect: vi.fn().mockImplementation(
        () =>
          new Promise<DetectionResult>((resolve) => setTimeout(resolve, 10_000))
      ),
    };
    const fast = succeedingProvider("fast");

    const promise = detectWithFallback([slow, fast], textInput);
    await vi.advanceTimersByTimeAsync(8_001);

    const result = await promise;
    expect(result.providerName).toBe("fast");
  });
});
