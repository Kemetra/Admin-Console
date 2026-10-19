import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RF-4a unknown-items review-queue E2E (VG-2). Scoped queue → rows; inspect
 * drawer renders the ReviewQueueItem detail read-only; dismiss behind a confirm
 * resolves the item; 403 forbidden → not-permitted banner with request_id.
 * Mocked DP2 (no live backend).
 * RT-399: runs in both locales; copy is selected through the catalog (`t`),
 * mocked data (identifier values, request ids) stays as authored.
 */

const ctx = {
  user: {
    id: "u1",
    email: "amal@northstar.eg",
    display_name: "Amal Saleh",
    is_platform_admin: true,
  },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "tenant_admin",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
};

const item = {
  id: "u1",
  tenant_id: "t1",
  store_id: "s1",
  identifier_type: "barcode",
  identifier_value: "5012345678900",
  source_system: null,
  resolution_status: "pending",
  resolution_action: null,
  resolved_at: null,
  resolved_by: null,
  encountered_at: "2026-06-10T10:00:00Z",
};

async function mockContext(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
}

test("S1: scoped queue renders the pending rows", async ({ page, t }) => {
  await mockContext(page);
  await page.route("**/api/v1/catalog/unknown-items?*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [item], next_cursor: null }),
    }),
  );

  await page.goto("/unknown-items");
  await expect(page.getByRole("heading", { name: t("unknownItems.title") })).toBeVisible();
  await expect(page.getByText("5012345678900")).toBeVisible();
  // The identifier type renders as its localized label, never the raw enum code.
  await expect(
    page.getByRole("cell", { name: t("unknownItems.identifierType.barcode"), exact: true }),
  ).toBeVisible();
});

test("S2: inspect drawer renders the ReviewQueueItem detail read-only", async ({ page, t }) => {
  await mockContext(page);
  await page.route("**/api/v1/catalog/unknown-items?*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [item], next_cursor: null }),
    }),
  );
  await page.route("**/api/v1/catalog/unknown-items/u1", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(item) }),
  );

  await page.goto("/unknown-items");
  await page.getByText("5012345678900").click();
  const drawer = page.getByRole("dialog", { name: t("unknownItems.drawer.title") });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("5012345678900")).toBeVisible();
  // a pending item offers Create product and Dismiss; no link affordance (RT-724
  // defers link): the drawer's only buttons are Close, Create product and Dismiss.
  await expect(
    drawer.getByRole("button", { name: t("unknownItems.dismiss.action") }),
  ).toBeVisible();
  await expect(drawer.getByRole("button", { name: t("unknownItems.create.action") })).toBeVisible();
  await expect(drawer.getByRole("button")).toHaveCount(3);
});

test("S3: dismiss behind a confirm resolves the item", async ({ page, t }) => {
  await mockContext(page);
  await page.route("**/api/v1/catalog/unknown-items?*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [item], next_cursor: null }),
    }),
  );
  await page.route("**/api/v1/catalog/unknown-items/u1", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(item) }),
  );
  await page.route("**/api/v1/catalog/unknown-items/u1/dismiss", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...item,
        resolution_status: "dismissed",
        resolution_action: "dismissed",
      }),
    }),
  );

  await page.goto("/unknown-items");
  await page.getByText("5012345678900").click();
  const drawer = page.getByRole("dialog", { name: t("unknownItems.drawer.title") });
  const dismiss = t("unknownItems.dismiss.action");
  await drawer.getByRole("button", { name: dismiss, exact: true }).click();
  // confirm step appears (the confirm affordance's own labelled region), then confirm
  await expect(
    drawer.getByRole("region", { name: t("components.confirmDelete.label", { action: dismiss }) }),
  ).toBeVisible();
  await drawer.getByRole("button", { name: dismiss, exact: true }).click();
  // drawer closes on success
  await expect(drawer).toHaveCount(0);
});

// --- RT-724 (RF-4b) happy paths ---------------------------------------------

async function mockQueue(page: Page, items: unknown[]): Promise<void> {
  await page.route("**/api/v1/catalog/unknown-items?*", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items, next_cursor: null }),
    }),
  );
}

