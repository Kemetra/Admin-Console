import {
  PLACEHOLDER_DSN,
  releaseFromSha,
  resolveObservabilityConfig,
} from "@/observability/config";
import { type InitDeps, buildInitOptions, initObservability } from "@/observability/init";
import { scrubSentryEvent } from "@/observability/scrub";
import { describe, expect, test, vi } from "vitest";

/**
 * RT-633 (OBS-4), aligned to the RT-632 contract: `GET /api/v1/console/telemetry/config`
 * answers 204 (inert: the source yields null) or `{ tunnel, environment }`. The
 * real DSN never reaches the browser; the tunnel ignores the envelope DSN, so the
 * Console initialises with a fixed placeholder. No config means no SDK init and
 * no egress (contract section 5).
 */
const SHA = "0123456789abcdef0123456789abcdef01234567";
const TUNNEL = "/api/v1/console/telemetry/envelope";
const VALID = { tunnel: TUNNEL, environment: "staging" };
const ENABLED = { dsn: PLACEHOLDER_DSN, environment: "staging", tunnel: TUNNEL };

function deps(overrides: Partial<InitDeps> = {}): InitDeps & {
  sentryInit: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
} {
  return {
    sentryInit: vi.fn(),
    warn: vi.fn(),
    integrations: () => [{ name: "GlobalHandlers" }],
    releaseSha: SHA,
    ...overrides,
  } as InitDeps & { sentryInit: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
}

describe("releaseFromSha", () => {
  test("is the 12-char prefix of a 40-hex commit", () => {
    expect(releaseFromSha(SHA)).toBe("0123456789ab");
  });

  test("is undefined for anything else", () => {
    for (const bad of [undefined, "", "abc", SHA.toUpperCase(), `${SHA}0`]) {
      expect(releaseFromSha(bad)).toBeUndefined();
    }
  });
});

describe("PLACEHOLDER_DSN", () => {
  test("is a well-formed Sentry DSN that names no real host", () => {
    const url = new URL(PLACEHOLDER_DSN);
    expect(url.protocol).toBe("https:");
    expect(url.username).toMatch(/^[0-9a-f]{32}$/);
    expect(url.hostname.endsWith(".invalid")).toBe(true);
    expect(url.pathname).toMatch(/^\/\d+$/);
  });
});

describe("resolveObservabilityConfig", () => {
  test("no config (204) or a non-object is silently disabled", () => {
    for (const raw of [null, undefined, "x", 42, true]) {
      expect(resolveObservabilityConfig(raw, SHA)).toEqual({ kind: "disabled" });
    }
  });

  test("the tunnel is required and must be a same-origin absolute path", () => {
    for (const tunnel of [
      undefined,
      "",
      "  ",
      7,
      "https://evil.test/t",
      "//evil.test/t",
      "relative",
      // The URL parser strips tab/newline, so these would resolve to evil.test.
      "/\t/evil.test/t",
      "/\n/evil.test/t",
      "/\\evil.test/t",
    ]) {
      const result = resolveObservabilityConfig({ ...VALID, tunnel }, SHA);
      expect(result.kind).toBe("invalid");
      expect(JSON.stringify(result)).not.toContain("evil.test");
    }
  });

  test("a valid config uses the placeholder DSN, env, tunnel and the release SHA12", () => {
    expect(resolveObservabilityConfig(VALID, SHA)).toEqual({
      kind: "enabled",
      config: { ...ENABLED, release: "0123456789ab" },
    });
  });

  test("a DSN in the runtime config is ignored: the placeholder is always used", () => {
    const leaked = "https://realkey@o1.ingest.de.sentry.io/4500000000000001";
    const result = resolveObservabilityConfig({ ...VALID, dsn: leaked }, SHA);
    expect(result).toEqual({ kind: "enabled", config: { ...ENABLED, release: "0123456789ab" } });
    expect(JSON.stringify(result)).not.toContain("realkey");
  });

  test("env falls back to unknown and the release is omitted without a SHA", () => {
    expect(resolveObservabilityConfig({ tunnel: TUNNEL }, undefined)).toEqual({
      kind: "enabled",
      config: { ...ENABLED, environment: "unknown" },
    });
  });
});

describe("buildInitOptions", () => {
  const integrations = [{ name: "GlobalHandlers" }];
  const options = buildInitOptions({ ...ENABLED, release: "0123456789ab" }, integrations);

  test("errors only: no default integrations, replay, tracing or breadcrumbs", () => {
    expect(options.defaultIntegrations).toBe(false);
    expect(options.integrations).toBe(integrations);
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(options).not.toHaveProperty("tracesSampler");
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
  });

  test("the SDK's own PII collection stays off (Sentry 11 dataCollection)", () => {
    expect(options.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    });
    expect(options.sendClientReports).toBe(false);
    expect(options.enhanceFetchErrorMessages).toBe(false);
  });

  test("sends through the tunnel, scrubs and tags service/env/version", () => {
    expect(options).toMatchObject({
      dsn: PLACEHOLDER_DSN,
      environment: "staging",
      release: "0123456789ab",
      tunnel: TUNNEL,
      beforeSend: scrubSentryEvent,
      initialScope: {
        tags: { service: "admin-console", env: "staging", version: "0123456789ab" },
      },
    });
  });

  test("omits the version tag and release when there is no release", () => {
    const bare = buildInitOptions(ENABLED, integrations);
    expect(bare).not.toHaveProperty("release");
    expect(bare.initialScope).toEqual({ tags: { service: "admin-console", env: "staging" } });
  });
});

describe("initObservability", () => {
  test("default-inert: no config means no init and no warning", async () => {
    const d = deps();
    expect(await initObservability(async () => null, d)).toBe("disabled");
    expect(d.sentryInit).not.toHaveBeenCalled();
    expect(d.warn).not.toHaveBeenCalled();
  });

  test("a failing config source never throws and warns once", async () => {
    const d = deps();
    const result = await initObservability(async () => {
      throw new Error("network down");
    }, d);
    expect(result).toBe("disabled");
    expect(d.sentryInit).not.toHaveBeenCalled();
    expect(d.warn).toHaveBeenCalledTimes(1);
  });

  test("a bad tunnel warns once without echoing it", async () => {
    const d = deps();
    const tunnel = "https://secret-host.test/t";
    expect(await initObservability(async () => ({ ...VALID, tunnel }), d)).toBe("disabled");
    expect(d.sentryInit).not.toHaveBeenCalled();
    expect(d.warn).toHaveBeenCalledTimes(1);
    expect(String(d.warn.mock.calls[0]?.[0])).not.toContain("secret-host");
  });

  test("a valid config initialises the SDK once with the built options", async () => {
    const d = deps();
    expect(await initObservability(async () => VALID, d)).toBe("initialized");
    expect(d.sentryInit).toHaveBeenCalledTimes(1);
    expect(d.sentryInit.mock.calls[0]?.[0]).toMatchObject({
      dsn: PLACEHOLDER_DSN,
      environment: "staging",
      release: "0123456789ab",
      tunnel: TUNNEL,
      defaultIntegrations: false,
      integrations: [{ name: "GlobalHandlers" }],
    });
    expect(d.warn).not.toHaveBeenCalled();
  });

  test("an SDK failure is contained and warns once", async () => {
    const d = deps({
      sentryInit: vi.fn(() => {
        throw new Error("sdk exploded");
      }),
    });
    expect(await initObservability(async () => VALID, d)).toBe("failed");
    expect(d.warn).toHaveBeenCalledTimes(1);
    expect(String(d.warn.mock.calls[0]?.[0])).not.toContain("sdk exploded");
  });
});
