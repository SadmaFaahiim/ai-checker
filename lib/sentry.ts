import * as Sentry from "@sentry/nextjs";

/**
 * Sentry error tracking (TASKS.md O2).
 *
 * SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN enables Sentry. Without one, every
 * helper here is a safe no-op — local development and CI stay silent, and
 * nothing in the request path depends on the SDK being active.
 *
 * The DSN is read at call time (not module load) so instrumentation hooks,
 * route handlers and tests all observe the same, current configuration.
 */

function getDsn(): string {
  return (
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || ""
  ).trim();
}

export function isSentryEnabled(): boolean {
  return getDsn().length > 0;
}

/** Initialize Sentry on the server (Node runtime). Safe to call unconditionally. */
export function initSentryServer(): void {
  const dsn = getDsn();
  if (!dsn) return;

  Sentry.init({
    dsn,
    // Errors captured explicitly via captureServerError (the check routes'
    // 503 paths) plus any unhandled route exceptions.
    tracesSampleRate: 0, // performance tracing off for the POC
    environment: process.env.NODE_ENV || "development",
  });
}

/** Initialize Sentry in the browser. Safe to call unconditionally. */
export function initSentryClient(): void {
  const dsn = getDsn();
  if (!dsn) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    environment: process.env.NODE_ENV || "development",
  });
}

/**
 * Capture a server-side error with route context. Used by the check routes'
 * all-providers-failed catch blocks, which previously only console.error'd.
 * Returns the Sentry event id (or null when Sentry is disabled).
 */
export function captureServerError(
  err: unknown,
  context: { route: string; modality: string }
): string | null {
  if (!isSentryEnabled()) return null;

  Sentry.captureException(err, {
    tags: { route: context.route, modality: context.modality },
    extra: {
      // Aggregated reason list from detectWithFallback's all-fail error.
      message: err instanceof Error ? err.message : String(err),
    },
  });

  return null;
}
