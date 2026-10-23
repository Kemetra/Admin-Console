import type { MessageKey, Params } from "../../src/i18n/translate";
import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";
import { mockContext, mockQueue, pendingItem } from "./unknown-items-mocks";

/**
 * RT-767 shared product picker (CAT-C1c) against mocked Backend-Core, in both
 * locales (copy from the catalog via `t`; mocked data stays as authored).
 * P1: unknown item → Link to a product: picker, keyboard walk, confirm, link
 *     sent once with the chosen product; axe clean with the picker open, at the
 *     confirm, and in dark.
 * P2: every refusal the link can meet is a persistent message; alias_conflict
 *     names no product; target_unavailable keeps the picker open. axe clean.
 * P3: the picker's own failures (500 with request id, 429) are states; axe clean.
 * P4: ERP mappings → Suggest a mapping from the picker, keyboard walk, confirm;
 *     the suggestion carries the picked product id; axe clean.
 * Every request stays on Backend-Core `/api/v1/`; the picker asks for active
 * products only, with no store, and renders no price.
 */
const WATER = "0190f000-0000-7000-8000-0000000007b1";
const COLA = "0190f000-0000-7000-8000-0000000007b2";
const T0 = "2026-10-18T09:00:00Z";

function product(productId: string, name: string, sku: string) {
  return {
    productId,
    name,
    status: "active",
    categoryId: null,
    categoryName: null,
    primarySku: sku,
    primaryBarcode: "0012345678905",
    defaultPrice: { amount: "10.5000", currencyCode: "EGP" },
    taxCategory: "standard",
    trackingMode: "none",
    updatedAt: T0,
  };
}

const PRODUCTS = [
  product(WATER, "Mineral water 1.5L", "SKU-0042"),
  product(COLA, "Cola 330ml", "SKU-0043"),
];

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return { status, contentType: "application/json", body: JSON.stringify(body), headers };
}

const errorBody = (code: string, requestId: string) => ({
  error: { code, message: "backend english", request_id: requestId },
});

/** Mocks the catalog read and records every query the picker sends. */
async function mockProducts(page: Page): Promise<URLSearchParams[]> {
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/catalog/products?**", (r) => {
    queries.push(new URL(r.request().url()).searchParams);
    return r.fulfill(json({ items: PRODUCTS, nextCursor: null }));
  });
  return queries;
}

/** Unknown-items surface: a pending barcode item and its inspect read. */
async function mockUnknownItems(page: Page): Promise<void> {
  const item = pendingItem();
  await mockContext(page);
  await mockQueue(page, [item]);
  await page.route("**/api/v1/catalog/unknown-items/u1", (r) => r.fulfill(json(item)));
}

type TFn = (key: MessageKey, params?: Params) => string;

async function openLinkStep(page: Page, t: TFn): Promise<void> {
  await page.goto("/unknown-items");
  await page
    .getByRole("button", { name: t("table.selection.openRow", { value: "5012345678900" }) })
    .click();
  const drawer = page.getByRole("dialog", { name: t("unknownItems.drawer.title") });
  await drawer.getByRole("button", { name: t("unknownItems.link.action") }).click();
}

/**
 * Keyboard only: ArrowDown from the search box enters the list; Down, then Enter, chooses.
 * The list renders only once the products have loaded, and ArrowDown before that stays
 * in the search box by design, so wait for the options first.
 */
async function chooseByKeyboard(page: Page, t: TFn, downs: number): Promise<void> {
  const list = page.getByRole("listbox", { name: t("catalog.picker.list") });
  await expect(list.getByRole("option").first()).toBeVisible();
  await page.getByLabel(t("catalog.picker.search")).focus();
  await page.keyboard.press("ArrowDown");
  await expect(list).toBeFocused();
  for (let i = 0; i < downs; i++) await page.keyboard.press("ArrowDown");
  await expect(list).toHaveAttribute("aria-activedescendant", /.+/);
  await page.keyboard.press("Enter");
}

