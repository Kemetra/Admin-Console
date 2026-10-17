import { type Page, expect, test } from "./fixtures";

/**
 * 017 payer-accounts E2E (VG-2). Active tenant → payer table; create drawer →
 * 201 → close + list refetch shows the new payer. No active tenant → scope
 * prompt (list wrapper never reached). Mocked DP2 (C-5).
 *
 * RT-421: owner / tenant_admin only (nav entry + page gate); keyset paging with an
 * empty page and a non-null cursor; the create body is the 2.0.0 contract (an
 * Idempotency-Key, storeId null = tenant-wide, no creditTerms); a 404 on an
 * out-of-scope store is non-disclosing. The create → list journey against a REAL
 * Backend-Core is a separate check (not covered by mocked E2E).
 *
 * RT-399: runs in both locales; every copy selector comes from the catalog via
 * `t()`. Mocked data (names, IDs) stays as authored.
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

function payer(over: Record<string, unknown> = {}) {
  return {
    payerRef: "p1",
    category: "insurer",
    displayName: "MedCover Insurance",
    externalRef: "INS-99",
    status: "active",
    storeId: null,
    version: 0,
    ...over,
  };
}

test("S1: active tenant → payer table renders", async ({ page, t }) => {
  await mockBase(page, withTenant);
  await page.route("**/api/v1/settlement/payer-accounts**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [payer()], nextCursor: null }),
    }),
  );

  await page.goto("/payer-accounts");
  await expect(
    page.getByRole("heading", { name: t("payers.list.title"), exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: /MedCover Insurance/ })).toBeVisible();
  // The raw category / status codes render as catalog labels.
  await expect(
    page.getByRole("cell", { name: t("payers.category.insurer"), exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: t("payers.status.active"), exact: true }),
  ).toBeVisible();
});

test("S2: create drawer → 201 → drawer closes and the new payer appears", async ({ page, t }) => {
  await mockBase(page, withTenant);
  let created = false;
  let idempotencyKey: string | undefined;
  let postedBody: Record<string, unknown> = {};
  await page.route("**/api/v1/settlement/payer-accounts**", (r) => {
    if (r.request().method() === "POST") {
      created = true;
      idempotencyKey = r.request().headers()["idempotency-key"];
      postedBody = r.request().postDataJSON();
      return r.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(
          payer({ payerRef: "p2", displayName: "Acme Corp", category: "corporate" }),
        ),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: created
          ? [payer({ payerRef: "p2", displayName: "Acme Corp", category: "corporate" })]
          : [],
        nextCursor: null,
      }),
    });
  });

  await page.goto("/payer-accounts");
  // Empty-state Create primary opens the drawer (the page's own button, before
  // the drawer mounts a second "Create payer" submit).
  await page.getByRole("button", { name: t("payers.list.create") }).click();
  const drawer = page.getByRole("dialog");
  await expect(page.getByRole("heading", { name: t("payers.create.title") })).toBeVisible();
  await page.getByLabel(t("payers.create.displayName")).fill("Acme Corp");
  // The option VALUE stays the raw API code; only its label is localized.
  await page.getByLabel(t("payers.create.category")).selectOption("corporate");
  // Submit from WITHIN the drawer (disambiguate from the list's Create button).
  await drawer.getByRole("button", { name: t("payers.create.submit") }).click();

  // Drawer closes (heading gone) and the refetched list shows the new payer.
  await expect(page.getByRole("heading", { name: t("payers.create.title") })).toBeHidden();
  await expect(page.getByRole("cell", { name: /Acme Corp/ })).toBeVisible();

  // The wire contract: an Idempotency-Key, tenant-wide by default, no creditTerms.
  expect(idempotencyKey).toMatch(/^[\x21-\x7E]{16,128}$/);
  expect(postedBody).toEqual({
    category: "corporate",
    displayName: "Acme Corp",
    externalRef: null,
    storeId: null,
  });
});

const store = (id: string, name: string) => ({
  id,
  name,
  code: name.slice(0, 3).toUpperCase(),
  status: "active",
  timezone: "Africa/Cairo",
});

test("S4: tenant_admin reaches Payer accounts from the nav; a store-scoped payer shows its store", async ({
  page,
  t,
}) => {
  await mockBase(page, withTenant);
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([store("s1", "Cairo Festival City")]),
    }),
  );
  await page.route("**/api/v1/settlement/payer-accounts**", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          payer(),
          payer({ payerRef: "p2", displayName: "Acme Corp", storeId: "s1", externalRef: null }),
        ],
        nextCursor: null,
      }),
    }),
  );

  await page.goto("/");
  await page
    .getByRole("navigation")
    .getByRole("link", { name: t("payers.nav.label") })
    .click();
  await expect(page).toHaveURL(/\/payer-accounts$/);
  const rows = page.getByRole("row");
  await expect(rows.filter({ hasText: "MedCover Insurance" })).toContainText(
    t("payers.scope.tenant"),
  );
  await expect(rows.filter({ hasText: "Acme Corp" })).toContainText("Cairo Festival City");
  await expect(rows.filter({ hasText: "Acme Corp" })).toContainText(
    t("payers.list.erpCustomerUnlinked"),
  );
});

