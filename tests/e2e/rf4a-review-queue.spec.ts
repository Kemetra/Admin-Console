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
  // a pending item offers Dismiss; no link / create-product affordance (RF-4b out):
  // the drawer's only buttons are Close and Dismiss (locale-independent check).
  await expect(
    drawer.getByRole("button", { name: t("unknownItems.dismiss.action") }),
  ).toBeVisible();
  await expect(drawer.getByRole("button")).toHaveCount(2);
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
