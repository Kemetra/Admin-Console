import { type SentryEventLike, scrubSentryEvent } from "@/observability/scrub";
import { describe, expect, test } from "vitest";

/**
 * RT-633 (OBS-4): the Console `beforeSend` scrubber conforms to the
 * Observability contract (RT-629) section 3. The event is rebuilt from an
 * allowlist; JWTs, URL secrets, emails and Postgres row values are masked
 * anywhere in a message.
 */
function eventWith(value: string, extra: Partial<SentryEventLike> = {}): SentryEventLike {
  return { exception: { values: [{ type: "Error", value }] }, ...extra };
}

function scrubbedValue(value: string): string | undefined {
  return scrubSentryEvent(eventWith(value))?.exception?.values?.[0]?.value;
}

describe("scrubSentryEvent — message masks (contract 3.2)", () => {
  test("masks a JWT in the middle of a token and keeps the surrounding text", () => {
    expect(scrubbedValue("auth failed token=eyJhbGciOi.eyJzdWIiOiIx.c2ln rest")).toBe(
      "auth failed token=[jwt] rest",
    );
  });

  test("drops URL userinfo, query and fragment; keeps scheme + host + path", () => {
    expect(
      scrubbedValue("GET https://user:pass@api.example.test/api/v1/x?token=abc#frag failed"),
    ).toBe("GET https://api.example.test/api/v1/x failed");
  });

  test("masks a quoted URL and keeps the trailing punctuation", () => {
    expect(scrubbedValue(`load "https://h.example.test/a?api_key=k1",`)).toBe(
      `load "https://h.example.test/a",`,
    );
  });

  test("an unparsable URL becomes [url]", () => {
    expect(scrubbedValue("bad http://[oops/x?q=1 here")).toBe("bad [url] here");
  });

  test("drops the query and fragment of a scheme-less URL or path", () => {
    expect(scrubbedValue("GET /v1/customers?phone=01012345678 failed")).toBe(
      "GET /v1/customers failed",
    );
    expect(scrubbedValue("at //api.x.test/v1?token=abc")).toBe("at //api.x.test/v1");
    expect(scrubbedValue("at api.x.test/v1#access_token=abc")).toBe("at api.x.test/v1");
    expect(scrubbedValue("x=_://host/?token=secret")).toBe("x=_://host/");
    // A sentence-ending "?" is not a query.
    expect(scrubbedValue("Is it valid? no")).toBe("Is it valid? no");
  });

  test("a token that is itself a query or fragment is dropped (key=value)", () => {
    expect(scrubbedValue("bad params ?phone=01012345678&token=abc")).toBe("bad params ");
    expect(scrubbedValue("hash #access_token=abc end")).toBe("hash  end");
    // A bare "#42" or "?" carries no key=value and is kept.
    expect(scrubbedValue("row #42 ? ok")).toBe("row #42 ? ok");
  });

  test("masks a two-segment JWT (header + payload, no signature)", () => {
    expect(scrubbedValue("bad eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJqb2huQHguY29tIn0 here")).toBe(
      "bad [jwt] here",
    );
  });

  test("masks an email address", () => {
    expect(scrubbedValue("user a.b@example.test not found")).toBe("user [email] not found");
  });

  test("masks Postgres row values from the marker to the end", () => {
    expect(scrubbedValue("duplicate key Key (email)=(a@b.test) already exists.")).toBe(
      "duplicate key Key (...)=(...)",
    );
    expect(scrubbedValue("null value Failing row contains (1, a@b.test, x).")).toBe(
      "null value Failing row contains (...)",
    );
  });

  test("caps the scanned input and truncates the message to 300 chars", () => {
    const out = scrubbedValue(`${"x".repeat(5000)} a@b.test`);
    expect(out?.length).toBe(300);
    expect(out?.endsWith("...")).toBe(true);
    expect(out).not.toContain("a@b.test");
  });

  test("stays linear on hostile input (no backtracking regex)", () => {
    const hostile = `${"a".repeat(1999)}@`.repeat(50) + "http://".repeat(5000);
    const started = performance.now();
    scrubbedValue(hostile);
    expect(performance.now() - started).toBeLessThan(250);
  });
});

