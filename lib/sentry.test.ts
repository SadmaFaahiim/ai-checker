import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captureExceptionMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

import {
  captureServerError,
  initSentryClient,
  initSentryServer,
  isSentryEnabled,
} from "@/lib/sentry";

beforeEach(() => {
  captureExceptionMock.mockReset();
  vi.stubEnv("SENTRY_DSN", "");
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSentryEnabled", () => {
  it("is false without any DSN", () => {
    expect(isSentryEnabled()).toBe(false);
  });

  it("is true when SENTRY_DSN is set", () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o0.ingest.sentry.io/1");
    expect(isSentryEnabled()).toBe(true);
  });

  it("is true when only NEXT_PUBLIC_SENTRY_DSN is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://key@o0.ingest.sentry.io/1");
    expect(isSentryEnabled()).toBe(true);
  });
});

describe("initSentryServer / initSentryClient", () => {
  it("never initializes without a DSN", async () => {
    initSentryServer();
    initSentryClient();

    const Sentry = await import("@sentry/nextjs");
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("initializes with the DSN and tracesSampleRate 0 when enabled", async () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o0.ingest.sentry.io/1");

    initSentryServer();

    const Sentry = await import("@sentry/nextjs");
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: "https://key@o0.ingest.sentry.io/1",
      })
    );
  });
});

describe("captureServerError", () => {
  it("is a no-op returning null without a DSN", () => {
    const err = new Error("all providers failed");
    expect(captureServerError(err, { route: "/api/check/text", modality: "text" })).toBeNull();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it("captures with route/modality tags and the error message", () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o0.ingest.sentry.io/1");
    const err = new Error("all providers failed: sapling (quota exceeded)");

    captureServerError(err, { route: "/api/check/text", modality: "text" });

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [exception, options] = captureExceptionMock.mock.calls[0];
    expect(exception).toBe(err);
    expect(options).toMatchObject({
      tags: { route: "/api/check/text", modality: "text" },
      extra: { message: "all providers failed: sapling (quota exceeded)" },
    });
  });

  it("stringifies non-Error throws", () => {
    vi.stubEnv("SENTRY_DSN", "https://key@o0.ingest.sentry.io/1");

    captureServerError("boom", { route: "/api/check/video", modality: "video" });

    const [, options] = captureExceptionMock.mock.calls[0];
    expect(options).toMatchObject({ extra: { message: "boom" } });
  });
});
