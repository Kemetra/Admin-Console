import { type Page, expect, test } from "./fixtures";

/**
 * RT-727 ERPNext product-master reconciliation E2E against mocked Backend-Core,
 * in both locales (copy from the catalog via `t`).
 * S1 (happy path): owner → Integration nav → backlog → map an unmapped product
 *     (confirmed, one strict request with an Idempotency-Key) → start a run
 *     (confirmed) → open its results; every request stays on Backend-Core.
 * S2: store_manager — no nav entry, NoAccess on the direct URL, no request.
 */
const PRODUCT = "0190f000-0000-7000-8000-0000000000b1";
const SUGGESTED = "0190f000-0000-7000-8000-0000000000b2";
const RUN = "0190f000-0000-7000-8000-0000000000d1";
const RESULT = "0190f000-0000-7000-8000-0000000000e1";
const RECON = /\/api\/v1\/catalog\/erpnext-product-reconciliation\//;

function ctx(role: string) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: role,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
  };
}

const backlog = {
  items: [
    {
      tenantProductId: PRODUCT,
      mismatchClass: "unmapped_dp2_product",
      suggestionMappingId: null,
      suggestionSource: null,
      suggestedBy: null,
      suggestedAt: null,
      erpnextItemRef: null,
      observedAt: "2026-10-19T08:00:00Z",
    },
    {
      tenantProductId: SUGGESTED,
      mismatchClass: "suggestion_unconfirmed",
      suggestionMappingId: "0190f000-0000-7000-8000-0000000000c2",
      suggestionSource: "manual",
      suggestedBy: null,
      suggestedAt: "2026-10-18T09:00:00Z",
      erpnextItemRef: "ITEM-COLA-330",
      observedAt: "2026-10-19T08:00:00Z",
    },
  ],
  nextCursor: null,
};

const startedRun = {
  id: RUN,
  trigger: "on_demand",
  status: "running",
  erpnextViewStatus: "available",
  startedAt: "2026-10-19T08:10:00Z",
  finishedAt: null,
  summary: null,
};

const results = {
  items: [
    {
      id: RESULT,
      runId: RUN,
      mismatchClass: "attribute_drift",
      tenantProductId: PRODUCT,
      erpnextItemRef: "ITEM-WATER-1L",
      resultState: "open",
      detail: { attributes: { uom: "Nos" } },
    },
  ],
  nextCursor: null,
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

function recordRequests(page: Page): { method: string; url: string }[] {
  const calls: { method: string; url: string }[] = [];
  page.on("request", (r) => {
    if (["fetch", "xhr"].includes(r.resourceType()))
      calls.push({ method: r.method(), url: r.url() });
  });
  return calls;
}

async function mockBase(page: Page, role: string): Promise<void> {
  let runs: unknown[] = [];
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/catalog/erpnext-product-reconciliation/backlog**", (r) =>
    r.fulfill(json(backlog)),
  );
  await page.route("**/api/v1/catalog/erpnext-product-reconciliation/runs", (r) => {
    if (r.request().method() === "POST") {
      runs = [startedRun];
      return r.fulfill(json(startedRun, 201));
    }
    return r.fulfill(json({ items: runs, nextCursor: null }));
  });
  await page.route("**/api/v1/catalog/erpnext-product-reconciliation/runs?**", (r) =>
    r.fulfill(json({ items: runs, nextCursor: null })),
  );
  await page.route(`**/api/v1/catalog/erpnext-product-reconciliation/runs/${RUN}/results**`, (r) =>
    r.fulfill(json(results)),
  );
  await page.route("**/api/v1/catalog/erpnext-product-reconciliation/repairs", (r) =>
    r.fulfill(
      json(
        {
          targetKind: "backlog_item",
          targetRef: PRODUCT,
          repairKind: "suggest_confirm",
          outcome: "mapped",
          resolvedItemMapId: "0190f000-0000-7000-8000-0000000000c9",
          recordedAt: "2026-10-19T08:05:00Z",
        },
        201,
      ),
    ),
  );
}