test("S5: create a product from a pending item", async ({ page, t }) => {
  await mockContext(page);
  await mockQueue(page, [item]);
  await page.route("**/api/v1/catalog/unknown-items/u1", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(item) }),
  );
  let sent: unknown;
  await page.route("**/api/v1/catalog/unknown-items/u1/create-product", (r) => {
    sent = r.request().postDataJSON();
    return r.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        ...item,
        resolution_status: "resolved",
        resolution_action: "created",
      }),
    });
  });

  await page.goto("/unknown-items");
  await page.getByText("5012345678900").click();
  const drawer = page.getByRole("dialog", { name: t("unknownItems.drawer.title") });
  await drawer.getByRole("button", { name: t("unknownItems.create.action") }).click();
  await drawer.getByLabel(t("unknownItems.create.name")).fill("Sparkling water 1L");
  await drawer.getByLabel(t("unknownItems.create.taxCategory")).fill("VAT14");
  await expectNoAxeViolations(page, "create-product form");
  await drawer.getByRole("button", { name: t("unknownItems.create.submit") }).click();

  await expect(drawer).toHaveCount(0);
  await expect(page.getByText(t("unknownItems.create.success"))).toBeVisible();
  expect(sent).toEqual({ name: "Sparkling water 1L", tax_category: "VAT14" });
});

test("S6: reopen a dismissed item", async ({ page, t }) => {
  const dismissed = {
    ...item,
    id: "u3",
    identifier_value: "6221234567890",
    resolution_status: "dismissed",
    resolution_action: "dismissed",
  };
  await mockContext(page);
  await mockQueue(page, [dismissed]);
  await page.route("**/api/v1/catalog/unknown-items/u3", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(dismissed) }),
  );
  let key: string | null = null;
  await page.route("**/api/v1/catalog/unknown-items/u3/reopen", (r) => {
    key = r.request().headers()["idempotency-key"] ?? null;
    return r.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ...dismissed, id: "u4", resolution_status: "pending" }),
    });
  });

  await page.goto("/unknown-items");
  await page.getByLabel(t("unknownItems.filters.status")).selectOption("dismissed");
  await page.getByText("6221234567890").click();
  const drawer = page.getByRole("dialog", { name: t("unknownItems.drawer.title") });
  await drawer.getByRole("button", { name: t("unknownItems.reopen.action") }).click();

  await expect(drawer).toHaveCount(0);
  await expect(page.getByText(t("unknownItems.reopen.success"))).toBeVisible();
  expect(key).toMatch(/^[\x21-\x7E]{16,128}$/);
});

test("S7: bulk dismiss an explicit, counted selection", async ({ page, t }) => {
  const second = { ...item, id: "u2", identifier_value: "5012345678917" };
  await mockContext(page);
  await mockQueue(page, [item, second]);
  let sent: unknown;
  await page.route("**/api/v1/catalog/unknown-items/bulk-dismiss", (r) => {
    sent = r.request().postDataJSON();
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        outcomes: [
          { id: "u1", outcome: "dismissed" },
          { id: "u2", outcome: "dismissed" },
        ],
      }),
    });
  });

  await page.goto("/unknown-items");
  await page.getByLabel(t("unknownItems.select.page")).check();
  await expect(page.getByText(t("unknownItems.bulk.selected", { count: 2 }))).toBeVisible();
  await expectNoAxeViolations(page, "queue with a bulk selection");
  const action = t("unknownItems.bulk.action");
  await page.getByRole("button", { name: action, exact: true }).click();
  const confirm = page.getByRole("region", {
    name: t("components.confirmDelete.label", { action }),
  });
  await confirm.getByRole("button", { name: action, exact: true }).click();

  await expect(page.getByText(t("unknownItems.bulk.result.dismissed", { count: 2 }))).toBeVisible();
  expect(sent).toEqual({ ids: ["u1", "u2"] });
});

test("S4: 403 forbidden → not-permitted banner with request_id", async ({ page, t }) => {
  await mockContext(page);
  await page.route("**/api/v1/catalog/unknown-items?*", (r) =>
    r.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "forbidden", request_id: "req-403" } }),
    }),
  );

  await page.goto("/unknown-items");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText(t("unknownItems.errors.forbidden"))).toBeVisible();
  await expect(page.getByText(/req-403/)).toBeVisible();
});
