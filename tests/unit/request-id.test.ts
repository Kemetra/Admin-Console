import { REQUEST_ID_HEADER, installRequestIdHeader, newRequestId } from "@/lib/request-id";
import createClient from "openapi-fetch";
import { afterEach, describe, expect, test, vi } from "vitest";

/**
 * RT-633 (OBS-4), contract section 2: the Console mints one lowercase UUID v4
 * per Backend-Core call and sends it as `X-Request-Id`.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

function clientWithSpy() {
  const seen: Request[] = [];
  const client = createClient<Record<string, never>>({
    baseUrl: "http://console.test",
    fetch: async (request: Request) => {
      seen.push(request);
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  installRequestIdHeader(client);
  return { client, seen };
}

describe("X-Request-Id", () => {
  test("newRequestId is a lowercase UUID v4", () => {
    expect(newRequestId()).toMatch(UUID_V4);
  });

  test("every call through the client carries a fresh id", async () => {
    const { client, seen } = clientWithSpy();
    // biome-ignore lint/suspicious/noExplicitAny: untyped test client, any path.
    await (client as any).GET("/api/v1/context/me");
    // biome-ignore lint/suspicious/noExplicitAny: untyped test client, any path.
    await (client as any).GET("/api/v1/context/me");
    const ids = seen.map((r) => r.headers.get(REQUEST_ID_HEADER));
    expect(ids[0]).toMatch(UUID_V4);
    expect(ids[1]).toMatch(UUID_V4);
    expect(ids[0]).not.toBe(ids[1]);
  });

  test("without crypto.randomUUID the header is omitted (Backend-Core mints one)", async () => {
    vi.stubGlobal("crypto", {});
    expect(newRequestId()).toBeUndefined();
    const { client, seen } = clientWithSpy();
    // biome-ignore lint/suspicious/noExplicitAny: untyped test client, any path.
    await (client as any).GET("/api/v1/context/me");
    expect(seen[0]?.headers.has(REQUEST_ID_HEADER)).toBe(false);
  });
});
