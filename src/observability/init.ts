/**
 * Console Sentry initialisation, SDK-free (RT-633, OBS-4). `Sentry.init` and
 * the integrations are injected by `./sentry.ts`, so gating and option shaping
 * are unit-testable without a live SDK (mirrors Backend-Core RT-609).
 *
 * Posture (Observability contract RT-629, owner decisions D6/D7):
 *  - Default-inert: no runtime config means no SDK call and zero egress.
 *  - Errors only: no tracing, no breadcrumbs, no session replay.
 *  - Never blocks: init runs after the first render and never throws.
 */
import { type ObservabilityConfig, resolveObservabilityConfig } from "./config";
import { scrubSentryEvent } from "./scrub";

export const SERVICE_NAME = "admin-console";

/** Returns the untrusted runtime config, or null when none is provisioned. */
export type ConfigSource = () => Promise<unknown>;

export type InitResult = "disabled" | "initialized" | "failed";

export interface InitDeps {
  /** `Sentry.init` from `@sentry/react`. */
  sentryInit: (options: Record<string, unknown>) => unknown;
  /** The explicit, minimal integration list (built only when enabled). */
  integrations: () => unknown[];
  /** One-line diagnostics; must never receive the DSN. */
  warn: (message: string) => void;
  /** Full commit SHA of this build, if known. */
  releaseSha: string | undefined;
}

/** The SDK's own data collection (Sentry 11 replaced `sendDefaultPii`): all off. */
const NO_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
} as const;

export function buildInitOptions(
  config: ObservabilityConfig,
  integrations: unknown[],
): Record<string, unknown> {
  const tags: Record<string, string> = { service: SERVICE_NAME, env: config.environment };
  if (config.release) tags.version = config.release;
  return {
    ...config,
    defaultIntegrations: false,
    integrations,
    maxBreadcrumbs: 0,
    sendClientReports: false,
    enhanceFetchErrorMessages: false,
    dataCollection: NO_DATA_COLLECTION,
    initialScope: { tags },
    beforeSend: scrubSentryEvent,
  };
}

/** Load the runtime config and initialise Sentry. Never throws. */
export async function initObservability(source: ConfigSource, deps: InitDeps): Promise<InitResult> {
  let raw: unknown;
  try {
    raw = await source();
  } catch {
    deps.warn("observability disabled: the runtime config could not be loaded");
    return "disabled";
  }

  const resolved = resolveObservabilityConfig(raw, deps.releaseSha);
  if (resolved.kind === "disabled") return "disabled";
  if (resolved.kind === "invalid") {
    deps.warn(`observability disabled: ${resolved.reason}`);
    return "disabled";
  }

  try {
    deps.sentryInit(buildInitOptions(resolved.config, deps.integrations()));
    return "initialized";
  } catch {
    deps.warn("observability disabled: SDK initialisation failed");
    return "failed";
  }
}
