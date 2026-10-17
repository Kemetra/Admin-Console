/**
 * Binds the SDK-free init (./init.ts) to `@sentry/react` (RT-633, OBS-4).
 *
 * Integrations are an explicit minimum: global error/rejection handlers, linked
 * errors (`cause`) and dedupe. No breadcrumbs, HTTP context, browser session,
 * tracing or session replay (owner decision D7).
 *
 * Runtime config: Backend-Core's OBS-3 contract (RT-632) serves
 * `GET /api/v1/console/telemetry/config`: 204 (Sentry off) or
 * `{ tunnel, environment }` with no DSN (see ./config.ts). Reading it through
 * the generated client waits for that contract to merge and the pin bump, so
 * until then the source below returns nothing and the Console stays inert (no
 * SDK init, no egress).
 */
import {
  dedupeIntegration,
  globalHandlersIntegration,
  init,
  linkedErrorsIntegration,
} from "@sentry/react";
import { type ConfigSource, type InitResult, initObservability } from "./init";

/** Source until the RT-632 config endpoint is wired in: no config, so inert. */
export const noRuntimeConfig: ConfigSource = () => Promise.resolve(null);

/** Full commit SHA injected at build time (vite.config.ts); absent in tests/dev. */
function buildSha(): string | undefined {
  return typeof __CONSOLE_RELEASE_SHA__ === "string" ? __CONSOLE_RELEASE_SHA__ : undefined;
}

export function startObservability(source: ConfigSource = noRuntimeConfig): Promise<InitResult> {
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
