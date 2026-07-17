import { Provider, DetectionResult, ProviderUnavailableError } from "../types";

/**
 * Text last resort. ZeroGPT does not currently publish a documented,
 * authenticated API (its detector is web-tool only) — per the guideline's
 * instruction to verify terms before wiring a provider in, this is stubbed
 * to fail fast so the fallback chain moves on immediately rather than
 * hanging on a request to an endpoint that doesn't exist.
 */
export const zeroGptProvider: Provider = {
  name: "zerogpt",
  async detect(): Promise<DetectionResult> {
    throw new ProviderUnavailableError(
      "zerogpt",
      "no documented authenticated API available — not wired in"
    );
  },
};
