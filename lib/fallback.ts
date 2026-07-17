import {
  Provider,
  ProviderInput,
  DetectionResult,
  ProviderUnavailableError,
} from "./providers/types";

const PROVIDER_TIMEOUT_MS = 8000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  providerName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new ProviderUnavailableError(providerName, "timeout")),
        ms
      )
    ),
  ]);
}

/**
 * Tries each provider in priority order, stopping at the first success.
 * A provider "failing" (quota, bad key, timeout, 5xx, malformed response)
 * is expected and silently moves on to the next one — only exhausting the
 * entire list is an error the caller needs to surface.
 */
export async function detectWithFallback(
  providers: Provider[],
  input: ProviderInput
): Promise<DetectionResult> {
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const result = await withTimeout(
        provider.detect(input),
        PROVIDER_TIMEOUT_MS,
        provider.name
      );
      return result;
    } catch (err) {
      const reason = err instanceof Error ? err.message : "unknown error";
      console.warn(
        `[fallback] ${provider.name} failed: ${reason}. Trying next provider...`
      );
      errors.push(`${provider.name}: ${reason}`);
      continue;
    }
  }

  throw new Error(`All providers failed:\n${errors.join("\n")}`);
}
