/**
 * Next.js client instrumentation hook — runs once in the browser.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  // Dynamic import so the SDK is only loaded when actually initializing.
  const { initSentryClient } = await import("./lib/sentry");
  initSentryClient();
}
