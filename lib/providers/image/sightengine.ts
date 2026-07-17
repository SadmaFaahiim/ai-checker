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
  };
  status?: string;
}

/** Primary image provider — documented REST API, 2,000 free ops/month. */
export const sightengineImageProvider: Provider = {
  name: "sightengine",
  async detect(input: ProviderInput): Promise<DetectionResult> {
    if (input.kind !== "image") {
      throw new Error("sightengine image provider only supports images");
    }

    const apiUser = process.env.SIGHTENGINE_API_USER;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;
    if (!apiUser || !apiSecret) {
      throw new ProviderUnavailableError("sightengine", "missing API credentials");
    }

    try {
      const form = new FormData();
      const extension = input.mimeType === "image/png" ? "png" : "jpg";
      form.append("media", input.buffer, {
        filename: `upload.${extension}`,
        contentType: input.mimeType,
      });
      form.append("models", "genai");
      form.append("api_user", apiUser);
      form.append("api_secret", apiSecret);

      const res = await axios.post<SightengineResponse>(
        "https://api.sightengine.com/1.0/check.json",
        form,
        { headers: form.getHeaders() }
      );

      const aiProb = res.data?.type?.ai_generated;
      if (typeof aiProb !== "number") {
        throw new ProviderUnavailableError("sightengine", "unexpected response shape");
      }

      return { aiProbability: aiProb, providerName: "sightengine", raw: res.data };
    } catch (err) {
      if (err instanceof ProviderUnavailableError) throw err;

      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429) {
          throw new ProviderUnavailableError("sightengine", "quota exceeded");
        }
        if (status === 401 || status === 403) {
          throw new ProviderUnavailableError("sightengine", "invalid API credentials");
        }
        if (status && status >= 500) {
          throw new ProviderUnavailableError("sightengine", `server error (${status})`);
        }
        throw new ProviderUnavailableError("sightengine", err.message);
      }

      const reason = err instanceof Error ? err.message : "request failed";
      throw new ProviderUnavailableError("sightengine", reason);
    }
  },
};
