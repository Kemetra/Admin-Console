import { resolveObservabilityConfig } from "@/observability/config";
import { buildInitOptions } from "@/observability/init";
import * as Sentry from "@sentry/react";
import { afterAll, describe, expect, test } from "vitest";

/**
 * RT-633 (OBS-4) against the REAL `@sentry/react` SDK, with only the network
 * transport swapped for a recorder: the placeholder DSN is accepted, events go
 * to the same-origin RT-632 tunnel, and what leaves the browser is the scrubbed
 * allowlist rebuild (contract RT-629 section 3).
 */
const TUNNEL = "/api/v1/console/telemetry/envelope";
const sent: { url: string; body: string }[] = [];

function recordingTransport(
  options: Parameters<typeof Sentry.createTransport>[0] & { url: string },
) {
  return Sentry.createTransport(options, async (request) => {
    const body =
      typeof request.body === "string" ? request.body : new TextDecoder().decode(request.body);
    sent.push({ url: options.url, body });
    return { statusCode: 204 };
  });
}

afterAll(async () => {
  await Sentry.close(1000);
});

describe("real SDK through the tunnel", () => {
  test("a captured error is scrubbed and sent only to the tunnel", async () => {
    const resolved = resolveObservabilityConfig(
      { tunnel: TUNNEL, environment: "staging" },
      undefined,
    );
    if (resolved.kind !== "enabled") throw new Error("expected an enabled config");

    Sentry.init({
      ...buildInitOptions(resolved.config, [Sentry.linkedErrorsIntegration()]),
      transport: recordingTransport,
    } as Sentry.BrowserOptions);
    Sentry.setUser({ email: "op@example.test", ip_address: "10.0.0.9" });
    Sentry.setExtra("sale", { total: 99 });

    Sentry.captureException(
      new Error("GET https://api.test/v1/x?token=abc failed for a@b.test eyJh.eyJz.sig"),
    );
    await Sentry.flush(2000);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(TUNNEL);
    const body = sent[0]?.body ?? "";
    for (const leak of ["token=abc", "a@b.test", "eyJh", "op@example.test", "10.0.0.9", "total"]) {
      expect(body).not.toContain(leak);
    }
    expect(body).toContain("GET https://api.test/v1/x failed for [email] [jwt]");
    expect(body).toContain('"infer_ip":"never"');
    expect(body).toContain('"service":"admin-console"');
  });
});
