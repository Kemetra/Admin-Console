/**
 * Runtime observability config for the Console (RT-633, OBS-4). Pure.
 *
 * Backend-Core's OBS-3 contract (RT-632) answers
 * `GET /api/v1/console/telemetry/config` with 204 (Sentry off: the source yields
 * null, so no SDK init) or `{ tunnel, environment }`. The real DSN never reaches
 * the browser: the tunnel (`/api/v1/console/telemetry/envelope`) ignores the
 * envelope DSN and forwards to the configured Console project, so the SDK is
 * initialised with a fixed placeholder. Any DSN in the config is ignored. Only the
 * release SHA is a build-time value: it equals the artifact's own commit and is
 * already public in `/version.json`.
 */

/**
 * Well-formed but fake DSN (`.invalid` host, zero key). The SDK needs one to
 * init; with a tunnel it is only echoed in the envelope header, which the
 * Backend-Core tunnel ignores.
 */
export const PLACEHOLDER_DSN =
  "https://00000000000000000000000000000000@console-telemetry.invalid/1";

export interface ObservabilityConfig {
  /** Always PLACEHOLDER_DSN; never a real DSN. */
  dsn: string;
  /** The `DEPLOYMENT_ENVIRONMENT` value from the release configuration. */
  environment: string;
  /** Same-origin path of the OBS-3 tunnel. The Caddy CSP is `connect-src 'self'`. */
  tunnel: string;
  /** Release SHA12; Sentry `release` and the `version` tag. */
  release?: string;
}

export type ResolvedConfig =
  | { kind: "disabled" }
  | { kind: "invalid"; reason: string }
  | { kind: "enabled"; config: ObservabilityConfig };

const FULL_SHA = /^[0-9a-f]{40}$/;
const RELEASE_LENGTH = 12;

/** The 12-char release id of a full 40-hex commit SHA; otherwise undefined. */
export function releaseFromSha(sha: string | undefined): string | undefined {
  return sha !== undefined && FULL_SHA.test(sha) ? sha.slice(0, RELEASE_LENGTH) : undefined;
}

// Placeholder origin used only to resolve a path; never contacted.
const PROBE_ORIGIN = "https://console.invalid";

/**
 * Same-origin absolute path only. Resolving it the way the browser will catches
 * protocol-relative paths and the ones the URL parser rewrites into them (a tab
 * or newline is stripped, a backslash becomes a slash); the path must also come
 * out unchanged.
 */
function isSameOriginPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  try {
    const url = new URL(path, PROBE_ORIGIN);
    return url.origin === PROBE_ORIGIN && `${url.pathname}${url.search}` === path;
  } catch {
    return false;
  }
}

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Validate an untrusted runtime config. No config (204) is `disabled` (silent).
 * A missing or cross-origin tunnel is `invalid`; the reason never echoes a value.
 */
export function resolveObservabilityConfig(
  raw: unknown,
  releaseSha: string | undefined,
): ResolvedConfig {
  if (raw === null || typeof raw !== "object") return { kind: "disabled" };
  const source = raw as Record<string, unknown>;
  const tunnel = trimmedString(source.tunnel);
  if (tunnel === undefined || !isSameOriginPath(tunnel)) {
    return { kind: "invalid", reason: "the tunnel is not a same-origin path" };
  }

  const release = releaseFromSha(releaseSha);
  return {
    kind: "enabled",
    config: {
      dsn: PLACEHOLDER_DSN,
      environment: trimmedString(source.environment) ?? "unknown",
      tunnel,
      ...(release ? { release } : {}),
    },
  };
}
