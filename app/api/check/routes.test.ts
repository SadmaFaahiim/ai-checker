import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { detectWithFallback } from "@/lib/fallback";
import { extractFrames } from "@/lib/videoFrames";
import { resetRateLimitStores } from "@/lib/rateLimit";
import { saplingProvider } from "@/lib/providers/text/sapling";
import { gptZeroProvider } from "@/lib/providers/text/gptzero";
import { zeroGptProvider } from "@/lib/providers/text/zerogpt";
import { sightengineImageProvider } from "@/lib/providers/image/sightengine";
import { aiOrNotImageProvider } from "@/lib/providers/image/aiornot";
import { sightengineAudioProvider } from "@/lib/providers/audio/sightengine";
import { aiOrNotAudioProvider } from "@/lib/providers/audio/aiornot";

import { POST as textPOST } from "./text/route";
import { POST as imagePOST } from "./image/route";
import { POST as audioPOST } from "./audio/route";
import { POST as videoPOST } from "./video/route";

/**
 * Route-integration tests (TASKS.md T5). The fallback orchestrator and the
 * FFmpeg frame extractor are mocked, so no provider HTTP call and no real
 * video decoding ever happens; the rate limiter runs for real (reset per test).
 */

vi.mock("@/lib/fallback", () => ({ detectWithFallback: vi.fn() }));
vi.mock("@/lib/videoFrames", () => ({ extractFrames: vi.fn() }));

const fallbackMock = vi.mocked(detectWithFallback);
const extractFramesMock = vi.mocked(extractFrames);

// ---- Request helpers -------------------------------------------------------

function textRequest(body: unknown, ip = "203.0.113.1"): NextRequest {
  return new NextRequest("http://localhost/api/check/text", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });
}

function formRequest(
  path: string,
  field: string,
  file: File,
  ip = "203.0.113.1"
): NextRequest {
  const form = new FormData();
  form.append(field, file, file.name);
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": ip },
  });
}

async function jsonOf(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

// ---- File fixtures (real magic-byte signatures, >= 12 bytes) ---------------

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(8, 0x01),
]);
const JPEG_BYTES = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(12, 0x11),
]);
const MP3_BYTES = Buffer.concat([
  Buffer.from([0x49, 0x44, 0x33, 0x04]),
  Buffer.alloc(12, 0x00),
]);
const MP4_BYTES = Buffer.concat([
  Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]),
  Buffer.alloc(8, 0x00),
]);
const EXE_BYTES = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.alloc(14, 0x00)]);

const pngFile = () => new File([PNG_BYTES], "t.png", { type: "image/png" });
const mp3File = () => new File([MP3_BYTES], "t.mp3", { type: "audio/mpeg" });
const mp4File = () => new File([MP4_BYTES], "t.mp4", { type: "video/mp4" });

const ok = (probability: number, provider = "test-provider") =>
  Promise.resolve({ aiProbability: probability, providerName: provider });

