import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { saplingProvider } from "@/lib/providers/text/sapling";
import { gptZeroProvider } from "@/lib/providers/text/gptzero";
import { zeroGptProvider } from "@/lib/providers/text/zerogpt";
import { sightengineImageProvider } from "@/lib/providers/image/sightengine";
import { aiOrNotImageProvider } from "@/lib/providers/image/aiornot";
import { Provider, ProviderUnavailableError } from "@/lib/providers/types";

/**
 * Adapter tests — all HTTP is mocked via the axios module mock below.
 * No test in this file ever touches the network.
 */

type AxiosLikeError = Error & {
  isAxiosError?: boolean;
  response?: { status?: number };
};

vi.mock("axios", () => {
  const isAxiosError = (err: unknown): err is AxiosLikeError =>
    typeof err === "object" &&
    err !== null &&
    (err as { isAxiosError?: boolean }).isAxiosError === true;
  return {
    default: {
      post: vi.fn(),
      isAxiosError,
    },
  };
});

function axiosError(status?: number, message = "request failed"): AxiosLikeError {
  const err = new Error(message) as AxiosLikeError;
  err.isAxiosError = true;
  if (status !== undefined) err.response = { status };
  return err;
}

const postMock = vi.mocked(axios.post);

const textInput = { kind: "text" as const, text: "a sentence to analyze" };
const imageInput = {
  kind: "image" as const,
  buffer: Buffer.from("fake image bytes"),
  mimeType: "image/png",
};

