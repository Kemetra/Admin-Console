import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { paths } from "@/generated/schema";
import { telemetryConfigSource } from "@/observability/runtime-config";
import { startObservability } from "@/observability/sentry";
import createClient from "openapi-fetch";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-673: the Console reads Backend-Core's `consoleGetTelemetryConfig`
 * (RT-632) through the generated client and starts Sentry only on a 200.
 * 204 and any failure keep it inert. The fetch is held open while a React tree
 * renders, to show the config call never sits in front of the first render.
 */
const init = vi.fn();
vi.mock("@sentry/react", () => ({
  init: (...args: unknown[]) => init(...args),
  globalHandlersIntegration: () => ({ name: "GlobalHandlers" }),
  linkedErrorsIntegration: () => ({ name: "LinkedErrors" }),
  dedupeIntegration: () => ({ name: "Dedupe" }),
}));

const CONFIG_PATH = "/api/v1/console/telemetry/config";
const CONFIG = { tunnel: "/api/v1/console/telemetry/envelope", environment: "staging" };

/** A generated-client instance whose fetch waits until `respond` is called. */
function heldClient() {
  const requests: Request[] = [];
  let respond: (outcome: Response | Error) => void = () => undefined;
  const pending = new Promise<Response | Error>((resolve) => {
    respond = resolve;
  });
  const client = createClient<paths>({
    baseUrl: "http://console.test",
    fetch: async (request: Request) => {
      requests.push(request);
      const outcome = await pending;
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  });
  return { client, requests, respond: (outcome: Response | Error) => respond(outcome) };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

let warn: ReturnType<typeof vi.spyOn>;
let container: HTMLDivElement;

beforeEach(() => {
  init.mockClear();
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

/** Render first, start observability with the held fetch, then answer it. */
async function bootWith(outcome: Response | Error) {
  const { client, requests, respond } = heldClient();
  const root = createRoot(container);
  act(() => root.render(<p>console shell</p>));

  const started = startObservability(telemetryConfigSource(client));
  // The config call is in flight and unanswered; the tree is already painted.
  expect(container.textContent).toBe("console shell");
  expect(init).not.toHaveBeenCalled();

  respond(outcome);
  const result = await started;
  act(() => root.unmount());
  return { result, requests };
}

describe("telemetryConfigSource", () => {
  test("200: initialises Sentry once with the placeholder DSN, the tunnel and the environment", async () => {
    const { result, requests } = await bootWith(json(CONFIG));
    expect(result).toBe("initialized");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("GET");
    expect(new URL(requests[0]?.url ?? "").pathname).toBe(CONFIG_PATH);
    expect(init).toHaveBeenCalledTimes(1);
    const options = init.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(options.dsn).toBe(
      "https://00000000000000000000000000000000@console-telemetry.invalid/1",
    );
    expect(options.tunnel).toBe(CONFIG.tunnel);
    expect(options.environment).toBe("staging");
    expect(options.initialScope).toEqual({ tags: { service: "admin-console", env: "staging" } });
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options).not.toHaveProperty("tracesSampleRate");
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(warn).not.toHaveBeenCalled();
  });

  test("204: stays inert, silently", async () => {
    const { result } = await bootWith(new Response(null, { status: 204 }));
    expect(result).toBe("disabled");
    expect(init).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  test("network error: stays inert with one warning that names no URL", async () => {
    const { result } = await bootWith(new TypeError("Failed to fetch http://console.test/x"));
    expect(result).toBe("disabled");
    expect(init).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toMatch(/console\.test|telemetry\/config/);
  });

  test("any other status stays inert with one warning", async () => {
    const { result } = await bootWith(json({ error: { code: "internal" } }, 500));
    expect(result).toBe("disabled");
    expect(init).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  test("a 200 body that is not JSON (an HTML fallback) stays inert", async () => {
    const html = new Response("<!doctype html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    const { result } = await bootWith(html);
    expect(result).toBe("disabled");
    expect(init).not.toHaveBeenCalled();
  });
});

describe("main.tsx bootstrap", () => {
  // main.tsx is exercised by E2E, not unit-imported (vitest.config.ts); this pins
  // the ordering that keeps the config call out of the first render's way.
  const main = readFileSync(join(process.cwd(), "src/main.tsx"), "utf8");

  test("starts observability with the Backend-Core source, after render and not awaited", () => {
    const render = main.indexOf(".render(");
    const start = main.indexOf("void startObservability(telemetryConfigSource())");
    expect(render).toBeGreaterThan(-1);
    expect(start).toBeGreaterThan(render);
    expect(main).not.toMatch(/await\s+startObservability/);
  });
});
