import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-766 catalog product detail E2E against mocked Backend-Core (C-5), CAT-C1b.
 * D1: the list row opens the detail; tenant values, identifiers and store
 *     overrides render, and loading the page only GETs the product (no write,
 *     no POS or ERP call, no field or form; RT-768 gives an owner an Edit link and
 *     the Retire starter, which writes nothing until it is confirmed).
 * D2: a store in scope: raw deviations beside the tenant value, store names,
 *     the inventory link and the stores' own on-hand route.
 * D3: a product with no price says the POS will not sell it.
 * D4: a 404 is the one non-disclosing state; store_staff reads nothing.
 * D5: a 500 is a banner with the request id; a 429 is gated and recoverable.
 * D6: keyboard walk with a real outline in normal and forced-colors modes.
 * RT-399: runs in both locales; copy comes from the catalog (`t`). axe (WCAG
 * 2.1 A/AA) runs on the loaded page, the empty sections and the error states.
 */
const CAIRO = "0190f000-0000-7000-8000-0000000007a1";
const NEW_YORK = "0190f000-0000-7000-8000-0000000007a2";
const P1 = "0190f000-0000-7000-8000-0000000007b1";
const CATEGORY = "0190f000-0000-7000-8000-0000000007c1";

function ctx(role: string, store: { id: string; name: string } | null = null) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: store,
    active_role_code: role,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
  };
}

function summary(over: Record<string, unknown> = {}) {
  return {
    productId: P1,
    name: "Mineral water 1.5L",
    status: "active",
    categoryId: CATEGORY,
    categoryName: "Beverages",
    primarySku: "SKU-0042",
    primaryBarcode: "0012345678905",
    defaultPrice: { amount: "10.5000", currencyCode: "EGP" },
    taxCategory: "standard",
    trackingMode: "none",
    updatedAt: "2026-10-07T10:30:00Z",
    ...over,
  };
}

function detail(over: Record<string, unknown> = {}, sum: Record<string, unknown> = {}) {
  return {
    summary: summary(sum),
    description: "Still spring water, 1.5 litre bottle.",
    expiryRequired: false,
    sourceGlobalProductId: null,
    createdAt: "2026-09-01T08:00:00Z",
    identifiers: [
      {
        identifierType: "barcode",
        value: "0012345678905",
        storeId: null,
        sourceSystem: null,
        createdAt: "2026-10-01T08:00:00Z",
      },
      {
        identifierType: "sku",
        value: "SKU-0042",
        storeId: CAIRO,
        sourceSystem: null,
        createdAt: "2026-10-01T08:00:00Z",
      },
    ],
    storeOverrides: [
      {
        storeId: CAIRO,
        price: { amount: "12.0000", currencyCode: "EGP" },
        isActive: false,
        taxCategory: null,
        updatedAt: "2026-10-05T09:00:00Z",
      },
      {
        storeId: NEW_YORK,
        price: null,
        isActive: null,
        taxCategory: "reduced",
        updatedAt: "2026-10-06T09:00:00Z",
      },
    ],
    ...over,
  };
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return { status, contentType: "application/json", headers, body: JSON.stringify(body) };
}

const STORES = [
  { id: CAIRO, code: "CAI", name: "Cairo Festival" },
  { id: NEW_YORK, code: "NYC", name: "New York Flagship" },
];

async function mockBase(
  page: Page,
  role: string,
  store: { id: string; name: string } | null = null,
) {
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role, store))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json(STORES)));
  await page.route("**/api/v1/catalog/categories", (r) => r.fulfill(json({ items: [] })));
}

/** Answers the product read; every read of it is recorded. */
async function mockDetail(p: Page, body: unknown, status = 200, headers = {}): Promise<string[]> {
  const reads: string[] = [];
  await p.route(`**/api/v1/catalog/products/${P1}`, (r) => {
    reads.push(`${r.request().method()} ${new URL(r.request().url()).pathname}`);
    return r.fulfill(json(body, status, headers));
  });
  return reads;
}

