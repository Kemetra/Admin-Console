import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-781 (RT-777 S2): the support-session bar and lifecycle against the built
 * SPA with a mocked Backend-Core (C-5; the RT-414 runtime is not called). Runs
 * in both locales. Time is pinned with Playwright's clock so the countdown, the
 * expiring threshold and expiry are deterministic. Error codes are those of the
 * pinned `platform-support-sessions.openapi.yaml`.
 */

const NOW = "2026-10-22T10:00:00Z";
const MIN = 60_000;
const at = (ms: number) => new Date(Date.parse(NOW) + ms).toISOString();

const admin = {
  id: "u1",
  email: "ops@kemetra.test",
  display_name: "Ops Admin",
  is_platform_admin: true,
};

interface SessionOver {
  status?: "active" | "expired";
  left?: number;
  capIn?: number;
  id?: string;
}

const summary = (over: SessionOver = {}) => ({
  id: over.id ?? "11111111-1111-4111-8111-111111111111",
  tenant_id: "t1",
  purpose: "incident",
  ticket_ref: "SUP-2291",
  status: over.status ?? "active",
  expires_at: at(over.left ?? 40 * MIN),
  renewal_cap_at: at(over.capIn ?? 8 * 60 * MIN),
});

/** A platform admin inside a support session: a member of another tenant only (OQ-10). */
const sessionContext = (session: ReturnType<typeof summary> | null) => ({
  user: admin,
  active_tenant: { id: "t1", name: "Delta Markets" },
  active_store: null,
  active_role_code: "owner",
  memberships: [{ tenant_id: "t9", tenant_name: "Kemetra Internal", role_code: "owner" }],
  support_session: session,
});

const noSession = { user: admin, active_tenant: null, memberships: [], support_session: null };

const json = (status: number, body: unknown) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

interface Server {
  /** What `getActiveContext` answers next. */
  context: unknown;
  contextCalls: number;
  renewCalls: number;
  endCalls: number;
  /** Tenant reads answer 403 support_session_expired when set. */
  tenantExpired: boolean;
}

async function mock(page: Page, context: unknown): Promise<Server> {
  const server: Server = {
    context,
    contextCalls: 0,
    renewCalls: 0,
    endCalls: 0,
    tenantExpired: false,
  };
  await page.clock.install({ time: new Date(NOW) });
  await page.route("**/api/v1/**", (r) =>
    server.tenantExpired
      ? r.fulfill(json(403, { error: { code: "support_session_expired", message: "expired" } }))
      : r.fulfill(json(200, [])),
  );
  await page.route("**/api/v1/context/me", (r) => {
    server.contextCalls += 1;
    return r.fulfill(json(200, server.context));
  });
  return server;
}

async function renewReplies(page: Page, server: Server, status: number, body: unknown) {
  await page.route("**/api/v1/platform/support-sessions/current/renew", (r) => {
    server.renewCalls += 1;
    return r.fulfill(json(status, body));
  });
}

async function darkTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem("rt.theme.v1:user:u1", "dark");
    localStorage.setItem("rt.theme.v1:last", "dark");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
}

test("no bar for a member-entered tenant (support_session null)", async ({ page, t }) => {
  await mock(page, sessionContext(null));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  await expect(page.getByRole("region", { name: t("platform.session.region") })).toHaveCount(0);
});

test("no bar on /platform without a session", async ({ page, t }) => {
  await mock(page, noSession);
  await page.goto("/platform/tenants");
  await expect(
    page.getByRole("heading", { level: 1, name: t("platform.tenants.title") }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: t("platform.session.region") })).toHaveCount(0);
});

test("active session: the bar shows purpose, ticket, remaining time, renew and end; axe light and dark", async ({
  page,
  t,
}) => {
  await mock(page, sessionContext(summary()));
  await page.goto("/platform/tenants");
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await expect(region).toHaveAttribute("data-state", "active");
  await expect(region).toContainText("SUP-2291");
  await expect(region).toContainText("Delta Markets");
  await expect(region).toContainText(t("platform.session.readOnly"));
  await expect(region.getByRole("button", { name: t("platform.session.renew") })).toBeEnabled();
  await expect(region.getByRole("button", { name: t("platform.session.end") })).toBeEnabled();
  await expectNoAxeViolations(page, "session bar active");
  await darkTheme(page);
  await expect(region).toHaveAttribute("data-state", "active");
  await expectNoAxeViolations(page, "session bar active dark");
});

