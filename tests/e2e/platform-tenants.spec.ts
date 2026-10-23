import { expectNoAxeViolations } from "./axe";
import { type LocaleFixtures, type Page, expect, test } from "./fixtures";

type Tr = LocaleFixtures["t"];

/**
 * RT-782 (RT-777 S3): the tenant directory and the support-session start drawer
 * against the built SPA with a mocked Backend-Core (C-5; no live lab run). Runs
 * in both locale projects. Statuses, codes and shapes are those of the pinned
 * contracts: `listTenants` returns TenantSummary (id, slug, name) only, and
 * `openSupportSession` answers 201, 404 TenantNotFound, 409 already_member and
 * 429 with Retry-After.
 */

const admin = {
  id: "u1",
  email: "ops@kemetra.test",
  display_name: "Ops Admin",
  is_platform_admin: true,
};
const DELTA = "0190f000-0000-7000-8000-0000000000d1";
const NILE = "0190f000-0000-7000-8000-0000000000d2";
const FAJR = "0190f000-0000-7000-8000-0000000000d3";
const tenants = [
  { id: DELTA, slug: "delta-markets", name: "أسواق الدلتا" },
  { id: NILE, slug: "nile-pharma", name: "Nile Pharma" },
  // Suspended in the lab story: the list cannot say so (no status on TenantSummary).
  { id: FAJR, slug: "fajr-supermarket", name: "سوبرماركت الفجر" },
];

const hour = 60 * 60_000;
const summary = (tenantId: string, over: Record<string, unknown> = {}) => ({
  id: `s-${tenantId.slice(-2)}`,
  tenant_id: tenantId,
  purpose: "incident",
  ticket_ref: null,
  status: "active",
  expires_at: new Date(Date.now() + hour).toISOString(),
  renewal_cap_at: new Date(Date.now() + 8 * hour).toISOString(),
  ...over,
});

const noSession = (memberships: unknown[] = []) => ({
  user: admin,
  active_tenant: null,
  active_store: null,
  memberships,
  support_session: null,
});

const inSession = (tenantId: string, name: string, over: Record<string, unknown> = {}) => ({
  user: admin,
  active_tenant: { id: tenantId, name },
  active_store: null,
  active_role_code: "owner",
  memberships: [{ tenant_id: "t9", tenant_name: "Kemetra Internal", role_code: "owner" }],
  support_session: summary(tenantId, over),
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  status,
  contentType: "application/json",
  headers,
  body: JSON.stringify(body),
});

const refusal = (code: string, request_id = "0190f000-0000-7000-8000-00000000ffff") => ({
  error: { code, message: "refused", request_id },
});

interface Reply {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  /** The context the next read returns once this reply is sent. */
  nextContext?: unknown;
}

interface Server {
  context: unknown;
  opens: unknown[];
  switches: unknown[];
  openReply: Reply;
}

async function mock(page: Page, context: unknown): Promise<Server> {
  const server: Server = { context, opens: [], switches: [], openReply: { status: 500, body: {} } };
  await page.route("**/api/v1/**", (r) => r.fulfill(json(200, [])));
  await page.route("**/api/v1/tenants", (r) => r.fulfill(json(200, tenants)));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(200, server.context)));
  await page.route("**/api/v1/context/tenant", (r) => {
    server.switches.push(r.request().postDataJSON());
    server.context = {
      ...noSession([{ tenant_id: NILE, tenant_name: "Nile Pharma", role_code: "owner" }]),
      active_tenant: { id: NILE, name: "Nile Pharma" },
      active_role_code: "owner",
    };
    return r.fulfill(json(200, server.context));
  });
  await page.route("**/api/v1/platform/support-sessions", (r) => {
    server.opens.push(r.request().postDataJSON());
    const reply = server.openReply;
    if (reply.nextContext !== undefined) server.context = reply.nextContext;
    return r.fulfill(json(reply.status, reply.body, reply.headers));
  });
  return server;
}

async function darkTheme(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem("rt.theme.v1:user:u1", "dark");
    localStorage.setItem("rt.theme.v1:last", "dark");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
}

