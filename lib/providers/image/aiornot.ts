import { Provider, DetectionResult, ProviderUnavailableError } from "../types";

/**
 * Image fallback #2. AI or Not has historically been a web-first tool
 * without mature, confirmed authenticated API docs. Per the guideline's
 * instruction to verify a genuine API exists before integrating, this is
 * stubbed to fail fast — swap in a real implementation once an
 * AIORNOT_API_KEY and documented endpoint are confirmed.
 */
export const aiOrNotImageProvider: Provider = {
  name: "aiornot",
  async detect(): Promise<DetectionResult> {
    throw new ProviderUnavailableError(
      "aiornot",
      "no confirmed authenticated API available — not wired in"
    );
  },
};
