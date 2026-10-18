/**
 * Binds the SDK-free init (./init.ts) to `@sentry/react` (RT-633, OBS-4).
 *
 * Integrations are an explicit minimum: global error/rejection handlers, linked
 * errors (`cause`) and dedupe. No breadcrumbs, HTTP context, browser session,
 * tracing or session replay (owner decision D7).
 *
 * Runtime config: the caller passes the source. In the app it is
 * `telemetryConfigSource()` (./runtime-config.ts, RT-673), which reads
 * Backend-Core's `GET /api/v1/console/telemetry/config` through the generated
 * client: 204 keeps the Console inert (no SDK init, no egress), 200 gives
 * `{ tunnel, environment }` with no DSN (see ./config.ts).
 */
import {
  dedupeIntegration,
  globalHandlersIntegration,
  init,
  linkedErrorsIntegration,
} from "@sentry/react";
import { type ConfigSource, type InitResult, initObservability } from "./init";

/** Full commit SHA injected at build time (vite.config.ts); absent in tests/dev. */
function buildSha(): string | undefined {
  return typeof __CONSOLE_RELEASE_SHA__ === "string" ? __CONSOLE_RELEASE_SHA__ : undefined;
}

export function startObservability(source: ConfigSource): Promise<InitResult> {
  return initObservability(source, {
    sentryInit: (options) => init(options),
    integrations: () => [
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
    ],
    warn: (message) => console.warn(message),
    releaseSha: buildSha(),
  });
}
