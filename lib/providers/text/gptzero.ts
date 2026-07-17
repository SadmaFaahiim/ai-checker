import axios from "axios";
import {
  Provider,
  ProviderInput,
  DetectionResult,
  ProviderUnavailableError,
} from "../types";

interface GptZeroResponse {
  documents?: Array<{
    class_probabilities?: {
      ai?: number;
      human?: number;
      mixed?: number;
    };
  }>;
}

/** Primary text provider — best independent accuracy, but capped at 7 scans/hour on the free tier. */
export const gptZeroProvider: Provider = {
  name: "gptzero",
  async detect(input: ProviderInput): Promise<DetectionResult> {
    if (input.kind !== "text") {
      throw new Error("gptzero only supports text input");
    }

    const apiKey = process.env.GPTZERO_API_KEY;
    if (!apiKey) {
      throw new ProviderUnavailableError("gptzero", "missing API key");
    }

    try {
      const res = await axios.post<GptZeroResponse>(
        "https://api.gptzero.me/v2/predict/text",
        { document: input.text },
        {
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      const doc = res.data?.documents?.[0];
      const aiProb = doc?.class_probabilities?.ai;

      if (typeof aiProb !== "number") {
        throw new ProviderUnavailableError("gptzero", "unexpected response shape");
      }

      return { aiProbability: aiProb, providerName: "gptzero", raw: res.data };
    } catch (err) {
      if (err instanceof ProviderUnavailableError) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429) {
          throw new ProviderUnavailableError("gptzero", "quota exceeded");
        }
        if (status === 401 || status === 403) {
          throw new ProviderUnavailableError("gptzero", "invalid API key");
        }
        if (status && status >= 500) {
          throw new ProviderUnavailableError("gptzero", `server error (${status})`);
        }
        throw new ProviderUnavailableError("gptzero", err.message);
      }

      const reason = err instanceof Error ? err.message : "request failed";
      throw new ProviderUnavailableError("gptzero", reason);
    }
  },
};