test("P1: link an unknown item to a picked product; keyboard walk, axe, light and dark", async ({
  page,
  t,
}) => {
  await mockUnknownItems(page);
  const queries = await mockProducts(page);
  const sent: unknown[] = [];
  const requested: string[] = [];
  page.on("request", (r) => {
    if (["fetch", "xhr"].includes(r.resourceType())) requested.push(new URL(r.url()).pathname);
  });
  await page.route("**/api/v1/catalog/unknown-items/u1/link", (r) => {
    sent.push(r.request().postDataJSON());
    return r.fulfill(
      json({ ...pendingItem(), resolution_status: "resolved", resolution_action: "linked" }),
    );
  });

  await openLinkStep(page, t);
  const drawer = page.getByRole("dialog", { name: t("unknownItems.drawer.title") });
  const list = drawer.getByRole("listbox", { name: t("catalog.picker.list") });
  await expect(list.getByRole("option")).toHaveCount(2);
  await expect(drawer).not.toContainText(/10\.5|EGP|ج\.م/);
  await expectNoAxeViolations(page, "link step with the picker open");

  await chooseByKeyboard(page, t, 2);
  const confirm = drawer.getByRole("group", { name: t("unknownItems.link.confirm.label") });
  await expect(confirm).toContainText("Cola 330ml");
  await expect(confirm).toContainText("5012345678900");
  expect(sent).toEqual([]);
  await expectNoAxeViolations(page, "link confirm");

  // The drawer covers the toggle, so the theme is set the way the toggle does (<html data-theme>).
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await expectNoAxeViolations(page, "link confirm, dark");
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));

  await confirm.getByRole("button", { name: t("unknownItems.link.confirm.action") }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByText(t("unknownItems.link.success"))).toBeVisible();
  expect(sent).toEqual([{ product_id: COLA }]);
  expect(queries).toHaveLength(1);
  expect(queries[0].get("status")).toBe("active");
  expect(queries[0].has("store_id")).toBe(false);
  expect(requested.filter((p) => !p.startsWith("/api/v1/"))).toEqual([]);
});

test("P2: a link refusal is a persistent message; alias_conflict names no product; target_unavailable keeps the picker", async ({
  page,
  t,
}) => {
  await mockUnknownItems(page);
  await mockProducts(page);
  let answer = json(errorBody("alias_conflict", "req-alias"), 409);
  await page.route("**/api/v1/catalog/unknown-items/u1/link", (r) => r.fulfill(answer));

  await openLinkStep(page, t);
  const drawer = page.getByRole("dialog", { name: t("unknownItems.drawer.title") });
  await chooseByKeyboard(page, t, 1);
  await drawer.getByRole("button", { name: t("unknownItems.link.confirm.action") }).click();

  const alert = drawer.getByRole("alert");
  await expect(alert).toContainText(t("unknownItems.errors.linkAliasConflict"));
  await expect(alert).toContainText("req-alias");
  await expect(alert).not.toContainText("Mineral water");
  await expectNoAxeViolations(page, "link alias_conflict");

  answer = json(errorBody("target_unavailable", "req-gone"), 409);
  await drawer.getByRole("button", { name: t("unknownItems.link.confirm.action") }).click();
  await expect(alert).toContainText(t("unknownItems.errors.targetUnavailable"));
  await expect(drawer.getByRole("listbox", { name: t("catalog.picker.list") })).toBeVisible();
  await expect(drawer.getByRole("option", { selected: true })).toHaveCount(0);
  await expectNoAxeViolations(page, "link target_unavailable, picker open again");
});

