import { Provider, DetectionResult, ProviderUnavailableError } from "../types";

/**
 * Audio fallback #2. Same situation as the image aiornot stub — no confirmed
 * authenticated audio API to integrate against yet. Stubbed to fail fast.
 */
export const aiOrNotAudioProvider: Provider = {
  name: "aiornot-audio",
  async detect(): Promise<DetectionResult> {
    throw new ProviderUnavailableError("aiornot-audio", "no confirmed audio API");
  },
};