test("D1: the list row opens the detail; read-only, only the product is read", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  await p.route("**/api/v1/catalog/products?**", (r) =>
    r.fulfill(json({ items: [summary()], nextCursor: null })),
  );
  const reads = await mockDetail(p, detail());
  const requested: { method: string; pathname: string }[] = [];
  p.on("request", (r) => {
    const { pathname } = new URL(r.url());
    if (pathname.startsWith("/api/")) requested.push({ method: r.method(), pathname });
  });

  await p.goto("/catalog/products");
  await p.getByRole("row", { name: /Mineral water 1\.5L/ }).click();
  await expect(p).toHaveURL(new RegExp(`/catalog/products/${P1}$`));
  await expect(p.getByRole("heading", { level: 1, name: "Mineral water 1.5L" })).toBeVisible();
  await expect(p.getByRole("link", { name: t("catalog.nav.label"), exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  const tenant = p.getByRole("region", { name: t("catalog.detail.tenant.title") });
  await expect(tenant.getByText("Still spring water, 1.5 litre bottle.")).toBeVisible();
  await expect(tenant.getByText("Beverages")).toBeVisible();
  await expect(tenant.getByText("10.50 EGP")).toBeVisible();
  const identifiers = p.getByRole("region", { name: t("catalog.detail.identifiers.title") });
  await expect(identifiers.getByText("0012345678905")).toBeVisible();
  await expect(p.getByRole("region", { name: t("catalog.detail.overrides.title") })).toBeVisible();

  // No field and no form. For an owner (RT-768) the one button is the Retire starter, which
  // opens a confirmation and writes nothing until it is confirmed.
  await expect(p.getByRole("main").getByRole("textbox")).toHaveCount(0);
  await expect(p.getByRole("main").getByRole("button")).toHaveText([t("catalog.retire.start")]);
  await expect(p.locator("main form, main input, main textarea, main select")).toHaveCount(0);

  expect(reads).toEqual([`GET /api/v1/catalog/products/${P1}`]);
  expect(requested.filter((r) => r.method !== "GET")).toEqual([]);
  expect(requested.filter((r) => /\/api\/pos\/|frappe|erpnext(?!-)/i.test(r.pathname))).toEqual([]);

  await expectNoAxeViolations(p, "catalog detail");
});

test("D2: a store in scope: raw deviations beside the tenant value, store names, the stock link", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "store_manager", { id: CAIRO, name: "Cairo Festival" });
  await mockDetail(p, detail());
  await p.goto(`/catalog/products/${P1}`);

  const overrides = p.getByRole("region", { name: t("catalog.detail.overrides.title") });
  const cairo = overrides.getByRole("table", {
    name: t("catalog.detail.overrides.caption", { store: "Cairo Festival" }),
  });
  await expect(cairo.getByRole("row")).toHaveCount(3);
  await expect(cairo.getByRole("columnheader")).toHaveText([
    t("catalog.detail.overrides.col.setting"),
    t("catalog.detail.overrides.col.store"),
    t("catalog.detail.overrides.col.tenant"),
  ]);
  const availability = cairo.getByRole("row", {
    name: new RegExp(t("catalog.detail.field.availability")),
  });
  await expect(availability.getByRole("cell").nth(1)).toHaveText(t("catalog.availability.no"));
  await expect(availability.getByRole("cell").nth(2)).toHaveText(t("catalog.availability.yes"));
  const price = cairo.getByRole("row", { name: new RegExp(t("catalog.detail.field.price")) });
  await expect(price.getByRole("cell").nth(1)).toHaveText("12.00 EGP");
  await expect(price.getByRole("cell").nth(2)).toHaveText("10.50 EGP");

  // The second store carries only its tax deviation, named from the store list.
  const newYork = overrides.getByRole("table", {
    name: t("catalog.detail.overrides.caption", { store: "New York Flagship" }),
  });
  await expect(newYork.getByRole("row")).toHaveCount(2);
  await expect(newYork.getByText("reduced")).toBeVisible();

  await expect(p.getByText(/effective/i)).toHaveCount(0);
  const stock = p.getByRole("link", {
    name: t("catalog.detail.inventoryLink", { store: "Cairo Festival" }),
  });
  await expect(stock).toHaveAttribute("href", `/inventory/stores/${CAIRO}/products/${P1}`);
  await expectNoAxeViolations(p, "catalog detail with overrides");
});

test("D3: no price says the POS will not sell the item; empty sections say so", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "tenant_admin");
  await mockDetail(p, detail({ identifiers: [], storeOverrides: [] }, { defaultPrice: null }));
  await p.goto(`/catalog/products/${P1}`);
  await expect(p.getByText(t("catalog.detail.noPriceNotice"))).toBeVisible();
  await expect(p.getByText(t("catalog.detail.identifiers.empty"))).toBeVisible();
  await expect(p.getByText(t("catalog.detail.overrides.empty"))).toBeVisible();
  await expect(p.getByRole("link", { name: /on-hand|الرصيد الفعلي/ })).toHaveCount(0);
  await expectNoAxeViolations(p, "catalog detail, no price");
});

