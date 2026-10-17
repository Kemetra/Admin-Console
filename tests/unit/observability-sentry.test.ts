import { noRuntimeConfig, startObservability } from "@/observability/sentry";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-633 (OBS-4): the `@sentry/react` binding. Inert by default (no runtime
 * config until RT-632), and when enabled it passes an explicit minimal
 * integration list: no replay, tracing, breadcrumbs or browser session.
 */
const init = vi.fn();
vi.mock("@sentry/react", () => ({
  init: (...args: unknown[]) => init(...args),
  globalHandlersIntegration: () => ({ name: "GlobalHandlers" }),
  linkedErrorsIntegration: () => ({ name: "LinkedErrors" }),
  dedupeIntegration: () => ({ name: "Dedupe" }),
}));

const CONFIG = {
  dsn: "https://abc123publickey@o1.ingest.de.sentry.io/4500000000000001",
  environment: "staging",
  tunnel: "/api/v1/observability/sentry",
};

beforeEach(() => {
  init.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("startObservability", () => {
  test("the default source provides no config, so nothing is initialised", async () => {
    expect(await noRuntimeConfig()).toBeNull();
    expect(await startObservability()).toBe("disabled");
    expect(init).not.toHaveBeenCalled();
  });

  test("with a runtime config it initialises once with the minimal integrations", async () => {
    expect(await startObservability(async () => CONFIG)).toBe("initialized");
    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.integrations).toEqual([
      { name: "GlobalHandlers" },
      { name: "LinkedErrors" },
      { name: "Dedupe" },
    ]);
    expect(options.defaultIntegrations).toBe(false);
    // No build SHA under Vitest, so no release is claimed.
    expect(options).not.toHaveProperty("release");
  });

  test("a malformed DSN warns once on the console without echoing it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const dsn = "https://hidden-key@h.test/x";
    expect(await startObservability(async () => ({ ...CONFIG, dsn }))).toBe("disabled");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("hidden-key");
    expect(init).not.toHaveBeenCalled();
  });
});