const directoryTable = (page: Page) => page.locator("table.data-table");

/**
 * Forced colors switched on mid-page over the dark theme: axe's contrast maths
 * then reports every node of the shell, so these steps check, as the other
 * forced-colors specs do, that each control still draws a real focus outline.
 * The axe run under forced colors is its own test, emulated before load.
 */
async function expectFocusRing(
  locator: ReturnType<Page["locator"]>,
  label: string,
  focused = false,
) {
  if (!focused) await locator.focus();
  const ring = await locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { style: s.outlineStyle, width: Number.parseFloat(s.outlineWidth) };
  });
  expect(ring.style, label).not.toBe("none");
  expect(ring.width, label).toBeGreaterThan(0);
}

async function openDirectory(page: Page, t: Tr): Promise<void> {
  await page.goto("/platform/tenants");
  await expect(
    page.getByRole("heading", { level: 1, name: t("platform.tenants.title") }),
  ).toBeVisible();
}

async function openDrawer(page: Page, name: string, t: Tr) {
  await page.getByRole("button", { name: t("platform.tenants.action.startFor", { name }) }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  return drawer;
}

test("directory: names and slugs only, the read-only note; axe light and dark, focus rings in forced colors", async ({
  page,
  t,
}) => {
  await mock(page, noSession());
  await openDirectory(page, t);
  const rows = directoryTable(page).locator("tbody tr");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("أسواق الدلتا");
  await expect(rows.first()).toContainText("delta-markets");
  await expect(page.getByText(t("platform.tenants.suspendedNote"))).toBeVisible();
  await expect(directoryTable(page).locator("thead th")).toHaveText([
    t("platform.tenants.col.tenant"),
    t("platform.tenants.col.action"),
  ]);
  await expectNoAxeViolations(page, "directory light");
  await darkTheme(page);
  await expect(rows).toHaveCount(3);
  await expectNoAxeViolations(page, "directory dark");
  await page.emulateMedia({ forcedColors: "active" });
  await expectFocusRing(page.getByLabel(t("platform.tenants.search.label")), "search");
  await expectFocusRing(rows.first().getByRole("button"), "row action");
});

test("search is client-side over name and slug, with a no-match state", async ({ page, t }) => {
  let reads = 0;
  await mock(page, noSession());
  await page.route("**/api/v1/tenants", (r) => {
    reads += 1;
    return r.fulfill(json(200, tenants));
  });
  await openDirectory(page, t);
  const search = page.getByLabel(t("platform.tenants.search.label"));
  await search.fill("pharma");
  await expect(directoryTable(page).locator("tbody tr")).toHaveCount(1);
  await expect(page.getByText(t("platform.tenants.count", { shown: 1, total: 3 }))).toBeVisible();
  await search.fill("zzz");
  await expect(page.getByText(t("platform.tenants.noMatch", { query: "zzz" }))).toBeVisible();
  expect(reads).toBe(1);
});

test("drawer: purpose and ticket only, no free-text reason; axe light and dark, focus rings in forced colors", async ({
  page,
  t,
}) => {
  await mock(page, noSession());
  await openDirectory(page, t);
  const drawer = await openDrawer(page, "أسواق الدلتا", t);
  await expect(drawer).toHaveAccessibleName(t("platform.start.title", { name: "أسواق الدلتا" }));
  await expect(drawer.locator("textarea")).toHaveCount(0);
  await expect(drawer.locator("select, input")).toHaveCount(2);
  await expect(drawer).toContainText(t("platform.start.suspended.body"));
  await expect(drawer).toContainText(t("platform.start.ticket.hint"));
  await expectNoAxeViolations(page, "start drawer light");
  // Validation errors are part of the checked state.
  await drawer.getByRole("button", { name: t("platform.start.submit") }).click();
  await expect(drawer.getByText(t("platform.start.purpose.required"))).toBeVisible();
  await expectNoAxeViolations(page, "start drawer with errors");
  await page.keyboard.press("Escape");
  await darkTheme(page);
  const dark = await openDrawer(page, "أسواق الدلتا", t);
  await expectNoAxeViolations(page, "start drawer dark");
  await page.emulateMedia({ forcedColors: "active" });
  await expectFocusRing(dark.getByLabel(t("platform.start.purpose.label")), "purpose");
  await expectFocusRing(dark.getByLabel(t("platform.start.ticket.label")), "ticket");
  // A button shows its ring on keyboard focus (:focus-visible): reach it by Tab.
  await page.keyboard.press("Tab");
  const submit = dark.getByRole("button", { name: t("platform.start.submit") });
  await expect(submit).toBeFocused();
  await expectFocusRing(submit, "submit", true);
  const edge = await dark.evaluate((el) => getComputedStyle(el).borderInlineStartStyle);
  expect(edge).toBe("solid");
});

test("client validation: no purpose, or a ticket that breaks the pattern, sends nothing", async ({
  page,
  t,
}) => {
  const server = await mock(page, noSession());
  await openDirectory(page, t);
  const drawer = await openDrawer(page, "Nile Pharma", t);
  await drawer.getByRole("button", { name: t("platform.start.submit") }).click();
  await expect(drawer.getByText(t("platform.start.purpose.required"))).toBeVisible();
  await drawer.getByLabel(t("platform.start.purpose.label")).selectOption("incident");
  await drawer.getByLabel(t("platform.start.ticket.label")).fill("ops@kemetra.test");
  await drawer.getByRole("button", { name: t("platform.start.submit") }).click();
  await expect(drawer.getByText(t("platform.start.ticket.invalid"))).toBeVisible();
  expect(server.opens).toHaveLength(0);
});

for (const ticket of ["", "SUP-2291"]) {
  test(`201 ${ticket ? "with" : "without"} a ticket: the wire body carries only the contract's keys; the bar opens read-only`, async ({
    page,
    t,
  }) => {
    const server = await mock(page, noSession());
    server.openReply = {
      status: 201,
      body: summary(DELTA, { ticket_ref: ticket || null }),
      nextContext: inSession(DELTA, "أسواق الدلتا", { ticket_ref: ticket || null }),
    };
    await openDirectory(page, t);
    const drawer = await openDrawer(page, "أسواق الدلتا", t);
    await drawer.getByLabel(t("platform.start.purpose.label")).selectOption("customer_support");
    if (ticket) await drawer.getByLabel(t("platform.start.ticket.label")).fill(ticket);
    await drawer.getByRole("button", { name: t("platform.start.submit") }).click();
    const bar = page.getByRole("region", { name: t("platform.session.region") });
    await expect(bar).toHaveAttribute("data-state", "active");
    await expect(bar).toContainText(t("platform.session.readOnly"));
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(server.opens).toHaveLength(1);
    const body = server.opens[0] as Record<string, unknown>;
    const keys = ticket ? ["purpose", "tenant_id", "ticket_ref"] : ["purpose", "tenant_id"];
    expect(Object.keys(body).sort()).toEqual(keys);
    expect(body.tenant_id).toBe(DELTA);
    expect(body.purpose).toBe("customer_support");
    if (ticket) expect(body.ticket_ref).toBe(ticket);
  });
}

test("suspended tenant: the 201 opens the same read-only session; no not-available state, no break-glass", async ({
  page,
  t,
}) => {
  const server = await mock(page, noSession());
  server.openReply = {
    status: 201,
    body: summary(FAJR),
    nextContext: inSession(FAJR, "سوبرماركت الفجر"),
  };
  await openDirectory(page, t);
  const drawer = await openDrawer(page, "سوبرماركت الفجر", t);
  await drawer.getByLabel(t("platform.start.purpose.label")).selectOption("incident");
  await drawer.getByRole("button", { name: t("platform.start.submit") }).click();
  const bar = page.getByRole("region", { name: t("platform.session.region") });
  await expect(bar).toContainText(t("platform.session.readOnly"));
  await expect(bar).toContainText("سوبرماركت الفجر");
  await expect(page.getByText(t("platform.start.notFound.title"))).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/break.?glass|كتابة طارئة/i);
});

