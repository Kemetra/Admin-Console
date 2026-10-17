import { type Page, expect, test } from "./fixtures";

/**
 * RT-587 sales search and sale detail E2E against mocked Backend-Core (C-5).
 * S1: role-gated nav → query prompt → store + business-date range → server
 * rows → detail (void, partial return, ERP unknown) → Back keeps the query;
 * only console routes are requested (AC-15).
 * S2: an empty page with a cursor offers Load more, never "no sales" (AC-1/13).
 * S3: store_staff has no entry; a direct list or detail URL reads as not found.
 * S4: a range over 31 business days is refused before any request (AC-2).
 * RT-399: runs in both locales; copy comes from the catalog (`t`).
 */
const CAIRO = "0190f000-0000-7000-8000-0000000005a1";
const SALE = "0190f000-0000-7000-8000-0000000005b1";
const LINE = "0190f000-0000-7000-8000-0000000005e1";
const RANGE = `store=${CAIRO}&from=2026-10-01&to=2026-10-07`;

function ctx(role: string) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: role,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
  };
}

const store = {
  id: CAIRO,
  tenant_id: "t1",
  code: "CAI",
  name: "Cairo Festival",
  timezone: "Africa/Cairo",
  is_active: true,
};

function item(over: Record<string, unknown> = {}) {
  return {
    saleRef: SALE,
    storeRef: CAIRO,
    saleNumber: "R-0042",
    businessDate: "2026-10-07",
    occurredAt: "2026-10-07T10:30:00Z",
    receivedAt: "2026-10-07T10:30:04Z",
    device: { deviceRef: null, label: "Till 1", labelSource: "snapshot" },
    operator: { userRef: null, displayName: "Mona Adel", nameSource: "snapshot" },
    currencyCode: "EGP",
    posTotal: "30.0000",
    syncStatus: "synced",
    voided: true,
    returnState: "partial",
    erpPostingState: "unknown",
    ...over,
  };
}

const detail = {
  summary: item(),
  storeTimezone: "Africa/Cairo",
  lines: [
    {
      lineRef: LINE,
      sequence: 1,
      lineName: "Mineral water 1.5L",
      unitPrice: "10.0000",
      currencyCode: "EGP",
      quantity: "3",
      lineAmount: "30.0000",
      taxAmount: null,
      unit: "bottle",
      returnedQuantity: "1",
    },
  ],
  lineOrder: "recorded",
  tenderState: "unknown",
  tenders: [],
  changeGiven: null,
  settledAt: null,
  receiptNumber: "R-0042",
  receiptHeader: null,
  void: {
    voidedAt: "2026-10-07T11:00:00Z",
    voidBusinessDate: "2026-10-07",
    approved: true,
    approverRole: "store_manager",
  },
  returns: [
    {
      returnRef: "0190f000-0000-7000-8000-0000000005f1",
      recordedAt: "2026-10-07T10:50:00Z",
      businessDate: "2026-10-07",
      returnTotal: "10.0000",
      lines: [{ lineRef: LINE, quantity: "1", lineAmount: "10.0000" }],
    },
  ],
  erpPosting: {
    sale: "unknown",
    saleDocumentRef: null,
    reversal: "unknown",
    reversalDocumentRef: null,
  },
};

function page(items: unknown[], nextCursor: string | null) {
  return {
    items,
    nextCursor,
    asOf: "2026-10-08T09:15:00Z",
    storeRef: CAIRO,
    storeTimezone: "Africa/Cairo",
    from: "2026-10-01",
    to: "2026-10-07",
  };
}

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

const NOT_FOUND = json({ error: { code: "not_found", message: "Not found" } }, 404);

async function mockBase(page: Page, role: string): Promise<void> {
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json([store])));
  await page.route(`**/api/v1/stores/${CAIRO}`, (r) => r.fulfill(json(store)));
}

/** Records every list query and answers each with the next queued page. */
async function mockList(p: Page, pages: unknown[]): Promise<URLSearchParams[]> {
  const queries: URLSearchParams[] = [];
  await p.route("**/api/v1/sales?**", (r) => {
    queries.push(new URL(r.request().url()).searchParams);
    return r.fulfill(json(pages[Math.min(queries.length - 1, pages.length - 1)]));
  });
  return queries;
}

