import { releaseFromSha, resolveObservabilityConfig } from "@/observability/config";
import { type InitDeps, buildInitOptions, initObservability } from "@/observability/init";
import { scrubSentryEvent } from "@/observability/scrub";
import { describe, expect, test, vi } from "vitest";

/**
 * RT-633 (OBS-4): the DSN, env and tunnel arrive at runtime (never baked into
 * the bundle). No config means no SDK init and no egress (contract section 5);
 * a malformed DSN logs one warning that never echoes it.
 */
const DSN = "https://abc123publickey@o1.ingest.de.sentry.io/4500000000000001";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const VALID = { dsn: DSN, environment: "staging", tunnel: "/api/v1/observability/sentry" };

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

describe("resolveObservabilityConfig", () => {
  test("no config, no DSN or a blank DSN is silently disabled", () => {
    for (const raw of [null, undefined, "x", 42, {}, { dsn: "  " }, { dsn: 7 }]) {
      expect(resolveObservabilityConfig(raw, SHA)).toEqual({ kind: "disabled" });
    }
  });

  test("a malformed DSN is disabled with a warning that never echoes it", () => {
    for (const dsn of ["not a url", "https://o1.ingest.de.sentry.io/1", "https://k@h.test/abc"]) {
      const result = resolveObservabilityConfig({ ...VALID, dsn }, SHA);
      expect(result.kind).toBe("invalid");
      expect(JSON.stringify(result)).not.toContain(dsn);
    }
  });

  test("the tunnel must be a same-origin absolute path", () => {
    for (const tunnel of [
      undefined,
      "",
      "https://evil.test/t",
      "//evil.test/t",
      "relative",
      // The URL parser strips tab/newline, so these would resolve to evil.test.
      "/\t/evil.test/t",
      "/\n/evil.test/t",
      "/\\evil.test/t",
    ]) {
      expect(resolveObservabilityConfig({ ...VALID, tunnel }, SHA).kind).toBe("invalid");
    }
  });

  test("a valid config carries dsn, env, tunnel and the release SHA12", () => {
    expect(resolveObservabilityConfig(VALID, SHA)).toEqual({
      kind: "enabled",
      config: { ...VALID, release: "0123456789ab" },
    });
  });

  test("env falls back to unknown and the release is omitted without a SHA", () => {
    expect(resolveObservabilityConfig({ dsn: DSN, tunnel: VALID.tunnel }, undefined)).toEqual({
      kind: "enabled",
      config: { dsn: DSN, environment: "unknown", tunnel: VALID.tunnel },
    });
  });
});

describe("buildInitOptions", () => {
  const integrations = [{ name: "GlobalHandlers" }];
  const options = buildInitOptions({ ...VALID, release: "0123456789ab" }, integrations);

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
      dsn: DSN,
      environment: "staging",
      release: "0123456789ab",
      tunnel: VALID.tunnel,
      beforeSend: scrubSentryEvent,
      initialScope: {
        tags: { service: "admin-console", env: "staging", version: "0123456789ab" },
      },
    });
  });

  test("omits the version tag and release when there is no release", () => {
    const bare = buildInitOptions(VALID, integrations);
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

  test("a malformed DSN warns once without echoing it", async () => {
    const d = deps();
    const dsn = "https://secret-key@h.test/not-a-project";
    expect(await initObservability(async () => ({ ...VALID, dsn }), d)).toBe("disabled");
    expect(d.sentryInit).not.toHaveBeenCalled();
    expect(d.warn).toHaveBeenCalledTimes(1);
    expect(String(d.warn.mock.calls[0]?.[0])).not.toContain("secret-key");
  });

  test("a valid config initialises the SDK once with the built options", async () => {
    const d = deps();
    expect(await initObservability(async () => VALID, d)).toBe("initialized");
    expect(d.sentryInit).toHaveBeenCalledTimes(1);
    expect(d.sentryInit.mock.calls[0]?.[0]).toMatchObject({
      dsn: DSN,
      release: "0123456789ab",
      tunnel: VALID.tunnel,
      defaultIntegrations: false,
      integrations: [{ name: "GlobalHandlers" }],
    });
    expect(d.warn).not.toHaveBeenCalled();
  });

  test("an SDK failure is contained and warns once", async () => {
    const d = deps({
      sentryInit: vi.fn(() => {
        throw new Error(DSN);
      }),
    });
    expect(await initObservability(async () => VALID, d)).toBe("failed");
    expect(d.warn).toHaveBeenCalledTimes(1);
    expect(String(d.warn.mock.calls[0]?.[0])).not.toContain(DSN);
  });
});