test("P3: the picker's own failures are states: 500 with a request id, then 429; axe is clean", async ({
  page,
  t,
}) => {
  await mockUnknownItems(page);
  let answer = json(errorBody("internal", "req-picker"), 500);
  await page.route("**/api/v1/catalog/products?**", (r) => r.fulfill(answer));

  await openLinkStep(page, t);
  const drawer = page.getByRole("dialog", { name: t("unknownItems.drawer.title") });
  await expect(drawer.getByText(t("catalog.picker.error.generic"))).toBeVisible();
  await expect(drawer).toContainText("req-picker");
  await expectNoAxeViolations(page, "picker 500");

  answer = json(errorBody("rate_limited", "req-429"), 429, { "Retry-After": "30" });
  await drawer.getByRole("button", { name: t("catalog.picker.retry") }).click();
  await expect(drawer.getByText(t("catalog.picker.error.rateLimited"))).toBeVisible();
  await expectNoAxeViolations(page, "picker 429");
});

function erpContext() {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: "owner",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "owner" }],
  };
}

test("P4: suggest an ERPNext mapping for a picked product; keyboard walk, conflict, axe", async ({
  page,
  t,
}) => {
  const requested: string[] = [];
  page.on("request", (r) => {
    if (["fetch", "xhr"].includes(r.resourceType())) requested.push(new URL(r.url()).pathname);
  });
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(erpContext())));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json([])));
  await page.route("**/api/v1/catalog/erpnext-warehouse-mappings**", (r) =>
    r.fulfill(json({ items: [] })),
  );
  const sent: unknown[] = [];
  let post = json(errorBody("conflict", "req-dup"), 409);
  await page.route("**/api/v1/catalog/erpnext-item-mappings**", (r) => {
    if (r.request().method() === "GET") return r.fulfill(json({ items: [] }));
    sent.push(r.request().postDataJSON());
    return r.fulfill(post);
  });
  const queries = await mockProducts(page);

  await page.goto("/erp-connection/mappings");
  const items = page.getByRole("region", { name: t("erp.map.items.title") });
  await items.getByRole("button", { name: t("erp.map.items.suggestNew.action") }).click();
  await expect(items.getByRole("listbox", { name: t("catalog.picker.list") })).toBeVisible();
  await expectNoAxeViolations(page, "erp suggest with the picker open");

  await chooseByKeyboard(page, t, 0);
  const form = items.getByRole("form", { name: t("erp.map.items.suggestNew.label") });
  await expect(form).toContainText("Mineral water 1.5L");
  await expect(form).toContainText(WATER);
  await form.getByLabel(t("erp.map.items.suggest.ref")).fill("ITEM-WATER-15");
  await form.getByRole("button", { name: t("erp.map.review") }).click();
  const confirm = items.getByRole("region", { name: t("erp.map.items.suggestNew.label") });
  expect(sent).toEqual([]);
  await confirm.getByRole("button", { name: t("erp.map.items.suggest.action") }).click();
  await expect(confirm.getByRole("alert")).toContainText("req-dup");
  await expectNoAxeViolations(page, "erp suggest conflict");

  post = json(
    {
      id: "i3",
      tenant_product_id: WATER,
      erpnext_item_ref: "ITEM-WATER-15",
      state: "suggested",
      suggestion_source: "manual",
      version: 1,
      suggested_by: null,
      suggested_at: T0,
      confirmed_by: null,
      confirmed_at: null,
      retired_at: null,
      created_at: T0,
      updated_at: T0,
    },
    201,
  );
  await confirm.getByRole("button", { name: t("erp.map.items.suggest.action") }).click();
  await expect(items.getByText(t("erp.map.items.notice.suggested"))).toBeVisible();
  expect(sent).toEqual([
    { tenant_product_id: WATER, erpnext_item_ref: "ITEM-WATER-15" },
    { tenant_product_id: WATER, erpnext_item_ref: "ITEM-WATER-15" },
  ]);
  expect(queries.every((q) => q.get("status") === "active" && !q.has("store_id"))).toBe(true);
  expect(requested.filter((p) => !p.startsWith("/api/v1/"))).toEqual([]);
});
