import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-726 sale sync-ops E2E against mocked Backend-Core (C-5).
 * S1 (happy path): owner → "Sales needing repair" → the queue row → the sale
 * detail with its sync status, quarantined item and timeline → Request repair
 * → confirm → exactly one POST with an Idempotency-Key → the server's new
 * status. Only Backend-Core console routes are requested.
 * S2: store_manager sees the sale but no sync sections, no nav entry and no
 * sync-ops request; the list URL reads as no access.
 * RT-399: runs in both locales; copy comes from the catalog (`t`).
 */
const CAIRO = "0190f000-0000-7000-8000-0000000007a1";
const SALE = "0190f000-0000-7000-8000-0000000007b1";
const SYNC = "/api/v1/catalog/sale-sync-ops";

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

const summary = {
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
  syncStatus: "failed-needs-repair",
  voided: false,
  returnState: "none",
  erpPostingState: "unknown",
};

const detail = {
  summary,
  storeTimezone: "Africa/Cairo",
  lines: [],
  lineOrder: "recorded",
  tenderState: "unknown",
  tenders: [],
  changeGiven: null,
  settledAt: null,
  receiptNumber: "R-0042",
  receiptHeader: null,
  void: null,
  returns: [],
  erpPosting: { sale: "unknown", saleDocumentRef: null, reversal: null, reversalDocumentRef: null },
};

const needsRepair = {
  saleRef: SALE,
  storeId: CAIRO,
  syncStatus: "failed-needs-repair",
  sourceSystem: "pos",
  externalId: "POS-CAI-0042",
  deadLetter: {
    classification: "needs-repair",
    reasonCode: "validation_error",
    retryCount: 3,
    quarantinedAt: "2026-10-07T10:31:00Z",
    resolvedAt: null,
  },
  processedAt: null,
};

const requeued = { ...needsRepair, syncStatus: "failed-retryable", deadLetter: null };

const queueItem = {
  saleRef: SALE,
  storeId: CAIRO,
  syncStatus: "failed-needs-repair",
  sourceSystem: "pos",
  externalId: "POS-CAI-0042",
  reasonCode: "validation_error",
  retryCount: 3,
  quarantinedAt: "2026-10-07T10:31:00Z",
};

const timeline = {
  saleRef: SALE,
  entries: [
    { at: "2026-10-07T10:30:04Z", event: "sale.captured", correlationId: null },
    {
      at: "2026-10-07T10:31:00Z",
      event: "sync.needs_repair",
      correlationId: "0190f000-0000-7000-8000-0000000007c1",
    },
  ],
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function mockBase(page: Page, role: string): Promise<void> {
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json([store])));
  await page.route(`**/api/v1/stores/${CAIRO}`, (r) => r.fulfill(json(store)));
  await page.route(`**/api/v1/sales/${SALE}`, (r) => r.fulfill(json(detail)));
}

test("S1: owner → queue → sale → confirmed repair → the server's status", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  let repaired = false;
  const repairs: { key: string | null; method: string }[] = [];
  await p.route(`**${SYNC}/needs-repair**`, (r) =>
    r.fulfill(json({ items: [queueItem], nextCursor: null })),
  );
  await p.route(`**${SYNC}/sales/${SALE}/status`, (r) =>
    r.fulfill(json(repaired ? requeued : needsRepair)),
  );
  await p.route(`**${SYNC}/sales/${SALE}/audit-timeline`, (r) => r.fulfill(json(timeline)));
  await p.route(`**${SYNC}/sales/${SALE}/repair`, (r) => {
    repairs.push({
      key: r.request().headers()["idempotency-key"] ?? null,
      method: r.request().method(),
    });
    repaired = true;
    return r.fulfill(json(requeued));
  });

  await p.goto("/");
  await p.waitForLoadState("networkidle");
  const requested: URL[] = [];
  p.on("request", (r) => requested.push(new URL(r.url())));

  await p.getByRole("link", { name: t("saleSync.nav.label") }).click();
  await expect(p.getByRole("heading", { level: 1, name: t("saleSync.list.title") })).toBeVisible();
  await expect(p.getByText(t("saleSync.list.note"))).toBeVisible();
  const row = p.getByRole("row").filter({ hasText: "POS-CAI-0042" });
  await expect(row).toContainText("validation_error");
  await expect(row).toContainText("Cairo Festival");
  await expectNoAxeViolations(p, "needs-repair list");

  await row
    .getByRole("link", { name: t("saleSync.list.openSale", { ref: "POS-CAI-0042" }) })
    .click();
  await expect(p).toHaveURL(new RegExp(`/sales/${SALE}$`));
  const status = p.getByRole("region", { name: t("saleSync.section.status") });
  await expect(status.getByText(t("saleSync.meaning.failedNeedsRepair"))).toBeVisible();
  await expect(status.getByText("validation_error")).toBeVisible();
  const history = p.getByRole("region", { name: t("saleSync.section.timeline") });
  await expect(history.getByText(t("saleSync.event.syncNeedsRepair"))).toBeVisible();
  // The ERPNext posting state stays its own section, and stays unknown.
  const erp = p.getByRole("region", { name: t("sales.section.erp") });
  await expect(erp.getByText(t("sales.erp.unknown"))).toBeVisible();

  await status.getByRole("button", { name: t("saleSync.repair.action") }).click();
  const confirm = status.getByRole("region", { name: t("saleSync.repair.confirmLabel") });
  await expect(confirm).toContainText("POS-CAI-0042");
  await expectNoAxeViolations(p, "sale detail with repair confirmation");
  expect(repairs).toHaveLength(0);
  await confirm.getByRole("button", { name: t("saleSync.repair.confirm") }).click();

  await expect(
    status.getByText(
      t("saleSync.repair.success", { status: t("saleSync.status.failedRetryable") }),
    ),
  ).toBeVisible();
  await expect(status.getByRole("button", { name: t("saleSync.repair.action") })).toHaveCount(0);
  expect(repairs).toHaveLength(1);
  expect(repairs[0].method).toBe("POST");
  expect(repairs[0].key).toMatch(/^[0-9a-f-]{36}$/);

  // Only Backend-Core console routes on the app's own origin: no POS route,
  // ERPNext, Frappe or Connector request.
  const origin = new URL(p.url()).origin;
  expect(requested.filter((url) => url.origin !== origin)).toEqual([]);
  const api = [
    ...new Set(requested.filter((u) => u.pathname.startsWith("/api/")).map((u) => u.pathname)),
  ];
  expect(api).toContain(`${SYNC}/sales/${SALE}/repair`);
  for (const path of api) {
    expect(path).toMatch(/^\/api\/v1\/(sales|stores|context|catalog\/sale-sync-ops)(\/|$)/);
  }
});

test("S2: store_manager sees the sale without sync-ops; the list is no access", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "store_manager");
  const syncCalls: string[] = [];
  await p.route(`**${SYNC}/**`, (r) => {
    syncCalls.push(r.request().url());
    return r.fulfill(json({ error: { code: "not_found", message: "Not found." } }, 404));
  });

  await p.goto("/");
  await expect(p.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  await expect(p.getByRole("link", { name: t("saleSync.nav.label") })).toHaveCount(0);

  await p.goto(`/sales/${SALE}`);
  await expect(p.getByRole("region", { name: t("sales.section.erp") })).toBeVisible();
  await expect(p.getByRole("region", { name: t("saleSync.section.status") })).toHaveCount(0);

  await p.goto("/sales-needing-repair");
  await expect(p.getByRole("heading", { level: 1, name: t("saleSync.list.title") })).toHaveCount(0);
  expect(syncCalls).toEqual([]);
});
