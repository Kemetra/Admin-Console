import { formatDateTime } from "../../src/i18n/format";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-18 shift-close variance review E2E against mocked Backend-Core (C-5).
 * S1: role-gated nav → list (non-zero variance floor sent, signed variance, store
 * time zone) → detail (cash reconciliation, recorded approver as attribution).
 * S2: a failed continuation page keeps the loaded rows and retries.
 * S3: cashier — no nav entry. S4: uniform 404 on the list and on a detail.
 * RT-399: runs in both locales; copy comes from the catalog (`t`), mocked data
 * (store names, ids, amounts) stays as authored.
 */
const DUBAI = "0190f000-0000-7000-8000-0000000000a1";
const SHIFT_1 = "0190f000-0000-7000-8000-0000000000b1";
const SHIFT_2 = "0190f000-0000-7000-8000-0000000000b2";
const USER = "0190f000-0000-7000-8000-0000000000c1";
const CLOSED_AT = "2026-10-07T20:30:00Z";

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
  id: DUBAI,
  tenant_id: "t1",
  code: "DXB",
  name: "Dubai Mall",
  timezone: "Asia/Dubai",
  is_active: true,
};

function summary(shiftId: string, over: Record<string, unknown> = {}) {
  return {
    shiftId,
    storeId: DUBAI,
    currencyCode: "EGP",
    closedAt: CLOSED_AT,
    closeKind: "normal",
    forcedReason: null,
    closingUserId: USER,
    varianceApprovedByUserId: null,
    openingFloat: "500.0000",
    cashSalesTotal: "2500.0000",
    cashRefundsTotal: "100.0000",
    payInTotal: "0.0000",
    payOutTotal: "50.0000",
    expectedCash: "2850.0000",
    countedCash: "2875.0000",
    variance: "25.0000",
    saleCount: 42,
    receivedAt: "2026-10-07T20:31:12Z",
    ...over,
  };
}

const detail = {
  ...summary(SHIFT_1, {
    variance: "-40.0000",
    countedCash: "2810.0000",
    varianceApprovedByUserId: USER,
  }),
  openedAt: "2026-10-07T08:05:00Z",
  openingUserId: USER,
  recordedByUserId: USER,
  cashRefundReturnRefs: ["RET-0001"],
  cashMovements: [
    {
      movementId: "0190f000-0000-7000-8000-0000000000d1",
      kind: "pay_out",
      amount: "50.0000",
      reasonCode: "petty_expense",
      note: "Cleaning supplies",
      occurredAt: "2026-10-07T12:00:00Z",
      recordedByUserId: USER,
      receivedAt: "2026-10-07T12:00:05Z",
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
  await page.route(`**/api/v1/stores/${DUBAI}`, (r) => r.fulfill(json(store)));
}

test("S1: owner → list (floor, signed variance, store zone) → detail", async ({
  page,
  t,
  appLocale,
}) => {
  await mockBase(page, "owner");
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/shift-closes?**", (r) => {
    queries.push(new URL(r.request().url()).searchParams);
    return r.fulfill(
      json({ items: [summary(SHIFT_1, { variance: "-40.0000" })], nextCursor: null }),
    );
  });
  await page.route(`**/api/v1/shift-closes/${SHIFT_1}`, (r) => r.fulfill(json(detail)));

  await page.goto("/");
  await page.getByRole("link", { name: t("shell.nav.shiftCloses") }).click();
  await expect(page.getByRole("heading", { name: t("shift.list.title") })).toBeVisible();

  // Exception = non-zero variance: the server is asked for it, the page does not filter.
  const row = page.getByRole("row", { name: /Dubai Mall/ });
  await expect(row).toBeVisible();
  expect(queries[0].get("min_abs_variance")).toBe("0.0001");
  await expect(row.getByText("-40.00 EGP")).toBeVisible();
  await expect(row.getByText(t("shift.variance.short"))).toBeVisible();
  // 20:30Z is the next day, 00:30, in Dubai (+4).
  await expect(
    row.getByText(formatDateTime(CLOSED_AT, { timeZone: "Asia/Dubai", locale: appLocale })),
  ).toBeVisible();

  await row.click();
  await expect(page.getByRole("heading", { name: t("shift.detail.title") })).toBeVisible();
  await expect(page.getByText("2,810.00 EGP")).toBeVisible();
  // The approver is attribution as recorded, and the variance is unchanged.
  await expect(page.getByText(t("shift.approval.note"))).toBeVisible();
  await expect(page.getByText("-40.00 EGP")).toBeVisible();
  await expect(page.getByText("Cleaning supplies")).toBeVisible();

  await page.getByRole("link", { name: t("shift.detail.back") }).click();
  await expect(page.getByRole("heading", { name: t("shift.list.title") })).toBeVisible();
});

test("S2: a failed continuation keeps the loaded rows and retries", async ({ page, t }) => {
  await mockBase(page, "tenant_admin");
  let secondPageCalls = 0;
  await page.route("**/api/v1/shift-closes?**", (r) => {
    const cursor = new URL(r.request().url()).searchParams.get("cursor");
    if (!cursor) return r.fulfill(json({ items: [summary(SHIFT_1)], nextCursor: "c2" }));
    secondPageCalls += 1;
    if (secondPageCalls === 1) {
      return r.fulfill(json({ error: { code: "system_failure", message: "x" } }, 500));
    }
    return r.fulfill(
      json({ items: [summary(SHIFT_2, { variance: "-5.0000" })], nextCursor: null }),
    );
  });

  await page.goto("/shift-closes");
  await expect(page.getByRole("row", { name: /Dubai Mall/ })).toHaveCount(1);
  await page.getByRole("button", { name: t("shift.list.loadMore") }).click();
  await expect(page.getByText(t("shift.list.inlineError"))).toBeVisible();
  // The proven row is still there.
  await expect(page.getByRole("row", { name: /Dubai Mall/ })).toHaveCount(1);

  await page.getByRole("button", { name: t("shift.list.retry") }).click();
  await expect(page.getByRole("row", { name: /Dubai Mall/ })).toHaveCount(2);
  await expect(page.getByText(t("shift.list.inlineError"))).toHaveCount(0);
});

test("S3: cashier has no nav entry", async ({ page, t }) => {
  await mockBase(page, "cashier");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  await expect(page.getByRole("link", { name: t("shell.nav.shiftCloses") })).toHaveCount(0);
});

test("S4: the uniform 404 is unavailable on the list and not-found on a detail", async ({
  page,
  t,
}) => {
  await mockBase(page, "store_manager");
  const refusal = json({ error: { code: "not_found", message: "Not found" } }, 404);
  await page.route("**/api/v1/shift-closes?**", (r) => r.fulfill(refusal));
  await page.goto("/shift-closes");
  await expect(page.getByText(t("shift.list.unavailable"))).toBeVisible();
  await expect(page.getByText(t("shift.list.empty"))).toHaveCount(0);

  await page.route(`**/api/v1/shift-closes/${SHIFT_2}`, (r) => r.fulfill(refusal));
  await page.goto(`/shift-closes/${SHIFT_2}`);
  await expect(page.getByText(t("shift.detail.notFound"))).toBeVisible();
});
