import { formatMoney } from "../../src/i18n/format";
import { type Page, expect, test } from "./fixtures";

/**
 * 018 receivables E2E (VG-2). Active tenant → receivable table; Submit-claim
 * journey (row action → drawer → 201 → close + refetch); no active tenant →
 * RF-1 ScopeGate (list wrapper never reached). Mocked DP2 (C-5). Applies the
 * 017 E2E lessons: scope the submit click to the drawer dialog; ScopeGate needs
 * a membership present.
 *
 * RT-399: runs in both locales; every copy selector comes from the catalog via
 * `t()`, and Money values are asserted in their formatted form (`120.00 EGP`).
 * Mocked data (names, IDs) stays as authored.
 */
const user = {
  id: "u1",
  email: "amal@northstar.eg",
  display_name: "Amal Saleh",
  is_platform_admin: true,
};

async function mockBase(page: Page, ctx: unknown): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
}

const withTenant = {
  user,
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "tenant_admin",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
};

function receivable(over: Record<string, unknown> = {}) {
  return {
    receivableRef: "r1",
    saleRef: "s1",
    payerRef: "p1",
    outstandingBalance: "120.00",
    state: "open",
    erpnextPaymentEntryRef: null,
    version: 0,
    ...over,
  };
}

test("S1: active tenant → receivable table renders (balance formatted)", async ({ page, t }) => {
  await mockBase(page, withTenant);
  await page.route("**/api/v1/settlement/receivables**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [receivable()], nextCursor: null }),
    }),
  );

  await page.goto("/receivables");
  await expect(
    page.getByRole("heading", { name: t("receivables.list.title"), exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: formatMoney("120.00"), exact: true })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: t("receivables.state.open"), exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: t("receivables.list.notPosted"), exact: true }),
  ).toBeVisible();
});

test("S2: submit-claim journey → drawer → 201 → closes", async ({ page, t }) => {
  await mockBase(page, withTenant);
  await page.route("**/api/v1/settlement/claims", (r) =>
    r.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        claimRef: "c1",
        payerRef: "p1",
        status: "submitted",
        receivableRefs: ["r1"],
      }),
    }),
  );
  await page.route("**/api/v1/settlement/receivables**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [receivable()], nextCursor: null }),
    }),
  );

  await page.goto("/receivables");
  await page.getByRole("button", { name: t("receivables.list.submitClaim") }).click();
  const drawer = page.getByRole("dialog");
  await expect(page.getByRole("heading", { name: t("receivables.claim.title") })).toBeVisible();
  await drawer.getByRole("button", { name: t("receivables.claim.submit") }).click();
  await expect(page.getByRole("heading", { name: t("receivables.claim.title") })).toBeHidden();
});

test("S4: apply-payment journey → drawer → 200 → renders updated balance/state", async ({
  page,
  t,
}) => {
  await mockBase(page, withTenant);
  // Single route over the whole receivables namespace; branch by method/path so
  // the apply-payment POST and the list GET can't shadow each other (glob overlap).
  await page.route("**/api/v1/settlement/receivables**", (r) => {
    const req = r.request();
    if (req.method() === "POST" && req.url().includes("/apply-payment")) {
      return r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          receivableRef: "r1",
          outstandingBalance: "70.00",
          state: "partially_applied",
          version: 1,
        }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [receivable()], nextCursor: null }),
    });
  });

  await page.goto("/receivables");
  await page.getByRole("button", { name: t("receivables.list.applyPayment") }).click();
  const drawer = page.getByRole("dialog");
  await expect(page.getByRole("heading", { name: t("settlement.apply.title") })).toBeVisible();
  // The typed amount stays a raw decimal string (inputs are never formatted).
  await drawer.getByLabel(t("settlement.apply.amount"), { exact: true }).fill("50.00");
  await drawer.getByRole("button", { name: t("settlement.apply.submit") }).click();
  // Drawer shows the updated receivable (new outstanding + state label).
  await expect(drawer.getByText(formatMoney("70.00"))).toBeVisible();
  await expect(
    drawer.getByText(t("receivables.state.partially_applied"), { exact: true }),
  ).toBeVisible();
});

test("S3: no active tenant → RF-1 ScopeGate; list wrapper never called", async ({ page, t }) => {
  let listed = false;
  await mockBase(page, {
    user,
    active_tenant: null,
    active_store: null,
    active_role_code: null,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
  });
  await page.route("**/api/v1/settlement/receivables**", (r) => {
    listed = true;
    return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/receivables");
  await expect(page.getByRole("heading", { name: t("shell.gate.title") })).toBeVisible();
  expect(listed).toBe(false);
});