test("no write control inside a session: only renew and end, no form field", async ({
  page,
  t,
}) => {
  await mock(page, sessionContext(summary()));
  await page.goto("/platform/tenants");
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await expect(region).toBeVisible();
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  // RT-782: the platform-scope directory search is the only field; no tenant form.
  await expect(page.locator("form, textarea, select")).toHaveCount(0);
  await expect(page.locator("input")).toHaveCount(1);
  await expect(page.locator("input#platform-tenant-search")).toHaveCount(1);
  await expect(region.getByRole("button")).toHaveText([
    t("platform.session.renew"),
    t("platform.session.end"),
  ]);
});

test("expiring: the countdown crosses the threshold, then renew extends the session", async ({
  page,
  t,
}) => {
  const server = await mock(page, sessionContext(summary({ left: 6 * MIN })));
  await renewReplies(page, server, 200, {
    ...summary({ left: 66 * MIN }),
    renewed_at: at(2 * MIN),
  });
  await page.goto("/platform/tenants");
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await expect(region).toHaveAttribute("data-state", "active");

  await page.clock.runFor(2 * MIN);
  await expect(region).toHaveAttribute("data-state", "expiring");
  await expectNoAxeViolations(page, "session bar expiring");
  await darkTheme(page);
  await expectNoAxeViolations(page, "session bar expiring dark");

  server.context = sessionContext(summary({ left: 66 * MIN }));
  await region.getByRole("button", { name: t("platform.session.renew") }).click();
  await expect(region).toHaveAttribute("data-state", "active");
  expect(server.renewCalls).toBe(1);
});

test("cap reached: renew stays but is aria-disabled with its reason, and never calls the API", async ({
  page,
  t,
}) => {
  const server = await mock(page, sessionContext(summary({ left: 9 * MIN, capIn: 9 * MIN })));
  await renewReplies(page, server, 200, {});
  await page.goto("/platform/tenants");
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await expect(region).toHaveAttribute("data-state", "cap_reached");
  const renew = region.getByRole("button", { name: t("platform.session.renew") });
  await expect(renew).toHaveAttribute("aria-disabled", "true");
  await expect(renew).toHaveAccessibleDescription(
    new RegExp(t("platform.session.notice.cap.title")),
  );
  // aria-disabled is not actionable for click(); dispatch the click the way a user agent would.
  await renew.dispatchEvent("click");
  expect(server.renewCalls).toBe(0);
  await expectNoAxeViolations(page, "session bar cap reached");
  await darkTheme(page);
  await expectNoAxeViolations(page, "session bar cap reached dark");
});

test("renew 409 support_session_renewal_cap_reached switches an active bar to the cap state", async ({
  page,
  t,
}) => {
  const server = await mock(page, sessionContext(summary({ left: 30 * MIN })));
  await renewReplies(page, server, 409, {
    error: { code: "support_session_renewal_cap_reached", message: "cap" },
  });
  await page.goto("/platform/tenants");
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await region.getByRole("button", { name: t("platform.session.renew") }).click();
  await expect(region).toHaveAttribute("data-state", "cap_reached");
});

test("renew 403 origin_rejected is an inline error, not the expired state", async ({ page, t }) => {
  const server = await mock(page, sessionContext(summary()));
  await renewReplies(page, server, 403, { error: { code: "origin_rejected", message: "no" } });
  await page.goto("/platform/tenants");
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await region.getByRole("button", { name: t("platform.session.renew") }).click();
  await expect(region.getByRole("alert")).toHaveText(t("platform.session.error.originRejected"));
  await expect(region).toHaveAttribute("data-state", "active");
});

test("renew 429 raises the shared banner and leaves the session alone", async ({ page, t }) => {
  const server = await mock(page, sessionContext(summary()));
  await page.route("**/api/v1/platform/support-sessions/current/renew", (r) => {
    server.renewCalls += 1;
    return r.fulfill({
      status: 429,
      contentType: "application/json",
      headers: { "Retry-After": "30" },
      body: JSON.stringify({ error: { code: "rate_limited", message: "slow down" } }),
    });
  });
  await page.goto("/platform/tenants");
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await region.getByRole("button", { name: t("platform.session.renew") }).click();
  await expect(page.getByText(t("rateLimit.title"))).toBeVisible();
  await expect(region).toHaveAttribute("data-state", "active");
  // Disabled while the Retry-After runs, and never retried.
  await expect(
    region.getByRole("button", { name: new RegExp(t("platform.session.renew")) }),
  ).toBeDisabled();
  expect(server.renewCalls).toBe(1);
});

