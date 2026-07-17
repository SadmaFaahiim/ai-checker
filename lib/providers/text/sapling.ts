import axios from "axios";
import {
  Provider,
  ProviderInput,
  DetectionResult,
  ProviderUnavailableError,
} from "../types";

interface SaplingResponse {
  score?: number;
  sentence_scores?: Array<{ text: string; score: number }>;
}

/** Text fallback #2 — simple JSON API, generous free-of-charge tier for low volume. */
export const saplingProvider: Provider = {
  name: "sapling",
  async detect(input: ProviderInput): Promise<DetectionResult> {
    if (input.kind !== "text") {
      throw new Error("sapling only supports text input");
    }

    const apiKey = process.env.SAPLING_API_KEY;
    if (!apiKey) {
      throw new ProviderUnavailableError("sapling", "missing API key");
    }

    try {
      const res = await axios.post<SaplingResponse>(
        "https://api.sapling.ai/api/v1/aidetect",
        {
          key: apiKey,
          text: input.text,
        }
      );

      const aiProb = res.data?.score;
      if (typeof aiProb !== "number") {
        throw new ProviderUnavailableError("sapling", "unexpected response shape");
      }

      return { aiProbability: aiProb, providerName: "sapling", raw: res.data };
    } catch (err) {
      if (err instanceof ProviderUnavailableError) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429) {
          throw new ProviderUnavailableError("sapling", "quota exceeded");
        }
        if (status === 401 || status === 403) {
          throw new ProviderUnavailableError("sapling", "invalid API key");
        }
        if (status && status >= 500) {
          throw new ProviderUnavailableError("sapling", `server error (${status})`);
        }
        throw new ProviderUnavailableError("sapling", err.message);
      }

      const reason = err instanceof Error ? err.message : "request failed";
      throw new ProviderUnavailableError("sapling", reason);
    }
  },
};