beforeEach(() => {
  postMock.mockReset();
  vi.stubEnv("SAPLING_API_KEY", "test-sapling-key");
  vi.stubEnv("GPTZERO_API_KEY", "test-gptzero-key");
  vi.stubEnv("SIGHTENGINE_API_USER", "test-user");
  vi.stubEnv("SIGHTENGINE_API_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("saplingProvider (text)", () => {
  it("normalizes the vendor score into aiProbability and reports its name", async () => {
    postMock.mockResolvedValue({ data: { score: 0.87 } });

    const result = await saplingProvider.detect(textInput);

    expect(result).toMatchObject({ aiProbability: 0.87, providerName: "sapling" });
  });

  it("sends the API key and text in the documented payload shape", async () => {
    postMock.mockResolvedValue({ data: { score: 0.1 } });

    await saplingProvider.detect(textInput);

    expect(postMock).toHaveBeenCalledWith(
      "https://api.sapling.ai/api/v1/aidetect",
      { key: "test-sapling-key", text: "a sentence to analyze" }
    );
  });

  it("fails over without an HTTP call when the API key is missing", async () => {
    vi.stubEnv("SAPLING_API_KEY", "");

    await expect(saplingProvider.detect(textInput)).rejects.toThrowError(
      ProviderUnavailableError
    );
    await expect(saplingProvider.detect(textInput)).rejects.toThrow(
      /missing API key/
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it.each([
    [429, "quota exceeded"],
    [401, "invalid API key"],
    [403, "invalid API key"],
    [500, "server error (500)"],
    [503, "server error (503)"],
  ])("maps HTTP %i to a failover with reason '%s'", async (status, reason) => {
    postMock.mockRejectedValue(axiosError(status));

    const err = await saplingProvider.detect(textInput).catch((e) => e);

    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect((err as ProviderUnavailableError).reason).toBe(reason);
  });

  it("fails over on a malformed response shape", async () => {
    postMock.mockResolvedValue({ data: {} });

    const err = await saplingProvider.detect(textInput).catch((e) => e);

    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect((err as ProviderUnavailableError).reason).toBe(
      "unexpected response shape"
    );
  });

  it("rejects non-text input kinds outright", async () => {
    await expect(saplingProvider.detect(imageInput)).rejects.toThrow(
      "sapling only supports text input"
    );
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe("gptZeroProvider (text)", () => {
  it("extracts the AI class probability from the documents array", async () => {
    postMock.mockResolvedValue({
      data: { documents: [{ class_probabilities: { ai: 0.42 } }] },
    });

    const result = await gptZeroProvider.detect(textInput);

    expect(result).toMatchObject({ aiProbability: 0.42, providerName: "gptzero" });
  });

  it("authenticates via the x-api-key header", async () => {
    postMock.mockResolvedValue({
      data: { documents: [{ class_probabilities: { ai: 0.2 } }] },
    });

    await gptZeroProvider.detect(textInput);

    expect(postMock).toHaveBeenCalledWith(
      "https://api.gptzero.me/v2/predict/text",
      { document: "a sentence to analyze" },
      expect.objectContaining({
        headers: expect.objectContaining({ "x-api-key": "test-gptzero-key" }),
      })
    );
  });

  it("fails over when the API key is missing", async () => {
    vi.stubEnv("GPTZERO_API_KEY", "");

    await expect(gptZeroProvider.detect(textInput)).rejects.toThrow(
      /missing API key/
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it("fails over when the response has no documents", async () => {
    postMock.mockResolvedValue({ data: {} });

    const err = await gptZeroProvider.detect(textInput).catch((e) => e);

    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect((err as ProviderUnavailableError).reason).toBe(
      "unexpected response shape"
    );
  });

  it("maps 429 to quota exceeded", async () => {
    postMock.mockRejectedValue(axiosError(429));

    const err = await gptZeroProvider.detect(textInput).catch((e) => e);

    expect((err as ProviderUnavailableError).reason).toBe("quota exceeded");
  });
});

describe("stubbed providers fail fast", () => {
  it("zerogpt always fails over — it has no documented API", async () => {
    const err = await zeroGptProvider.detect(textInput).catch((e) => e);

    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect((err as ProviderUnavailableError).providerName).toBe("zerogpt");
    expect((err as ProviderUnavailableError).reason).toContain("not wired in");
  });

  it("aiornot (image) always fails over — no confirmed API", async () => {
    const err = await aiOrNotImageProvider.detect(imageInput).catch((e) => e);

    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect((err as ProviderUnavailableError).providerName).toBe("aiornot");
    expect((err as ProviderUnavailableError).reason).toContain("not wired in");
  });
});

describe("sightengineImageProvider (image)", () => {
  it("normalizes type.ai_generated into aiProbability", async () => {
    postMock.mockResolvedValue({ data: { type: { ai_generated: 0.66 } } });

    const result = await sightengineImageProvider.detect(imageInput);

    expect(result).toMatchObject({
      aiProbability: 0.66,
      providerName: "sightengine",
    });
  });

  it("fails over when credentials are missing", async () => {
    vi.stubEnv("SIGHTENGINE_API_USER", "");
    vi.stubEnv("SIGHTENGINE_API_SECRET", "");

    await expect(sightengineImageProvider.detect(imageInput)).rejects.toThrow(
      /missing API credentials/
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it("fails over on a malformed response", async () => {
    postMock.mockResolvedValue({ data: { status: "success" } });

    const err = await sightengineImageProvider.detect(imageInput).catch((e) => e);

    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect((err as ProviderUnavailableError).reason).toBe(
      "unexpected response shape"
    );
  });

  it("maps 5xx to a server error failover", async () => {
    postMock.mockRejectedValue(axiosError(502));

    const err = await sightengineImageProvider.detect(imageInput).catch((e) => e);

    expect((err as ProviderUnavailableError).reason).toBe("server error (502)");
  });

  it.each([
    [429, "quota exceeded"],
    [401, "invalid API credentials"],
    [403, "invalid API credentials"],
  ])("maps HTTP %d to a failover reason: %s", async (status, expected) => {
    postMock.mockRejectedValue(axiosError(status));

    try {
      await sightengineImageProvider.detect(imageInput);
      expect.unreachable("should have thrown");
    } catch (err) {
      const providerErr = err as ProviderUnavailableError;
      expect(providerErr).toBeInstanceOf(ProviderUnavailableError);
      expect(providerErr.reason).toBe(expected);
    }
  });

  it("maps generic axios errors with their message", async () => {
    postMock.mockRejectedValue(axiosError(undefined, "connect ECONNREFUSED"));

    const err = await sightengineImageProvider.detect(imageInput).catch((e) => e);

    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect((err as ProviderUnavailableError).reason).toBe("connect ECONNREFUSED");
  });

  it("maps non-axios throws with their message", async () => {
    postMock.mockRejectedValue(new Error("form serialization failed"));

    const err = await sightengineImageProvider.detect(imageInput).catch((e) => e);

    expect(err).toBeInstanceOf(ProviderUnavailableError);
    expect((err as ProviderUnavailableError).reason).toBe(
      "form serialization failed"
    );
  });

  it("sends the multipart payload with model and credentials", async () => {
    postMock.mockResolvedValue({ data: { type: { ai_generated: 0.4 } } });

    await sightengineImageProvider.detect(imageInput);

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe("https://api.sightengine.com/1.0/check.json");
    const payload = (body as { getBuffer(): Buffer }).getBuffer().toString("latin1");
    expect(payload).toContain("fake image bytes");
    expect(payload).toContain("genai");
    expect(payload).toContain("test-user");
    expect(payload).toContain("test-secret");
  });

  it("rejects non-image input kinds outright", async () => {
    await expect(sightengineImageProvider.detect(textInput)).rejects.toThrow(
      "sightengine image provider only supports images"
    );
    expect(postMock).not.toHaveBeenCalled();
  });
});

describe("every adapter satisfies the Provider contract", () => {
  it("exposes a name and a detect function", () => {
    const providers: Provider[] = [
      saplingProvider,
      gptZeroProvider,
      zeroGptProvider,
      sightengineImageProvider,
      aiOrNotImageProvider,
    ];
    for (const p of providers) {
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
      expect(typeof p.detect).toBe("function");
    }
  });
});