test("expired: only end remains; the platform directory keeps working; axe light and dark", async ({
  page,
  t,
}) => {
  await mock(page, sessionContext(summary({ status: "expired", left: -MIN })));
  await page.goto("/platform/tenants");
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await expect(region).toHaveAttribute("data-state", "expired");
  await expect(region.getByRole("button", { name: t("platform.session.renew") })).toHaveCount(0);
  await expect(region.getByRole("button", { name: t("platform.session.end") })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: t("platform.tenants.title") }),
  ).toBeVisible();
  await expectNoAxeViolations(page, "session bar expired");
  await darkTheme(page);
  await expectNoAxeViolations(page, "session bar expired dark");
});

test("expired in the tenant shell replaces the surface with the calm state; axe light and dark", async ({
  page,
  t,
}) => {
  await mock(page, sessionContext(summary({ status: "expired", left: -MIN })));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: t("platform.session.expiredBody.title"), level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: t("platform.session.expiredBody.action") }),
  ).toHaveAttribute("href", "/platform/tenants");
  await expectNoAxeViolations(page, "expired body");
  await darkTheme(page);
  await expectNoAxeViolations(page, "expired body dark");
});

test("mid-page: a refused tenant call after the page rendered re-reads the context and shows the expired state", async ({
  page,
  t,
}) => {
  // The page renders as a member-entered tenant; the session was opened and lapsed elsewhere.
  const server = await mock(page, sessionContext(null));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  const readsBefore = server.contextCalls;

  // The next tenant read is refused (403 support_session_expired); the re-read learns why.
  server.tenantExpired = true;
  server.context = sessionContext(summary({ status: "expired", left: -MIN }));
  await page.getByRole("button", { name: t("overview.refresh") }).click();

  await expect(
    page.getByRole("heading", { name: t("platform.session.expiredBody.title"), level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toHaveCount(0);
  await expect(page.getByRole("region", { name: t("platform.session.region") })).toHaveAttribute(
    "data-state",
    "expired",
  );
  // The surface's own generic 403 banner never shows.
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(server.contextCalls).toBeGreaterThan(readsBefore);
});

test("tenant shell in a session: read-only state, no tenant request, no write control; axe light and dark", async ({
  page,
  t,
}) => {
  await mock(page, sessionContext(summary()));
  const tenantCalls: string[] = [];
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    // The context read and the Console's own telemetry config are not tenant reads.
    const own = path === "/api/v1/context/me" || path.startsWith("/api/v1/console/telemetry/");
    if (path.startsWith("/api/v1/") && !own) tenantCalls.push(path);
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: t("platform.session.readOnlyBody.title"), level: 1 }),
  ).toBeVisible();
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await expect(region.getByRole("button")).toHaveText([
    t("platform.session.renew"),
    t("platform.session.end"),
  ]);
  await expect(page.locator("form, input, textarea, select")).toHaveCount(0);
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: t("shell.nav.label") }).getByRole("link"),
  ).toHaveCount(1);
  expect(tenantCalls).toEqual([]);
  await expectNoAxeViolations(page, "tenant shell read-only session");
  await darkTheme(page);
  await expectNoAxeViolations(page, "tenant shell read-only session dark");
});

test("end: lands on the directory with the session gone and no tenant data left", async ({
  page,
  t,
}) => {
  const server = await mock(page, sessionContext(summary()));
  await page.route("**/api/v1/platform/support-sessions/current/end", (r) => {
    server.endCalls += 1;
    server.context = noSession;
    return r.fulfill(json(200, { ...summary(), status: "ended", end_reason: "operator" }));
  });
  await page.goto("/");
  const region = page.getByRole("region", { name: t("platform.session.region") });
  await region.getByRole("button", { name: t("platform.session.end") }).click();
  await expect(page).toHaveURL(/\/platform\/tenants$/);
  await expect(
    page.getByRole("heading", { level: 1, name: t("platform.tenants.title") }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: t("platform.session.region") })).toHaveCount(0);
  expect(server.endCalls).toBe(1);
});

test("end 409 support_session_absent counts as already ended", async ({ page, t }) => {
  const server = await mock(page, sessionContext(summary()));
  await page.route("**/api/v1/platform/support-sessions/current/end", (r) => {
    server.context = noSession;
    return r.fulfill(json(409, { error: { code: "support_session_absent", message: "gone" } }));
  });
  await page.goto("/platform/tenants");
  await page
    .getByRole("region", { name: t("platform.session.region") })
    .getByRole("button", { name: t("platform.session.end") })
    .click();
  await expect(page.getByRole("region", { name: t("platform.session.region") })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});
