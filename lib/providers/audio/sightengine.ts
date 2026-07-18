import axios from "axios";
import FormData from "form-data";
import {
  Provider,
  ProviderInput,
  DetectionResult,
  ProviderUnavailableError,
} from "../types";

interface SightengineResponse {
  type?: {
    ai_generated?: number;
    ai_speech?: number;
    ai_music?: number;
  };
  status?: string;
}

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/flac": "flac",
  "audio/webm": "webm",
};

/** Primary audio provider — same documented REST API family as the image endpoint. */
export const sightengineAudioProvider: Provider = {
  name: "sightengine",
  async detect(input: ProviderInput): Promise<DetectionResult> {
    if (input.kind !== "audio") {
      throw new Error("sightengine audio provider only supports audio");
    }

    const apiUser = process.env.SIGHTENGINE_API_USER;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;
    if (!apiUser || !apiSecret) {
      throw new ProviderUnavailableError("sightengine-audio", "missing API credentials");
    }

    try {
      const form = new FormData();
      const extension = EXTENSION_BY_MIME_TYPE[input.mimeType] ?? "mp3";
      form.append("audio", input.buffer, {
        filename: `upload.${extension}`,
        contentType: input.mimeType,
      });
      form.append("models", "genai");
      form.append("api_user", apiUser);
      form.append("api_secret", apiSecret);

      const res = await axios.post<SightengineResponse>(
        "https://api.sightengine.com/1.0/audio/check.json",
        form,
        { headers: form.getHeaders() }
      );

      const type = res.data?.type;
      const aiProb = type?.ai_generated ?? type?.ai_speech ?? type?.ai_music;
      if (typeof aiProb !== "number") {
        throw new ProviderUnavailableError("sightengine-audio", "unexpected response shape");
      }

      return { aiProbability: aiProb, providerName: "sightengine", raw: res.data };
    } catch (err) {
      if (err instanceof ProviderUnavailableError) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429) {
          throw new ProviderUnavailableError("sightengine-audio", "quota exceeded");
        }
        if (status === 401 || status === 403) {
          throw new ProviderUnavailableError("sightengine-audio", "invalid API credentials");
        }
        if (status && status >= 500) {
          throw new ProviderUnavailableError("sightengine-audio", `server error (${status})`);
        }
        throw new ProviderUnavailableError("sightengine-audio", err.message);
      }

      const reason = err instanceof Error ? err.message : "request failed";
      throw new ProviderUnavailableError("sightengine-audio", reason);
    }
  },
};
