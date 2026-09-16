import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getHealthReport, getProviderStatus } from "@/lib/health";

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getProviderStatus", () => {
  it("marks a provider configured when its keys are present and non-blank", () => {
    vi.stubEnv("SAPLING_API_KEY", "key");
    vi.stubEnv("SIGHTENGINE_API_USER", "user");
    vi.stubEnv("SIGHTENGINE_API_SECRET", "secret");

    const statuses = getProviderStatus();
    const sapling = statuses.find((p) => p.id === "sapling");
    const sightengineImage = statuses.find(
      (p) => p.id === "sightengine" && p.modality === "image"
    );

    expect(sapling?.configured).toBe(true);
    expect(sightengineImage?.configured).toBe(true);
  });

  it("treats blank keys as unconfigured", () => {
    vi.stubEnv("SAPLING_API_KEY", "   ");

    const sapling = getProviderStatus().find((p) => p.id === "sapling");
    expect(sapling?.configured).toBe(false);
  });

  it("shares Sightengine credential state across image, audio, and video", () => {
    vi.stubEnv("SIGHTENGINE_API_USER", "user");
    vi.stubEnv("SIGHTENGINE_API_SECRET", "secret");

    const sightengine = getProviderStatus().filter((p) =>
      p.id.startsWith("sightengine")
    );

    expect(sightengine).toHaveLength(3);
    expect(sightengine.every((p) => p.configured)).toBe(true);
    expect(sightengine.map((p) => p.modality).sort()).toEqual([
      "audio",
      "image",
      "video",
    ]);
  });

  it("never reports stubs as configured", () => {
    const stubs = getProviderStatus().filter((p) => p.role === "stub");

    expect(stubs.length).toBeGreaterThan(0);
    for (const stub of stubs) {
      expect(stub.configured).toBe(false);
      expect(stub.note).toBeTruthy();
    }
  });
});

describe("getHealthReport", () => {
  it("reports ok when at least one provider is configured", () => {
    vi.stubEnv("SAPLING_API_KEY", "key");

    const report = getHealthReport();
    expect(report.status).toBe("ok");
  });

  it("reports degraded when no provider keys are configured", () => {
    const report = getHealthReport();
    expect(report.status).toBe("degraded");
  });

  it("includes uptime, timestamp, and the full provider list", () => {
    const report = getHealthReport(new Date("2026-09-16T00:00:00Z"));

    expect(typeof report.uptimeSeconds).toBe("number");
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(report.timestamp).toBe("2026-09-16T00:00:00.000Z");
    expect(report.providers.length).toBeGreaterThanOrEqual(6);
  });

  it("never throws when the environment is entirely empty", () => {
    expect(() => getHealthReport()).not.toThrow();
  });
});
