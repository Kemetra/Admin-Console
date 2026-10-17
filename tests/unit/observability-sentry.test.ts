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

// The RT-632 config answer: no DSN, only the tunnel path and env.
const CONFIG = { tunnel: "/api/v1/console/telemetry/envelope", environment: "staging" };

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

  test("a bad tunnel warns once on the console without echoing it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const tunnel = "https://hidden-host.test/t";
    expect(await startObservability(async () => ({ ...CONFIG, tunnel }))).toBe("disabled");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("hidden-host");
    expect(init).not.toHaveBeenCalled();
  });
});
