import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import FormData from "form-data";
import { sightengineAudioProvider } from "@/lib/providers/audio/sightengine";
import { aiOrNotAudioProvider } from "@/lib/providers/audio/aiornot";
import { ProviderUnavailableError } from "@/lib/providers/types";

/**
 * Audio adapter tests — HTTP fully mocked via the axios module mock.
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

const audioInput = {
  kind: "audio" as const,
  buffer: Buffer.from("fake audio bytes"),
  mimeType: "audio/mpeg",
};

beforeEach(() => {
  postMock.mockReset();
  vi.stubEnv("SIGHTENGINE_API_USER", "test-user");
  vi.stubEnv("SIGHTENGINE_API_SECRET", "test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sightengineAudioProvider", () => {
  it("maps type.ai_generated to aiProbability on the happy path", async () => {
    postMock.mockResolvedValueOnce({
      data: { status: "success", type: { ai_generated: 0.87 } },
    });

    const result = await sightengineAudioProvider.detect(audioInput);

    expect(result.aiProbability).toBe(0.87);
    expect(result.providerName).toBe("sightengine");
    expect(result.raw).toEqual({ status: "success", type: { ai_generated: 0.87 } });
  });

  it.each([
    ["ai_speech", { ai_speech: 0.64 }],
    ["ai_music", { ai_music: 0.31 }],
  ])("falls back to %s when ai_generated is absent", async (_field, type) => {
    postMock.mockResolvedValueOnce({ data: { type } });
    const result = await sightengineAudioProvider.detect(audioInput);
    expect(result.aiProbability).toBe(Object.values(type)[0]);
  });

  it("posts multipart form with model, credentials and the right extension", async () => {
    postMock.mockResolvedValueOnce({ data: { type: { ai_generated: 0.5 } } });

    await sightengineAudioProvider.detect({
      ...audioInput,
      mimeType: "audio/wav",
    });

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body] = postMock.mock.calls[0];

    expect(url).toBe("https://api.sightengine.com/1.0/audio/check.json");
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;

    expect(form.getHeaders()["content-type"]).toContain("multipart");

    // The multipart payload embeds the file content, the extension derived
    // from the MIME map, the model selector and the credentials.
    const payload = form.getBuffer().toString("latin1");
    expect(payload).toContain("fake audio bytes");
    expect(payload).toContain("upload.wav");
    expect(payload).toContain("genai");
    expect(payload).toContain("test-user");
    expect(payload).toContain("test-secret");
  });

  it("throws ProviderUnavailableError when credentials are missing", async () => {
    vi.stubEnv("SIGHTENGINE_API_USER", "");
    vi.stubEnv("SIGHTENGINE_API_SECRET", "");

    await expect(sightengineAudioProvider.detect(audioInput)).rejects.toThrow(
      ProviderUnavailableError
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it("rejects non-audio input kinds", async () => {
    const imageInput = {
      kind: "image" as const,
      buffer: Buffer.from("x"),
      mimeType: "image/png",
    };
    await expect(sightengineAudioProvider.detect(imageInput)).rejects.toThrow(
      /only supports audio/i
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it("throws ProviderUnavailableError on unexpected response shape", async () => {
    postMock.mockResolvedValueOnce({ data: { status: "success" } });

    await expect(sightengineAudioProvider.detect(audioInput)).rejects.toThrow(
      ProviderUnavailableError
    );
  });

  it.each([
    [429, "quota exceeded"],
    [401, "invalid API credentials"],
    [403, "invalid API credentials"],
    [503, "server error"],
  ])("maps HTTP %d to a failover error mentioning %s", async (status, expected) => {
    postMock.mockRejectedValue(axiosError(status));

    try {
      await sightengineAudioProvider.detect(audioInput);
      expect.unreachable("should have thrown");
    } catch (err) {
      const providerErr = err as ProviderUnavailableError;
      expect(providerErr).toBeInstanceOf(ProviderUnavailableError);
      expect(providerErr.reason).toContain(expected);
    }
  });

  it("maps generic axios errors with their message", async () => {
    postMock.mockRejectedValueOnce(axiosError(undefined, "connect ECONNREFUSED"));

    try {
      await sightengineAudioProvider.detect(audioInput);
      expect.unreachable("should have thrown");
    } catch (err) {
      const providerErr = err as ProviderUnavailableError;
      expect(providerErr).toBeInstanceOf(ProviderUnavailableError);
      expect(providerErr.reason).toBe("connect ECONNREFUSED");
    }
  });

  it("maps non-axios throws (e.g. form serialization failures)", async () => {
    postMock.mockRejectedValueOnce(new Error("boom"));

    try {
      await sightengineAudioProvider.detect(audioInput);
      expect.unreachable("should have thrown");
    } catch (err) {
      const providerErr = err as ProviderUnavailableError;
      expect(providerErr).toBeInstanceOf(ProviderUnavailableError);
      expect(providerErr.reason).toBe("boom");
    }
  });
});

describe("aiOrNotAudioProvider (stub)", () => {
  it("fails fast with a ProviderUnavailableError", async () => {
    await expect(aiOrNotAudioProvider.detect(audioInput)).rejects.toThrow(
      ProviderUnavailableError
    );

    try {
      await aiOrNotAudioProvider.detect(audioInput);
    } catch (err) {
      const providerErr = err as ProviderUnavailableError;
      expect(providerErr.providerName).toBe("aiornot-audio");
      expect(providerErr.reason).toBe("no confirmed audio API");
    }
  });

  it("never makes network calls", async () => {
    await aiOrNotAudioProvider.detect(audioInput).catch(() => {});
    expect(postMock).not.toHaveBeenCalled();
  });
});