describe("scrubSentryEvent — allowlist rebuild (contract 3.1)", () => {
  const full: SentryEventLike = {
    event_id: "e1",
    timestamp: 1,
    platform: "javascript",
    level: "error",
    environment: "staging",
    release: "0123456789ab",
    request: { url: "https://h.test/sales?q=1", headers: { Cookie: "dp2_session=s" } },
    user: { email: "a@b.test", ip_address: "10.0.0.1" },
    extra: { body: "sale payload" },
    contexts: { react: { componentStack: "at SaleRow" } },
    breadcrumbs: [{ message: "clicked" }],
    transaction: "/sales/:id",
    fingerprint: ["x"],
    tags: {
      service: "admin-console",
      env: "staging",
      version: "0123456789ab",
      route: "/sales/:id",
      tenant_id: "t-1",
      user_id: "u-1",
      store_id: "s-1",
      free: "text",
      status: 500,
    },
    exception: {
      values: [
        {
          type: "TypeError",
          value: "boom",
          mechanism: { type: "onerror", handled: false, data: { secret: "x" } },
          stacktrace: {
            frames: [
              {
                filename: "https://console.test/assets/index-abc.js?v=1#x",
                function: "render",
                lineno: 10,
                colno: 5,
                in_app: true,
                vars: { password: "p" },
                context_line: "const token = 'eyJ...';",
                pre_context: ["a"],
                post_context: ["b"],
              },
            ],
          },
        },
      ],
    },
  };

  test("keeps only the allowlisted top-level fields", () => {
    const out = scrubSentryEvent(full);
    expect(Object.keys(out ?? {}).sort()).toEqual(
      [
        "environment",
        "event_id",
        "exception",
        "level",
        "platform",
        "release",
        "sdk",
        "tags",
        "timestamp",
      ].sort(),
    );
  });

  test("always tells Sentry ingest never to infer the user's IP", () => {
    // Sentry 11 sets sdk.settings.infer_ip; the rebuild must not lose it, and a
    // caller-provided "auto" must not win (contract 3.3: no IPs).
    const withSdk = {
      ...full,
      sdk: { name: "sentry.javascript.react", settings: { infer_ip: "auto" } },
    };
    expect(scrubSentryEvent(withSdk)?.sdk).toEqual({ settings: { infer_ip: "never" } });
    expect(scrubSentryEvent(eventWith("x"))?.sdk).toEqual({ settings: { infer_ip: "never" } });
  });

  test("keeps only the contract's bounded string tags", () => {
    expect(scrubSentryEvent(full)?.tags).toEqual({
      service: "admin-console",
      env: "staging",
      version: "0123456789ab",
      route: "/sales/:id",
    });
  });

  test("keeps frame location only and strips the filename's query and fragment", () => {
    const value = scrubSentryEvent(full)?.exception?.values?.[0];
    expect(value?.mechanism).toEqual({ type: "onerror", handled: false });
    expect(value?.stacktrace?.frames).toEqual([
      {
        filename: "https://console.test/assets/index-abc.js",
        function: "render",
        lineno: 10,
        colno: 5,
        in_app: true,
      },
    ]);
  });

  test("a relative frame filename loses its query too", () => {
    const out = scrubSentryEvent({
      exception: {
        values: [{ type: "Error", stacktrace: { frames: [{ filename: "/assets/a.js?token=x" }] } }],
      },
    });
    expect(out?.exception?.values?.[0]?.stacktrace?.frames).toEqual([{ filename: "/assets/a.js" }]);
  });

  test("the exception type is sanitized like a message", () => {
    const out = scrubSentryEvent({ exception: { values: [{ type: "Err a@b.test", value: "x" }] } });
    expect(out?.exception?.values?.[0]?.type).toBe("Err [email]");
  });

  test("never sends a request, user, extra, contexts or breadcrumbs", () => {
    const serialized = JSON.stringify(scrubSentryEvent(full));
    for (const leak of ["dp2_session", "a@b.test", "10.0.0.1", "sale payload", "SaleRow"]) {
      expect(serialized).not.toContain(leak);
    }
  });

  test("drops an event without an exception (messages are not reported)", () => {
    expect(scrubSentryEvent({ message: "hello" } as SentryEventLike)).toBeNull();
    expect(scrubSentryEvent({ exception: { values: [] } })).toBeNull();
  });

  test("does not mutate its input", () => {
    const input = eventWith("mail a@b.test", { user: { id: "u" } });
    const snapshot = JSON.stringify(input);
    scrubSentryEvent(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