test("S5: a store manager has no Payer accounts entry and the URL shows no payer data", async ({
  page,
  t,
}) => {
  let listed = false;
  await mockBase(page, { ...withTenant, active_role_code: "store_manager" });
  await page.route("**/api/v1/settlement/payer-accounts**", (r) => {
    listed = true;
    return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/");
  await expect(
    page.getByRole("navigation").getByRole("link", { name: t("payers.nav.label") }),
  ).toHaveCount(0);
  await page.goto("/payer-accounts");
  await expect(page.getByRole("heading", { name: t("auth.noAccess.title") })).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(listed).toBe(false);
});

test("S6: an empty page with a non-null cursor is not the end: Load more walks on", async ({
  page,
  t,
}) => {
  await mockBase(page, withTenant);
  const cursors: (string | null)[] = [];
  await page.route("**/api/v1/settlement/payer-accounts**", (r) => {
    const cursor = new URL(r.request().url()).searchParams.get("cursor");
    cursors.push(cursor);
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        cursor === "CUR1"
          ? { items: [payer()], nextCursor: null }
          : { items: [], nextCursor: "CUR1" },
      ),
    });
  });

  await page.goto("/payer-accounts");
  await expect(page.getByText(t("payers.list.emptyPage"))).toBeVisible();
  await expect(page.getByText(t("payers.list.empty"), { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: t("payers.list.loadMore") }).click();
  await expect(page.getByRole("cell", { name: /MedCover Insurance/ })).toBeVisible();
  await expect(page.getByRole("button", { name: t("payers.list.loadMore") })).toHaveCount(0);
  expect(cursors).toEqual([null, "CUR1"]);
});

test("S7: a store-scoped create sends storeId; a 404 is a non-disclosing message", async ({
  page,
  t,
}) => {
  await mockBase(page, withTenant);
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([store("6f1c2f6e-1c1d-4a5e-9d8e-0a1b2c3d4e5f", "Cairo Festival City")]),
    }),
  );
  let postedBody: Record<string, unknown> = {};
  await page.route("**/api/v1/settlement/payer-accounts**", (r) => {
    if (r.request().method() === "POST") {
      postedBody = r.request().postDataJSON();
      return r.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "not_found", message: "store belongs to tenant t2", request_id: "r-1" },
        }),
      });
    }
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [payer()], nextCursor: null }),
    });
  });

  await page.goto("/payer-accounts");
  await page.getByRole("button", { name: t("payers.list.create") }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel(t("payers.create.displayName")).fill("Acme Corp");
  await drawer.getByLabel(t("payers.create.scope")).selectOption({ label: "Cairo Festival City" });
  await drawer.getByLabel(t("payers.create.externalRef")).fill("CUST-0042");
  await drawer.getByRole("button", { name: t("payers.create.submit") }).click();

  await expect(drawer.getByText(t("payers.create.errors.storeUnavailable"))).toBeVisible();
  await expect(page.getByText(/belongs to tenant/)).toHaveCount(0);
  expect(postedBody).toEqual({
    category: "credit_customer",
    displayName: "Acme Corp",
    externalRef: "CUST-0042",
    storeId: "6f1c2f6e-1c1d-4a5e-9d8e-0a1b2c3d4e5f",
  });
});

test("S3: no active tenant → RF-1 scope gate; list wrapper never called", async ({ page, t }) => {
  // ProtectedArea intercepts no-active-tenant app-wide → the RF-1 scope gate
  // renders BEFORE the /payer-accounts route mounts, so the payer list wrapper
  // is never reached. (PayerList's own scope prompt is component-level
  // defense-in-depth, not the app path here.)
  let listed = false;
  // Has a membership but no ACTIVE tenant selected → ScopeGate (membershipCount>0;
  // membershipCount===0 would route to NoAccess instead).
  await mockBase(page, {
    user,
    active_tenant: null,
    active_store: null,
    active_role_code: null,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
  });
  await page.route("**/api/v1/settlement/payer-accounts**", (r) => {
    listed = true;
    return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.goto("/payer-accounts");
  await expect(page.getByRole("heading", { name: t("shell.gate.title") })).toBeVisible();
  expect(listed).toBe(false);
});