test("404 TenantNotFound: the one non-disclosing state; back re-reads the list; axe", async ({
  page,
  t,
}) => {
  const server = await mock(page, noSession());
  server.openReply = { status: 404, body: refusal("not_found") };
  await openDirectory(page, t);
  const drawer = await openDrawer(page, "Nile Pharma", t);
  await drawer.getByLabel(t("platform.start.purpose.label")).selectOption("onboarding");
  await drawer.getByRole("button", { name: t("platform.start.submit") }).click();
  await expect(drawer.getByText(t("platform.start.notFound.title"))).toBeVisible();
  await expect(drawer.getByText(t("platform.start.notFound.body"))).toBeVisible();
  await expect(drawer.locator("form")).toHaveCount(0);
  await expectNoAxeViolations(page, "tenant not available");
  await drawer.getByRole("button", { name: t("platform.start.notFound.back") }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("region", { name: t("platform.session.region") })).toHaveCount(0);
});

test("409 already_member: names the cause and the normal switch lands in the tenant", async ({
  page,
  t,
}) => {
  const server = await mock(page, noSession());
  server.openReply = { status: 409, body: refusal("already_member") };
  await openDirectory(page, t);
  const drawer = await openDrawer(page, "Nile Pharma", t);
  await drawer.getByLabel(t("platform.start.purpose.label")).selectOption("incident");
  await drawer.getByRole("button", { name: t("platform.start.submit") }).click();
  await expect(drawer.getByText(t("platform.start.member.title"))).toBeVisible();
  await expectNoAxeViolations(page, "already member");
  await drawer.getByRole("button", { name: t("platform.start.member.switch") }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(server.switches).toEqual([{ tenant_id: NILE }]);
});

test("a tenant the caller is a member of offers the normal switch, never a support session", async ({
  page,
  t,
}) => {
  const server = await mock(
    page,
    noSession([{ tenant_id: NILE, tenant_name: "Nile Pharma", role_code: "owner" }]),
  );
  await openDirectory(page, t);
  await expect(
    page.getByRole("button", {
      name: t("platform.tenants.action.startFor", { name: "Nile Pharma" }),
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: t("platform.tenants.action.switchFor", { name: "Nile Pharma" }) })
    .click();
  await expect(page).toHaveURL(/\/$/);
  expect(server.switches).toEqual([{ tenant_id: NILE }]);
  expect(server.opens).toHaveLength(0);
});

test("429 with Retry-After: the drawer names the cause, gates the button, and never retries", async ({
  page,
  t,
}) => {
  const server = await mock(page, noSession());
  server.openReply = {
    status: 429,
    body: refusal("rate_limited"),
    headers: { "Retry-After": "30" },
  };
  await openDirectory(page, t);
  const drawer = await openDrawer(page, "Nile Pharma", t);
  await drawer.getByLabel(t("platform.start.purpose.label")).selectOption("incident");
  const submit = drawer.getByRole("button", { name: t("platform.start.submit") });
  await submit.click();
  await expect(drawer.getByText(t("platform.start.error.rateLimited"))).toBeVisible();
  await expect(drawer.locator(".btn-primary")).toBeDisabled();
  // The existing shared RateLimitBanner carries the 429 for the page behind the drawer.
  await drawer.getByRole("button", { name: t("common.cancel") }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".rate-limit-banner").getByText(t("rateLimit.title"))).toBeVisible();
  expect(server.opens).toHaveLength(1);
});

test("forced colors: axe on the directory and the drawer (light, emulated before load)", async ({
  page,
  t,
}) => {
  await mock(page, noSession());
  await page.emulateMedia({ forcedColors: "active" });
  await openDirectory(page, t);
  await expect(directoryTable(page).locator("tbody tr")).toHaveCount(3);
  await expectNoAxeViolations(page, "directory forced colors");
  await openDrawer(page, "Nile Pharma", t);
  await expectNoAxeViolations(page, "start drawer forced colors");
});

test("a double click opens one session", async ({ page, t }) => {
  const server = await mock(page, noSession());
  server.openReply = {
    status: 201,
    body: summary(DELTA),
    nextContext: inSession(DELTA, "أسواق الدلتا"),
  };
  await page.route("**/api/v1/platform/support-sessions", async (r) => {
    server.opens.push(r.request().postDataJSON());
    await new Promise((resolve) => setTimeout(resolve, 300));
    server.context = inSession(DELTA, "أسواق الدلتا");
    return r.fulfill(json(201, summary(DELTA)));
  });
  await openDirectory(page, t);
  const drawer = await openDrawer(page, "أسواق الدلتا", t);
  await drawer.getByLabel(t("platform.start.purpose.label")).selectOption("incident");
  await drawer.locator(".btn-primary").dblclick();
  await expect(page.getByRole("region", { name: t("platform.session.region") })).toBeVisible();
  expect(server.opens).toHaveLength(1);
});

test.describe("expired bar copy (RT-781 lab finding, comment 13591)", () => {
  const expired = { status: "expired", expires_at: new Date(Date.now() - 60_000).toISOString() };

  test("on the directory: never 'working in', points at the list here; then a new session replaces it", async ({
    page,
    t,
  }) => {
    const server = await mock(page, inSession(DELTA, "أسواق الدلتا", expired));
    server.openReply = {
      status: 201,
      body: summary(NILE),
      nextContext: inSession(NILE, "Nile Pharma"),
    };
    await openDirectory(page, t);
    const bar = page.getByRole("region", { name: t("platform.session.region") });
    await expect(bar).toHaveAttribute("data-state", "expired");
    await expect(bar).toContainText(t("platform.session.tenantExpired", { name: "أسواق الدلتا" }));
    await expect(bar).not.toContainText(t("platform.session.tenant", { name: "أسواق الدلتا" }));
    await expect(bar).toContainText(t("platform.session.notice.expired.bodyHere"));
    await expect(bar.getByRole("link")).toHaveCount(0);
    await expectNoAxeViolations(page, "expired bar on the directory");

    const drawer = await openDrawer(page, "Nile Pharma", t);
    await expect(drawer).toContainText(t("platform.start.replaces"));
    await drawer.getByLabel(t("platform.start.purpose.label")).selectOption("incident");
    await drawer.getByRole("button", { name: t("platform.start.submit") }).click();
    await expect(bar).toHaveAttribute("data-state", "active");
    await expect(bar).toContainText(t("platform.session.tenant", { name: "Nile Pharma" }));
  });

  test("in the tenant shell: the notice links to the directory by its real name", async ({
    page,
    t,
  }) => {
    await mock(page, inSession(DELTA, "أسواق الدلتا", expired));
    await page.goto("/");
    const bar = page.getByRole("region", { name: t("platform.session.region") });
    await expect(bar).toHaveAttribute("data-state", "expired");
    await expect(bar).not.toContainText(t("platform.session.tenant", { name: "أسواق الدلتا" }));
    const link = bar.getByRole("link", { name: t("platform.session.notice.expired.directory") });
    await expect(link).toHaveAttribute("href", "/platform/tenants");
    await expectNoAxeViolations(page, "expired bar in the tenant shell");
    await link.click();
    await expect(page).toHaveURL(/\/platform\/tenants$/);
    await expect(
      page.getByRole("heading", { level: 1, name: t("platform.tenants.title") }),
    ).toBeVisible();
  });
});

test.describe("compact shell", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the drawer's primary action is at least 44px; axe on directory and drawer", async ({
    page,
    t,
  }) => {
    await mock(page, noSession());
    await openDirectory(page, t);
    await expectNoAxeViolations(page, "directory 390");
    const drawer = await openDrawer(page, "Nile Pharma", t);
    const box = await drawer.locator(".btn-primary").boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
    await expectNoAxeViolations(page, "start drawer 390");
  });
});
