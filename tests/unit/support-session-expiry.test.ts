import createClient from "openapi-fetch";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  getSupportSessionExpiryState,
  installSupportSessionExpiryTracking,
  isSupportSessionExpiredRefusal,
  resetSupportSessionExpiry,
  subscribeSupportSessionExpiry,
} from "@/lib/support-session-expiry";

/**
 * RT-781: a tenant call refused with 403 `support_session_expired` is the one
 * signal that flips the page to the expired state. Nothing else is.
 */
beforeEach(resetSupportSessionExpiry);
afterEach(() => vi.restoreAllMocks());

function clientReplying(status: number, body: unknown) {
  const fetch = vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
  const client = createClient<Record<string, never>>({ baseUrl: "http://x.test", fetch });
  installSupportSessionExpiryTracking(client);
  // biome-ignore lint/suspicious/noExplicitAny: path-less probe of the middleware only.
  return (client as any).GET("/probe") as Promise<{ response: Response }>;
}

describe("isSupportSessionExpiredRefusal", () => {
  test("only 403 plus the exact code", () => {
    expect(isSupportSessionExpiredRefusal(403, "support_session_expired")).toBe(true);
    expect(isSupportSessionExpiredRefusal(409, "support_session_expired")).toBe(false);
    expect(isSupportSessionExpiredRefusal(403, "forbidden")).toBe(false);
    expect(isSupportSessionExpiredRefusal(403, "support_session_required")).toBe(false);
    expect(isSupportSessionExpiredRefusal(403, "support_session_read_only")).toBe(false);
    expect(isSupportSessionExpiredRefusal(403, "origin_rejected")).toBe(false);
    expect(isSupportSessionExpiredRefusal(403, undefined)).toBe(false);
  });
});

describe("expiry middleware", () => {
  test("a 403 support_session_expired bumps the counter and notifies subscribers", async () => {
    const listener = vi.fn();
    const stop = subscribeSupportSessionExpiry(listener);
    const { response } = await clientReplying(403, {
      error: { code: "support_session_expired", message: "x" },
    });
    expect(getSupportSessionExpiryState().seq).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
    // The caller still gets an intact body to read.
    expect(response.status).toBe(403);
    stop();
  });

  test("other 403 codes, other statuses and a non-JSON 403 do not", async () => {
    await clientReplying(403, { error: { code: "forbidden", message: "x" } });
    await clientReplying(403, { error: { code: "origin_rejected", message: "x" } });
    await clientReplying(409, { error: { code: "support_session_expired", message: "x" } });
    await clientReplying(200, { ok: true });
    await clientReplying(403, "<html>nope</html>");
    expect(getSupportSessionExpiryState().seq).toBe(0);
  });

  test("an unsubscribed listener is not called", async () => {
    const listener = vi.fn();
    subscribeSupportSessionExpiry(listener)();
    await clientReplying(403, { error: { code: "support_session_expired", message: "x" } });
    expect(listener).not.toHaveBeenCalled();
  });
});
