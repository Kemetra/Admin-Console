/**
 * Report a caught render error to Sentry (RT-633). A no-op until the SDK is
 * initialised, so it is safe while the Console is inert. The `beforeSend`
 * scrubber still decides what leaves the browser.
 */
import { captureException } from "@sentry/react";

export function reportError(error: unknown): void {
  try {
    captureException(error);
  } catch {
    // Telemetry never breaks the fallback screen.
  }
}
