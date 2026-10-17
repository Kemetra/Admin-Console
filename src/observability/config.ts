/**
 * Runtime observability config for the Console (RT-633, OBS-4). Pure.
 *
 * The DSN, `env` and tunnel path arrive at runtime and are never baked into the
 * immutable release bundle. Their source is defined by Backend-Core's OBS-3
 * contract (RT-632); until it exists the Console's config source returns
 * nothing and the Console stays inert. Only the release SHA is a build-time
 * value: it equals the artifact's own commit and is already public in
 * `/version.json`.
 */

export interface ObservabilityConfig {
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
const PROJECT_ID = /^\d+$/;
const DSN_PROTOCOLS: ReadonlySet<string> = new Set(["https:", "http:"]);
const RELEASE_LENGTH = 12;

/** The 12-char release id of a full 40-hex commit SHA; otherwise undefined. */
export function releaseFromSha(sha: string | undefined): string | undefined {
  return sha !== undefined && FULL_SHA.test(sha) ? sha.slice(0, RELEASE_LENGTH) : undefined;
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** A DSN carries a public key (username) and ends in a numeric project id. */
function isUsableDsn(dsn: string): boolean {
  const url = parseUrl(dsn);
  if (url === null || !DSN_PROTOCOLS.has(url.protocol)) return false;
  const projectId = url.pathname.split("/").pop() ?? "";
  return url.username.length > 0 && PROJECT_ID.test(projectId);
}

/** Same-origin absolute path only: never another origin, never protocol-relative. */
function isSameOriginPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Validate an untrusted runtime config. No config or no DSN is `disabled`
 * (silent). A bad DSN or tunnel is `invalid`; the reason never echoes a value.
 */
export function resolveObservabilityConfig(
  raw: unknown,
  releaseSha: string | undefined,
): ResolvedConfig {
  if (raw === null || typeof raw !== "object") return { kind: "disabled" };
  const source = raw as Record<string, unknown>;
  const dsn = trimmedString(source.dsn);
  if (dsn === undefined) return { kind: "disabled" };
  if (!isUsableDsn(dsn)) return { kind: "invalid", reason: "the DSN is not a valid Sentry DSN" };

  const tunnel = trimmedString(source.tunnel);
  if (tunnel === undefined || !isSameOriginPath(tunnel)) {
    return { kind: "invalid", reason: "the tunnel is not a same-origin path" };
  }

  const release = releaseFromSha(releaseSha);
  return {
    kind: "enabled",
    config: {
      dsn,
      environment: trimmedString(source.environment) ?? "unknown",
      tunnel,
      ...(release ? { release } : {}),
    },
  };
}