test("D4: a 404 is the one non-disclosing state; store_staff reads nothing", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  await mockDetail(
    p,
    { error: { code: "not_found", message: "Not found", request_id: "r-404" } },
    404,
  );
  await p.goto(`/catalog/products/${P1}`);
  await expect(p.getByText(t("catalog.detail.unavailable"))).toBeVisible();
  await expect(p.getByText("r-404")).toHaveCount(0);
  await expect(p.getByRole("link", { name: t("catalog.detail.back") })).toBeVisible();
  await expectNoAxeViolations(p, "catalog detail not available");
});

test("D4b: store_staff and a non-UUID id read nothing and say the same thing", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "store_staff");
  const reads = await mockDetail(p, detail());
  await p.goto(`/catalog/products/${P1}`);
  await expect(p.getByText(t("catalog.detail.unavailable"))).toBeVisible();
  await p.goto("/catalog/products/new");
  await expect(p.getByText(t("catalog.detail.unavailable"))).toBeVisible();
  expect(reads).toEqual([]);
});

test("D5: a 500 is a banner with the request id and a Retry that recovers", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  let calls = 0;
  await p.route(`**/api/v1/catalog/products/${P1}`, (r) => {
    calls += 1;
    return calls === 1
      ? r.fulfill(json({ error: { code: "x", message: "y", request_id: "r-500" } }, 500))
      : r.fulfill(json(detail()));
  });
  await p.goto(`/catalog/products/${P1}`);
  await expect(p.getByText(t("catalog.detail.loadFailed"))).toBeVisible();
  await expect(p.getByText("r-500")).toBeVisible();
  await expectNoAxeViolations(p, "catalog detail error");
  await p.getByRole("button", { name: t("catalog.detail.retry") }).click();
  await expect(p.getByRole("heading", { level: 1, name: "Mineral water 1.5L" })).toBeVisible();
});

test("D5b: a 429 is its own message; Retry is gated until Retry-After passes", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  let calls = 0;
  await p.route(`**/api/v1/catalog/products/${P1}`, (r) => {
    calls += 1;
    return calls === 1
      ? r.fulfill(
          json({ error: { code: "rate_limited", message: "slow", request_id: "r-429" } }, 429, {
            "Retry-After": "2",
          }),
        )
      : r.fulfill(json(detail()));
  });
  await p.goto(`/catalog/products/${P1}`);
  await expect(p.getByText(t("catalog.detail.rateLimited"))).toBeVisible();
  const retry = p.getByRole("button", { name: new RegExp(t("catalog.detail.retry")) });
  await expect(retry).toBeDisabled();
  await expectNoAxeViolations(p, "catalog detail rate limited");
  await expect(retry).toBeEnabled({ timeout: 8000 });
  await retry.click();
  await expect(p.getByRole("heading", { level: 1, name: "Mineral water 1.5L" })).toBeVisible();
});

for (const forced of [false, true]) {
  test(`D6: keyboard walk reaches the page's links with a real outline (forced-colors ${forced})`, async ({
    page: p,
    t,
  }) => {
    await mockBase(p, "owner", { id: CAIRO, name: "Cairo Festival" });
    await mockDetail(p, detail());
    if (forced) await p.emulateMedia({ forcedColors: "active" });
    await p.goto(`/catalog/products/${P1}`);
    await expect(p.getByRole("heading", { level: 1, name: "Mineral water 1.5L" })).toBeVisible();

    await p.getByRole("link", { name: t("catalog.detail.back") }).focus();
    const stops: { label: string; outlineStyle: string; outlineWidth: number }[] = [];
    for (let i = 0; i < 2; i++) {
      stops.push(
        await p.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const style = getComputedStyle(el);
          return {
            label: el.textContent?.trim() || el.tagName,
            outlineStyle: style.outlineStyle,
            outlineWidth: Number.parseFloat(style.outlineWidth),
          };
        }),
      );
      await p.keyboard.press("Tab");
    }
    for (const stop of stops) {
      expect(stop.outlineStyle, stop.label).not.toBe("none");
      expect(stop.outlineWidth, stop.label).toBeGreaterThan(0);
    }
    expect(stops[0].label).toContain(t("catalog.detail.back"));
    expect(stops[1].label).toContain("Cairo Festival");

    // Enter on the back link returns to the list, by keyboard alone.
    await p.getByRole("link", { name: t("catalog.detail.back") }).focus();
    await p.keyboard.press("Enter");
    await expect(p).toHaveURL(/\/catalog\/products$/);
  });
}