test("S1: owner → search → detail → Back keeps the query; console routes only", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  const queries = await mockList(p, [page([item()], null)]);
  await p.route(`**/api/v1/sales/${SALE}`, (r) => r.fulfill(json(detail)));

  await p.goto("/");
  // The Overview's own reads settle first, so the trace holds only the sales journey.
  await p.waitForLoadState("networkidle");
  // AC-15: trace every request the sales journey makes, from the nav click on.
  const requested: URL[] = [];
  p.on("request", (r) => requested.push(new URL(r.url())));
  await p.getByRole("link", { name: t("sales.nav.label") }).click();
  await expect(p.getByRole("heading", { name: t("sales.list.title") })).toBeVisible();
  await expect(p.getByText(t("sales.list.queryPrompt"))).toBeVisible();
  expect(queries).toHaveLength(0);

  await p.getByLabel(t("sales.filter.store")).selectOption(CAIRO);
  await p.getByLabel(t("sales.filter.from")).fill("2026-10-01");
  await p.getByLabel(t("sales.filter.to")).fill("2026-10-07");
  await p.getByLabel(t("sales.filter.returns")).selectOption("partial");
  await p.getByRole("button", { name: t("sales.filter.apply") }).click();
  await expect(p).toHaveURL(new RegExp(`/sales\\?${RANGE}&returns=partial$`));
  await expect.poll(() => queries.length).toBe(1);
  expect(Object.fromEntries(queries[0])).toEqual({
    store_id: CAIRO,
    from: "2026-10-01",
    to: "2026-10-07",
    return_state: "partial",
    page_size: "50",
  });

  const row = p.getByRole("row").filter({ hasText: "R-0042" });
  await expect(row).toContainText(t("sales.chip.voided"));
  await expect(row).toContainText(t("sales.erp.unknown"));
  await expect(p.getByText(t("sales.list.ended"))).toBeVisible();

  await row.click();
  await expect(
    p.getByRole("heading", { level: 1, name: t("sales.detail.title", { number: "R-0042" }) }),
  ).toBeVisible();
  await expect(p.getByText(t("sales.payments.unknown"))).toBeVisible();
  await expect(p.getByText(t("sales.void.approvedYes"), { exact: true })).toBeVisible();
  const returns = p.getByRole("region", { name: t("sales.section.returns") });
  await expect(returns.getByText("Mineral water 1.5L")).toBeVisible();
  const erp = p.getByRole("region", { name: t("sales.section.erp") });
  await expect(erp.getByText(t("sales.erp.unknown"))).toHaveCount(2);
  await expect(p.getByRole("link", { name: t("sales.related.shiftCloses") })).toHaveAttribute(
    "href",
    `/shift-closes?store=${CAIRO}&from=2026-10-07&to=2026-10-07`,
  );

  await p.getByRole("link", { name: t("sales.detail.back") }).click();
  await expect(p).toHaveURL(new RegExp(`/sales\\?${RANGE}&returns=partial$`));
  await expect(p.getByRole("heading", { level: 1, name: t("sales.list.title") })).toBeVisible();
  await expect(p.getByRole("combobox", { name: t("sales.filter.returns") })).toHaveValue("partial");

  // AC-15: only Backend-Core console routes on the app's own origin; no POS
  // route, ERPNext, Frappe or Connector request.
  const origin = new URL(p.url()).origin;
  expect(requested.filter((url) => url.origin !== origin)).toEqual([]);
  const api = [
    ...new Set(
      requested.filter((url) => url.pathname.startsWith("/api/")).map((url) => url.pathname),
    ),
  ];
  expect(api).toContain("/api/v1/sales");
  expect(api).toContain(`/api/v1/sales/${SALE}`);
  for (const path of api) expect(path).toMatch(/^\/api\/v1\/(sales|stores|context)(\/|$)/);
});

test("S2: an empty page with a cursor offers Load more, never 'no sales'", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "store_manager");
  const queries = await mockList(p, [page([], "c1"), page([item()], null)]);

  await p.goto(`/sales?${RANGE}&erp=unknown`);
  await expect(p.getByText(t("sales.list.partialPage"))).toBeVisible();
  await expect(p.getByText(/R-0042/)).toHaveCount(0);
  await p.getByRole("button", { name: t("sales.list.loadMore") }).click();
  await expect(p.getByRole("row").filter({ hasText: "R-0042" })).toBeVisible();
  expect(queries[1].get("cursor")).toBe("c1");
  expect(queries[1].get("erp_posting_state")).toBe("unknown");
  await expect(p.getByRole("button", { name: t("sales.list.loadMore") })).toHaveCount(0);
  await expect(p.getByText(t("sales.list.ended"))).toBeVisible();
});

test("S3: store_staff has no Sales entry; direct URLs read as not found", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "store_staff");
  await p.route("**/api/v1/sales?**", (r) => r.fulfill(NOT_FOUND));
  await p.route(`**/api/v1/sales/${SALE}`, (r) => r.fulfill(NOT_FOUND));

  await p.goto("/");
  await expect(p.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  await expect(p.getByRole("link", { name: t("sales.nav.label") })).toHaveCount(0);

  await p.goto(`/sales?${RANGE}`);
  await expect(p.getByText(t("sales.list.unavailable"))).toBeVisible();
  await expect(p.getByRole("table")).toHaveCount(0);

  await p.goto(`/sales/${SALE}`);
  await expect(p.getByText(t("sales.detail.notFound"))).toBeVisible();
});

test("S4: a range over 31 business days is refused before any request", async ({ page: p, t }) => {
  await mockBase(p, "tenant_admin");
  const queries = await mockList(p, [page([item()], null)]);

  await p.goto(`/sales?store=${CAIRO}&from=2026-10-01&to=2026-11-01`);
  await expect(p.getByText(t("sales.filter.spanTooWide"))).toBeVisible();
  await p.getByLabel(t("sales.filter.to")).fill("2026-10-31");
  await p.getByRole("button", { name: t("sales.filter.apply") }).click();
  await expect(p.getByRole("row").filter({ hasText: "R-0042" })).toBeVisible();
  expect(queries).toHaveLength(1);
  expect(queries[0].get("to")).toBe("2026-10-31");
});