test("S1: owner maps an unmapped product, starts a run and opens its results", async ({
  page,
  t,
  baseURL,
}) => {
  const calls = recordRequests(page);
  await mockBase(page, "owner");
  const repairRequest = page.waitForRequest(
    (r) => r.url().endsWith("/erpnext-product-reconciliation/repairs") && r.method() === "POST",
  );

  await page.goto("/");
  const nav = page.getByRole("navigation", { name: t("shell.nav.label") });
  await expect(nav.getByText(t("erp.nav.section"))).toHaveCount(1);
  await nav.getByRole("link", { name: t("productRecon.nav.label") }).click();
  await expect(
    page.getByRole("heading", { name: t("productRecon.title"), level: 1 }),
  ).toBeVisible();

  // Backlog: the unmapped product can be mapped; the suggestion says where it is confirmed.
  const backlogPanel = page.getByRole("region", { name: t("productRecon.backlog.title") });
  const unmapped = backlogPanel.getByRole("row", { name: new RegExp(PRODUCT) });
  await expect(unmapped.getByText(t("productRecon.class.unmapped_dp2_product"))).toBeVisible();
  const suggestion = backlogPanel.getByRole("row", { name: new RegExp(SUGGESTED) });
  await expect(suggestion.getByText("ITEM-COLA-330")).toBeVisible();
  await expect(suggestion.getByText(t("productRecon.repair.needsVersion"))).toBeVisible();

  // Repair: type → review → confirm. Nothing is sent before the confirm.
  await unmapped.getByRole("button", { name: t("productRecon.repair.open") }).click();
  const repair = page.getByRole("region", { name: t("productRecon.repair.label") });
  await repair.getByLabel(t("productRecon.repair.ref")).fill("ITEM-WATER-1L");
  await repair.getByRole("button", { name: t("productRecon.repair.review") }).click();
  expect(calls.filter((c) => c.method === "POST")).toEqual([]);
  await repair.getByRole("button", { name: t("productRecon.repair.confirm") }).click();
  await expect(repair.getByText(t("productRecon.repair.outcome.mapped"))).toBeVisible();
  const sent = await repairRequest;
  expect(sent.postDataJSON()).toEqual({
    repairKind: "suggest_confirm",
    tenantProductId: PRODUCT,
    erpnextItemRef: "ITEM-WATER-1L",
  });
  expect(sent.headers()["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);

  // Start a run: confirm step, then the started run as returned.
  const runsPanel = page.getByRole("region", { name: t("productRecon.runs.title") });
  await expect(runsPanel.getByText(t("productRecon.runs.empty"))).toBeVisible();
  await runsPanel.getByRole("button", { name: t("productRecon.trigger.start") }).click();
  await runsPanel.getByRole("button", { name: t("productRecon.trigger.confirm") }).click();
  await expect(
    runsPanel.getByText(
      t("productRecon.trigger.started", {
        status: t("productRecon.runs.status.running"),
        view: t("productRecon.runs.view.available"),
      }),
    ),
  ).toBeVisible();

  // The history re-reads and links to the run's results.
  await runsPanel.getByRole("link", { name: t("productRecon.runs.viewResults") }).click();
  await expect(page).toHaveURL(new RegExp(`/product-reconciliation/runs/${RUN}$`));
  const resultsPanel = page.getByRole("region", { name: t("productRecon.results.title") });
  const line = resultsPanel.getByRole("row", { name: /ITEM-WATER-1L/ });
  await expect(line.getByText(t("productRecon.class.attribute_drift"))).toBeVisible();
  await expect(line.getByText('{"uom":"Nos"}')).toBeVisible();

  // Exactly one repair and one trigger; every request stayed on this origin's API.
  expect(calls.filter((c) => c.method === "POST" && RECON.test(c.url))).toHaveLength(2);
  for (const { url } of calls) {
    expect(url.startsWith(`${baseURL}/api/v1/`), url).toBe(true);
  }
});

test("S2: store_manager has no entry, and the direct URL is NoAccess with no request", async ({
  page,
  t,
}) => {
  const calls = recordRequests(page);
  await mockBase(page, "store_manager");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  await expect(page.getByRole("link", { name: t("productRecon.nav.label") })).toHaveCount(0);

  await page.goto("/product-reconciliation");
  await expect(page.getByRole("heading", { name: t("auth.noAccess.title") })).toBeVisible();
  expect(calls.filter((c) => RECON.test(c.url))).toEqual([]);
});
