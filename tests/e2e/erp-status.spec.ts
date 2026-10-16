import { type Page, expect, test } from "./fixtures";

/**
 * RT-560 ERP connection & sync status (spec 016 Phase A) E2E against mocked
 * Backend-Core (C-5), in both locales (copy from the catalog via `t`).
 * S1: owner → role-gated nav → today's main: every instance reads "no signal",
 *     each C3 domain is its own tile, empty backlog, run history linking to
 *     Stock discrepancies; every request stays on Backend-Core `/api/v1/`.
 * S2: tenant_admin store filter narrows the C3 reads only.
 * S3: store_manager — no nav entry, NoAccess on the direct URL, no ERP request.
 * S4: a failed C1 read shows the error banner with its request id.
 */
const STORE = "0190f000-0000-7000-8000-0000000000a1";
const INSTANCE = "0190f000-0000-7000-8000-0000000000e1";
const ERP_PATHS = /\/api\/v1\/(connector|catalog\/erpnext-sync-ops)\//;

function ctx(role: string) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: role,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
  };
}

const store = { id: STORE, tenant_id: "t1", code: "MAD", name: "Maadi", is_active: true };

const instance = {
  id: INSTANCE,
  display_name: "Northstar ERP",
  erpnext_site_ref: "erp.northstar.eg",
  environment: "pilot",
  created_at: "2026-09-01T08:00:00Z",
  disabled_at: null,
  active_credential: null,
};

const health = {
  connectorId: INSTANCE,
  displayName: "Northstar ERP",
  environment: "pilot",
  erpnextSiteRef: "erp.northstar.eg",
  lastSeenAt: null,
  liveness: "never_seen",
  secondsSinceLastSeen: null,
  connectorVersion: null,
  backlogIndicator: null,
  erpnextReachable: null,
  reportedFieldsAt: null,
};

const summary = {
  domains: [
    { domain: "posting", status: "ok", headlineCount: 0, detail: "No posting dead-letters" },
    { domain: "reconciliation", status: "attention", headlineCount: 2, detail: null },
    { domain: "connector_health", status: "not_available", headlineCount: null, detail: null },
    { domain: "product_master", status: "not_available", headlineCount: null, detail: null },
  ],
};

const runs = {
  items: [
    {
      runId: "0190f000-0000-7000-8000-0000000000d1",
      storeId: STORE,
      kind: "stock",
      trigger: "scheduled",
      status: "completed",
      startedAt: "2026-10-12T02:00:00Z",
      finishedAt: "2026-10-12T02:03:00Z",
      mismatchSummary: { negative_on_hand: 2 },
    },
  ],
  nextCursor: null,
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/** Records every request the page makes, to prove the A-7 boundary. */
function recordRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (["fetch", "xhr"].includes(r.resourceType())) urls.push(r.url());
  });
  return urls;
}

async function mockBase(page: Page, role: string): Promise<void> {
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json([store])));
  await page.route("**/api/v1/connector/instances", (r) => r.fulfill(json({ items: [instance] })));
  await page.route("**/api/v1/connector/health", (r) => r.fulfill(json({ items: [health] })));
  await page.route("**/api/v1/catalog/erpnext-sync-ops/summary**", (r) => r.fulfill(json(summary)));
  await page.route("**/api/v1/catalog/erpnext-sync-ops/posting-backlog**", (r) =>
    r.fulfill(json({ items: [], nextCursor: null })),
  );
  await page.route("**/api/v1/catalog/erpnext-sync-ops/reconciliation-runs**", (r) =>
    r.fulfill(json(runs)),
  );
}