beforeEach(() => {
  vi.stubEnv("RATE_LIMIT_IP_SECRET", "test-secret");
  resetRateLimitStores();
  fallbackMock.mockReset();
  extractFramesMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---- POST /api/check/text ---------------------------------------------------

describe("POST /api/check/text", () => {
  it("returns the unified result shape on the happy path", async () => {
    fallbackMock.mockReturnValueOnce(ok(0.78, "sapling"));

    const res = await textPOST(
      textRequest({ text: "This is definitely at least twenty characters." })
    );

    expect(res.status).toBe(200);
    expect(await jsonOf(res)).toEqual({
      percentage: 78,
      verdict: "Likely AI-generated",
      provider: "sapling",
    });
  });

  it("calls the fallback with the sapling-first text chain", async () => {
    fallbackMock.mockReturnValueOnce(ok(0.1, "sapling"));

    await textPOST(textRequest({ text: "This is definitely at least twenty characters." }));

    const [providers, input] = fallbackMock.mock.calls[0];
    expect(providers).toEqual([saplingProvider, gptZeroProvider, zeroGptProvider]);
    expect(input).toEqual({
      kind: "text",
      text: "This is definitely at least twenty characters.",
    });
  });

  it("400s on an invalid JSON body", async () => {
    const res = await textPOST(textRequest("not-json{"));
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).error).toContain("Invalid JSON");
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("400s when text is shorter than 20 characters", async () => {
    const res = await textPOST(textRequest({ text: "too short" }));
    expect(res.status).toBe(400);
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("503s when every provider fails", async () => {
    fallbackMock.mockRejectedValueOnce(new Error("all providers failed"));

    const res = await textPOST(
      textRequest({ text: "This is definitely at least twenty characters." })
    );

    expect(res.status).toBe(503);
    expect((await jsonOf(res)).error).toContain("temporarily unavailable");
  });
});

// ---- POST /api/check/image --------------------------------------------------

describe("POST /api/check/image", () => {
  it("returns the unified result shape on the happy path", async () => {
    fallbackMock.mockReturnValueOnce(ok(0.12, "sightengine"));

    const res = await imagePOST(formRequest("/api/check/image", "image", pngFile()));

    expect(res.status).toBe(200);
    expect(await jsonOf(res)).toEqual({
      percentage: 12,
      verdict: "Likely Human",
      provider: "sightengine",
    });

    const [, input] = fallbackMock.mock.calls[0];
    expect(input).toMatchObject({ kind: "image", mimeType: "image/png" });
  });

  it("passes the image chain to the fallback", async () => {
    fallbackMock.mockReturnValueOnce(ok(0.1, "sightengine"));

    await imagePOST(formRequest("/api/check/image", "image", pngFile()));

    const [providers] = fallbackMock.mock.calls[0];
    expect(providers).toEqual([sightengineImageProvider, aiOrNotImageProvider]);
  });

  it("400s when no file is provided", async () => {
    const res = await imagePOST(formRequest("/api/check/image", "wrong", pngFile()));
    expect(res.status).toBe(400);
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("400s on an unsupported MIME type", async () => {
    const gif = new File([PNG_BYTES], "t.gif", { type: "image/gif" });
    const res = await imagePOST(formRequest("/api/check/image", "image", gif));
    expect(res.status).toBe(400);
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("400s when the file exceeds 10MB", async () => {
    const big = new File(
      [Buffer.alloc(10 * 1024 * 1024 + 1)],
      "big.png",
      { type: "image/png" }
    );
    const res = await imagePOST(formRequest("/api/check/image", "image", big));
    expect(res.status).toBe(400);
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("400s when declared MIME does not match the actual bytes (R3)", async () => {
    const spoofed = new File([JPEG_BYTES], "t.png", { type: "image/png" });
    const res = await imagePOST(formRequest("/api/check/image", "image", spoofed));

    expect(res.status).toBe(400);
    const body = await jsonOf(res);
    expect(String(body.error)).toContain("does not match");
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("400s on unrecognized bytes before any provider call", async () => {
    const exe = new File([EXE_BYTES], "t.png", { type: "image/png" });
    const res = await imagePOST(formRequest("/api/check/image", "image", exe));

    expect(res.status).toBe(400);
    expect(String((await jsonOf(res)).error)).toContain("Unrecognized");
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("503s when every provider fails", async () => {
    fallbackMock.mockRejectedValueOnce(new Error("all providers failed"));

    const res = await imagePOST(formRequest("/api/check/image", "image", pngFile()));
    expect(res.status).toBe(503);
  });

  it("429s once the per-IP image cap is exhausted", async () => {
    fallbackMock.mockReturnValue(ok(0.1, "sightengine"));

    let last: Response | undefined;
    for (let i = 0; i <= 10; i++) {
      last = await imagePOST(
        formRequest("/api/check/image", "image", pngFile(), "203.0.113.7")
      );
    }

    expect(last!.status).toBe(429);
    expect(last!.headers.get("Retry-After")).toMatch(/^\d+$/);
  });
});

// ---- POST /api/check/audio --------------------------------------------------

describe("POST /api/check/audio", () => {
  it("returns the unified result shape on the happy path", async () => {
    fallbackMock.mockReturnValueOnce(ok(0.23, "sightengine"));

    const res = await audioPOST(formRequest("/api/check/audio", "audio", mp3File()));

    expect(res.status).toBe(200);
    expect(await jsonOf(res)).toEqual({
      percentage: 23,
      verdict: "Likely Human",
      provider: "sightengine",
    });

    const [providers, input] = fallbackMock.mock.calls[0];
    expect(providers).toEqual([sightengineAudioProvider, aiOrNotAudioProvider]);
    expect(input).toMatchObject({ kind: "audio", mimeType: "audio/mpeg" });
  });

  it("400s when no file is provided", async () => {
    const res = await audioPOST(formRequest("/api/check/audio", "wrong", mp3File()));
    expect(res.status).toBe(400);
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("400s on an unsupported MIME type", async () => {
    const video = new File([MP4_BYTES], "t.mp4", { type: "video/mp4" });
    const res = await audioPOST(formRequest("/api/check/audio", "audio", video));
    expect(res.status).toBe(400);
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("400s when declared MIME does not match the actual bytes (R3)", async () => {
    const spoofed = new File([JPEG_BYTES], "t.mp3", { type: "audio/mpeg" });
    const res = await audioPOST(formRequest("/api/check/audio", "audio", spoofed));

    expect(res.status).toBe(400);
    expect(String((await jsonOf(res)).error)).toContain("does not match");
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("503s when every provider fails", async () => {
    fallbackMock.mockRejectedValueOnce(new Error("all providers failed"));

    const res = await audioPOST(formRequest("/api/check/audio", "audio", mp3File()));
    expect(res.status).toBe(503);
  });
});

// ---- POST /api/check/video --------------------------------------------------

describe("POST /api/check/video", () => {
  it("averages per-frame scores and returns the timeline on the happy path", async () => {
    extractFramesMock.mockResolvedValueOnce([JPEG_BYTES, JPEG_BYTES]);
    fallbackMock.mockImplementation(() => ok(0.4, "sightengine"));

    const res = await videoPOST(formRequest("/api/check/video", "video", mp4File()));

    expect(res.status).toBe(200);
    expect(await jsonOf(res)).toEqual({
      percentage: 40,
      verdict: "Uncertain",
      provider: "sightengine",
      perFrame: [40, 40],
    });
    // One fallback call per extracted frame, via the image chain.
    expect(fallbackMock).toHaveBeenCalledTimes(2);
    const [providers, input] = fallbackMock.mock.calls[0];
    expect(providers).toEqual([sightengineImageProvider, aiOrNotImageProvider]);
    expect(input).toMatchObject({ kind: "image", mimeType: "image/jpeg" });
  });

  it("400s when no file is provided", async () => {
    const res = await videoPOST(formRequest("/api/check/video", "wrong", mp4File()));
    expect(res.status).toBe(400);
    expect(extractFramesMock).not.toHaveBeenCalled();
  });

  it("400s on an unsupported MIME type", async () => {
    const webm = new File([MP4_BYTES], "t.webm", { type: "video/webm" });
    const res = await videoPOST(formRequest("/api/check/video", "video", webm));
    expect(res.status).toBe(400);
    expect(extractFramesMock).not.toHaveBeenCalled();
  });

  it("400s on spoofed bytes before any disk or provider work (R3)", async () => {
    const spoofed = new File([JPEG_BYTES], "t.mp4", { type: "video/mp4" });
    const res = await videoPOST(formRequest("/api/check/video", "video", spoofed));

    expect(res.status).toBe(400);
    expect(String((await jsonOf(res)).error)).toContain("does not match");
    expect(extractFramesMock).not.toHaveBeenCalled();
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("400s when frame extraction fails", async () => {
    extractFramesMock.mockRejectedValueOnce(new Error("ffmpeg exploded"));

    const res = await videoPOST(formRequest("/api/check/video", "video", mp4File()));

    expect(res.status).toBe(400);
    expect(String((await jsonOf(res)).error)).toContain("Could not read");
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("400s when no frames could be extracted", async () => {
    extractFramesMock.mockResolvedValueOnce([]);

    const res = await videoPOST(formRequest("/api/check/video", "video", mp4File()));

    expect(res.status).toBe(400);
    expect(String((await jsonOf(res)).error)).toContain("Could not extract any frames");
    expect(fallbackMock).not.toHaveBeenCalled();
  });

  it("503s when every provider fails for the frames", async () => {
    extractFramesMock.mockResolvedValueOnce([JPEG_BYTES]);
    fallbackMock.mockRejectedValue(new Error("all providers failed"));

    const res = await videoPOST(formRequest("/api/check/video", "video", mp4File()));
    expect(res.status).toBe(503);
  });
});
