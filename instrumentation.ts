/**
 * Next.js instrumentation hook — runs once when the server process boots.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register(): Promise<void> {
  // Dynamic import so the SDK is only loaded when actually initializing.
  const { initSentryServer } = await import("./lib/sentry");
  initSentryServer();
}