test("S1: owner sees no signal on today's main, separate domains, and a Backend-Core-only boundary", async ({
  page,
  t,
  baseURL,
}) => {
  const urls = recordRequests(page);
  await mockBase(page, "owner");
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: t("shell.nav.label") });
  await expect(nav.getByText(t("erp.nav.section"))).toBeVisible();
  await nav.getByRole("link", { name: t("erp.nav.label") }).click();
  await expect(page.getByRole("heading", { name: t("erp.title"), level: 1 })).toBeVisible();

  // A-2: no heartbeat sender on main → no signal; never connected, never an error.
  const connection = page.getByRole("region", { name: t("erp.conn.title") });
  const row = connection.getByRole("row", { name: /Northstar ERP/ });
  await expect(row.getByText(t("erp.signal.noSignal"))).toBeVisible();
  await expect(row.getByText(t("erp.conn.never"))).toBeVisible();
  await expect(connection.getByText(t("erp.signal.healthy"))).toHaveCount(0);
  await expect(connection.getByRole("alert")).toHaveCount(0);

  // A-4: one tile per domain; connector_health is not available, not "OK".
  const tiles = page.getByRole("region", { name: t("erp.summary.title") }).getByRole("listitem");
  await expect(tiles).toHaveCount(4);
  await expect(
    tiles
      .filter({ hasText: t("erp.domain.connector_health") })
      .getByText(t("erp.domainStatus.notAvailable")),
  ).toBeVisible();
  await expect(
    tiles
      .filter({ hasText: t("erp.domain.reconciliation") })
      .getByText(t("erp.domainStatus.attention")),
  ).toBeVisible();

  // A-5: an empty backlog says so, with the read time.
  const backlog = page.getByRole("region", { name: t("erp.backlog.title") });
  await expect(backlog.getByText(t("erp.backlog.empty"))).toBeVisible();

  // Run history links to the shipped Stock discrepancies screen for detail.
  const history = page.getByRole("region", { name: t("erp.runs.title") });
  await expect(history.getByRole("row", { name: /Maadi/ })).toBeVisible();
  await expect(
    history.getByRole("link", { name: t("shell.nav.stockDiscrepancies") }),
  ).toHaveAttribute("href", "/stock-discrepancies");

  // A-7: every request went to this origin's Backend-Core API.
  const erpCalls = urls.filter((u) => ERP_PATHS.test(u));
  expect(erpCalls.length).toBeGreaterThanOrEqual(5);
  for (const url of urls) {
    expect(url.startsWith(`${baseURL}/api/v1/`), url).toBe(true);
    expect(url).not.toContain("/api/connector/");
  }
});

test("S2: the store filter narrows the C3 reads; the connection stays tenant-wide", async ({
  page,
  t,
}) => {
  const urls = recordRequests(page);
  await mockBase(page, "tenant_admin");
  await page.goto("/erp-connection");
  await expect(page.getByRole("row", { name: /Northstar ERP/ })).toBeVisible();

  await page.getByLabel(t("erp.filter.store")).selectOption(STORE);
  await expect(page).toHaveURL(new RegExp(`store=${STORE}`));
  for (const path of ["summary", "posting-backlog", "reconciliation-runs"]) {
    await expect
      .poll(() => urls.some((u) => u.includes(`/erpnext-sync-ops/${path}?store_id=${STORE}`)))
      .toBe(true);
  }
  expect(urls.filter((u) => u.includes("/connector/") && u.includes("store_id"))).toEqual([]);
});

test("S3: store_manager has no entry, and the direct URL is NoAccess with no ERP request", async ({
  page,
  t,
}) => {
  const urls = recordRequests(page);
  await mockBase(page, "store_manager");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  await expect(page.getByRole("link", { name: t("erp.nav.label") })).toHaveCount(0);

  await page.goto("/erp-connection");
  await expect(page.getByRole("heading", { name: t("auth.noAccess.title") })).toBeVisible();
  expect(urls.filter((u) => ERP_PATHS.test(u))).toEqual([]);
});

test("S4: a failed connector read shows the error with its request id", async ({ page, t }) => {
  await mockBase(page, "owner");
  await page.route("**/api/v1/connector/instances", (r) =>
    r.fulfill(
      json(
        {
          error: {
            code: "system_failure",
            message: "x",
            request_id: "9f0c2a1e-0000-4000-8000-000000000001",
          },
        },
        500,
      ),
    ),
  );
  await page.goto("/erp-connection");
  const alert = page.getByRole("region", { name: t("erp.conn.title") }).getByRole("alert");
  await expect(alert).toContainText(t("erp.conn.loadFailed"));
  await expect(alert).toContainText("9f0c2a1e-0000-4000-8000-000000000001");
});
