import type { Locator } from "@playwright/test";
import { expectNoAxeViolations } from "./axe";
import { type LocaleFixtures, type Page, expect, test } from "./fixtures";

/**
 * RT-768 product edit and retire E2E against mocked Backend-Core (C-5), CAT-C2a.
 * Product CREATE is held by owner decision D9 and is not exercised here.
 * E1: edit sends expectedUpdatedAt and only the changed field, lands on detail.
 * E2: a blocked submit sends nothing; the shared error summary is at the top and
 *     focused, links in field order focus the field, entries clear live; axe in
 *     light and dark.
 * E3: 409 stale_write: a conflict banner with Reload, typed values kept.
 * E4: Retire: confirmation (Cancel has focus), POST with expectedUpdatedAt,
 *     the item reads retired and read-only; axe in light and dark.
 * E5: store_manager reads only; so does a retired item.
 * E6: unsaved-work guard on Cancel.
 * E7: keyboard walk through the form with a real outline, normal and forced-colors.
 * RT-399: runs in both locales; copy comes from the catalog (`t`).
 */
const CAIRO = "0190f000-0000-7000-8000-0000000007a1";
const P1 = "0190f000-0000-7000-8000-0000000007b1";
const CATEGORY = "0190f000-0000-7000-8000-0000000007c1";
const CATEGORY_2 = "0190f000-0000-7000-8000-0000000007c2";
const LOADED_AT = "2026-10-07T10:30:00Z";
const LATER = "2026-10-08T09:00:00Z";

function ctx(role: string) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: role,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
  };
}

function detail(over: Record<string, unknown> = {}, sum: Record<string, unknown> = {}) {
  return {
    summary: {
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
      updatedAt: LOADED_AT,
      ...sum,
    },
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
    ],
    storeOverrides: [],
    ...over,
  };
}

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

const failure = (code: string, requestId = "r-w") => ({
  error: { code, message: "m", request_id: requestId },
});

async function mockBase(page: Page, role: string) {
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill(json([{ id: CAIRO, code: "CAI", name: "Cairo Festival" }])),
  );
  await page.route("**/api/v1/catalog/categories", (r) =>
    r.fulfill(
      json({
        items: [
          { categoryId: CATEGORY, name: "Beverages", description: null, updatedAt: LOADED_AT },
          { categoryId: CATEGORY_2, name: "Snacks", description: null, updatedAt: LOADED_AT },
        ],
      }),
    ),
  );
}

interface Recorded {
  patches: unknown[];
  retires: unknown[];
  gets: number;
}

/** GET / PATCH of the product and POST of its retire; every write is recorded. */
async function mockProduct(
  p: Page,
  answers: {
    get?: () => unknown;
    patch?: () => { status: number; body: unknown };
    retire?: () => { status: number; body: unknown };
  } = {},
): Promise<Recorded> {
  const recorded: Recorded = { patches: [], retires: [], gets: 0 };
  await p.route(`**/api/v1/catalog/products/${P1}`, (r) => {
    if (r.request().method() === "PATCH") {
      recorded.patches.push(r.request().postDataJSON());
      const out = answers.patch?.() ?? { status: 200, body: detail() };
      return r.fulfill(json(out.body, out.status));
    }
    recorded.gets += 1;
    return r.fulfill(json(answers.get?.() ?? detail()));
  });
  await p.route(`**/api/v1/catalog/products/${P1}/retire`, (r) => {
    recorded.retires.push(r.request().postDataJSON());
    const out = answers.retire?.() ?? {
      status: 200,
      body: detail({}, { status: "retired", updatedAt: LATER }),
    };
    return r.fulfill(json(out.body, out.status));
  });
  return recorded;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const field = (p: Page, label: string): Locator =>
  p.getByLabel(new RegExp(`^\\s*${escapeRegExp(label)}`));

/** Banners and errors settle in over 150ms (opacity): axe must not measure a half-faded colour. */
async function checkAxe(p: Page, label: string): Promise<void> {
  await p.waitForFunction(() => document.getAnimations().length === 0);
  await expectNoAxeViolations(p, label);
}

/** Switch the theme as the toggle does (<html data-theme>), then wait for the colour transitions
 * to finish: axe measures contrast, and a mid-transition colour is neither theme's. */
async function setTheme(p: Page, theme: "dark" | "light"): Promise<void> {
  await p.evaluate(
    (value) =>
      value === "dark"
        ? document.documentElement.setAttribute("data-theme", "dark")
        : document.documentElement.removeAttribute("data-theme"),
    theme,
  );
  await p.waitForFunction(() => document.getAnimations().length === 0);
}

async function openEdit(p: Page, t: LocaleFixtures["t"]): Promise<void> {
  await p.goto(`/catalog/products/${P1}/edit`);
  await expect(p.getByRole("heading", { level: 1 })).toContainText("Mineral water 1.5L");
  await expect(field(p, t("catalog.form.name"))).toHaveValue("Mineral water 1.5L");
}

test("E1: edit sends expectedUpdatedAt and only the changed field, then lands on the detail", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  let current = detail();
  const recorded = await mockProduct(p, {
    get: () => current,
    patch: () => {
      current = detail({}, { taxCategory: "zero", updatedAt: LATER });
      return { status: 200, body: current };
    },
  });
  await p.goto(`/catalog/products/${P1}`);
  await p.getByRole("link", { name: t("catalog.detail.edit") }).click();
  await expect(p).toHaveURL(new RegExp(`/catalog/products/${P1}/edit$`));
  await expect(p.getByRole("link", { name: t("catalog.nav.label"), exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await expect(field(p, t("catalog.form.name"))).toHaveValue("Mineral water 1.5L");
  await expect(field(p, t("catalog.form.description"))).toHaveValue(
    "Still spring water, 1.5 litre bottle.",
  );
  await expect(field(p, t("catalog.form.category"))).toHaveValue(CATEGORY);
  await expect(field(p, t("catalog.form.taxCategory"))).toHaveValue("standard");
  await expect(field(p, t("catalog.form.taxCategory"))).toHaveAttribute("dir", "ltr");
  await expect(p.getByText("10.50 EGP")).toBeVisible();
  await checkAxe(p, "product edit form");

  // A no-op edit submits nothing and says so.
  await p.getByRole("button", { name: t("catalog.edit.save") }).click();
  await expect(p.getByText(t("catalog.edit.noChanges"))).toBeVisible();
  expect(recorded.patches).toEqual([]);

  await field(p, t("catalog.form.taxCategory")).fill("zero");
  await p.getByRole("button", { name: t("catalog.edit.save") }).click();
  await expect(p).toHaveURL(new RegExp(`/catalog/products/${P1}$`));
  expect(recorded.patches).toEqual([{ expectedUpdatedAt: LOADED_AT, taxCategory: "zero" }]);
  await expect(p.getByRole("region", { name: t("catalog.detail.tenant.title") })).toContainText(
    "zero",
  );
});

test("E2: a blocked submit shows the focused summary at the top; links focus fields; entries clear live", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  const recorded = await mockProduct(p);
  await openEdit(p, t);

  // No premature errors: nothing is in error before the first submit.
  await expect(p.locator("[aria-invalid='true']")).toHaveCount(0);

  await field(p, t("catalog.form.name")).fill("   ");
  await field(p, t("catalog.form.taxCategory")).fill("");
  await p.getByRole("button", { name: t("catalog.edit.save") }).click();

  const summary = p.getByRole("region", { name: t("components.errorSummary.title", { count: 2 }) });
  await expect(summary).toBeVisible();
  await expect(summary).toBeFocused();
  await expect(summary.getByRole("link")).toHaveText([
    t("catalog.form.error.nameRequired"),
    t("catalog.form.error.taxCategoryRequired"),
  ]);
  expect(recorded.patches).toEqual([]);

  // The same errors inline: aria-invalid and aria-describedby.
  for (const label of [t("catalog.form.name"), t("catalog.form.taxCategory")]) {
    const input = field(p, label);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(input).toHaveAttribute("aria-describedby", /error/);
  }
  // At the top of the form: above the first field.
  const order = await p.evaluate(() => {
    const region = document.querySelector(".form-error-summary");
    const first = document.querySelector("#product-name");
    return region && first ? region.compareDocumentPosition(first) : 0;
  });
  expect(order & 4).toBeTruthy(); // DOCUMENT_POSITION_FOLLOWING

  await checkAxe(p, "product edit error summary, light");
  await setTheme(p, "dark");
  await checkAxe(p, "product edit error summary, dark");
  await setTheme(p, "light");

  // A link focuses its field and does not leave the page.
  await summary.getByRole("link", { name: t("catalog.form.error.taxCategoryRequired") }).click();
  await expect(field(p, t("catalog.form.taxCategory"))).toBeFocused();
  await expect(p).toHaveURL(new RegExp(`/catalog/products/${P1}/edit$`));
  await expect(p.getByText(t("shell.leave.title"))).toHaveCount(0);

  // Fixing a field clears its entry live; focus stays where the person is typing.
  await field(p, t("catalog.form.taxCategory")).fill("zero");
  await expect(field(p, t("catalog.form.taxCategory"))).toBeFocused();
  await expect(
    p.getByRole("region", { name: t("components.errorSummary.title", { count: 1 }) }),
  ).toBeVisible();
  await field(p, t("catalog.form.name")).fill("Water");
  await expect(p.locator(".form-error-summary")).toHaveCount(0);
  await expect(p.locator("[aria-invalid='true']")).toHaveCount(0);
});

test("E3: 409 stale_write: a conflict banner with Reload, and what was typed is kept", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  let current = detail();
  const recorded = await mockProduct(p, {
    get: () => current,
    patch: () => ({ status: 409, body: failure("stale_write", "r-stale") }),
  });
  await openEdit(p, t);
  await field(p, t("catalog.form.description")).fill("My own description");
  await p.getByRole("button", { name: t("catalog.edit.save") }).click();

  await expect(p.getByText(t("catalog.write.error.stale"))).toBeVisible();
  await expect(p.getByText("r-stale")).toBeVisible();
  await expect(field(p, t("catalog.form.description"))).toHaveValue("My own description");
  await expect(p.locator("[aria-invalid='true']")).toHaveCount(0);
  await expect(p.locator(".form-error-summary")).toHaveCount(0);
  await checkAxe(p, "product edit conflict banner");

  current = detail({}, { name: "Water (renamed)", taxCategory: "reduced", updatedAt: LATER });
  await p.getByRole("button", { name: t("catalog.edit.reload") }).click();
  await expect(p.getByText(t("catalog.edit.reloaded"))).toBeVisible();
  await expect(field(p, t("catalog.form.description"))).toHaveValue("My own description");
  await expect(field(p, t("catalog.form.name"))).toHaveValue("Water (renamed)");
  expect(recorded.gets).toBeGreaterThanOrEqual(2);
});

test("E4: Retire asks first (Cancel has focus), then the item reads retired and read-only", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "tenant_admin");
  let current = detail();
  const recorded = await mockProduct(p, {
    get: () => current,
    retire: () => {
      current = detail({}, { status: "retired", updatedAt: LATER });
      return { status: 200, body: current };
    },
  });
  await p.goto(`/catalog/products/${P1}`);
  await p.getByRole("button", { name: t("catalog.retire.start") }).click();

  const confirm = p.getByRole("region", { name: t("catalog.retire.confirmLabel") });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(t("catalog.retire.consequence"));
  await expect(p.getByRole("button", { name: t("common.cancel") })).toBeFocused();
  expect(recorded.retires).toEqual([]);
  await checkAxe(p, "retire confirmation, light");
  await setTheme(p, "dark");
  await checkAxe(p, "retire confirmation, dark");
  await setTheme(p, "light");

  // Cancel closes it and returns focus to the starter; nothing is written.
  await p.keyboard.press("Enter");
  await expect(confirm).toHaveCount(0);
  await expect(p.getByRole("button", { name: t("catalog.retire.start") })).toBeFocused();
  expect(recorded.retires).toEqual([]);

  await p.getByRole("button", { name: t("catalog.retire.start") }).click();
  await p.getByRole("button", { name: t("catalog.retire.confirm") }).click();
  await expect(p.getByText(t("catalog.retire.done", { name: "Mineral water 1.5L" }))).toBeVisible();
  expect(recorded.retires).toEqual([{ expectedUpdatedAt: LOADED_AT }]);
  await expect(p.getByRole("link", { name: t("catalog.detail.edit") })).toHaveCount(0);
  await expect(p.getByRole("button", { name: t("catalog.retire.start") })).toHaveCount(0);
  await expect(p.getByText(t("catalog.status.retired")).first()).toBeVisible();
  await checkAxe(p, "retired item");

  // A retired item's edit route is read-only too: no form.
  await p.goto(`/catalog/products/${P1}/edit`);
  await expect(p.getByText(t("catalog.edit.retired"))).toBeVisible();
  await expect(p.locator("main form, main input, main textarea, main select")).toHaveCount(0);
});

test("E4b: a failed retire is a banner with the request id; the item stays active", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "owner");
  const recorded = await mockProduct(p, {
    retire: () => ({ status: 500, body: failure("internal_error", "r-500") }),
  });
  await p.goto(`/catalog/products/${P1}`);
  await p.getByRole("button", { name: t("catalog.retire.start") }).click();
  await p.getByRole("button", { name: t("catalog.retire.confirm") }).click();
  await expect(p.getByText(t("catalog.write.error.server"))).toBeVisible();
  await expect(p.getByText("r-500")).toBeVisible();
  expect(recorded.retires).toHaveLength(1);
  await expect(p.getByRole("link", { name: t("catalog.detail.edit") })).toBeVisible();
  await checkAxe(p, "retire failure banner");
});

test("E5: store_manager sees the item read-only: no Edit, no Retire, and the edit route has no form", async ({
  page: p,
  t,
}) => {
  await mockBase(p, "store_manager");
  const recorded = await mockProduct(p);
  await p.goto(`/catalog/products/${P1}`);
  await expect(p.getByRole("heading", { level: 1, name: "Mineral water 1.5L" })).toBeVisible();
  await expect(p.getByRole("link", { name: t("catalog.detail.edit") })).toHaveCount(0);
  await expect(p.getByRole("button", { name: t("catalog.retire.start") })).toHaveCount(0);
  await expect(p.getByRole("main").getByRole("button")).toHaveCount(0);

  await p.goto(`/catalog/products/${P1}/edit`);
  await expect(p.getByText(t("catalog.edit.readOnly"))).toBeVisible();
  await expect(p.locator("main form, main input, main textarea, main select")).toHaveCount(0);
  await checkAxe(p, "edit route, read-only role");
  expect(recorded.patches).toEqual([]);
  expect(recorded.retires).toEqual([]);
});

test("E6: Cancel with unsaved edits asks Stay / Discard", async ({ page: p, t }) => {
  await mockBase(p, "owner");
  const recorded = await mockProduct(p);
  await openEdit(p, t);
  await field(p, t("catalog.form.taxCategory")).fill("zero");
  await p.getByRole("button", { name: t("common.cancel") }).click();
  await expect(p.getByText(t("shell.leave.title"))).toBeVisible();
  await p.getByRole("button", { name: t("shell.leave.stay") }).click();
  await expect(p).toHaveURL(new RegExp(`/catalog/products/${P1}/edit$`));
  await expect(field(p, t("catalog.form.taxCategory"))).toHaveValue("zero");
  await p.getByRole("button", { name: t("common.cancel") }).click();
  await p.getByRole("button", { name: t("shell.leave.discard") }).click();
  await expect(p).toHaveURL(new RegExp(`/catalog/products/${P1}$`));
  expect(recorded.patches).toEqual([]);
});

for (const forced of [false, true]) {
  test(`E7: keyboard walk through the edit form shows a real outline (forced-colors ${forced})`, async ({
    page: p,
    t,
  }) => {
    await mockBase(p, "owner");
    await mockProduct(p);
    if (forced) await p.emulateMedia({ forcedColors: "active" });
    await openEdit(p, t);

    await field(p, t("catalog.form.name")).focus();
    const stops: { id: string; outlineStyle: string; outlineWidth: number }[] = [];
    for (let i = 0; i < 7; i++) {
      stops.push(
        await p.evaluate(() => {
          const el = document.activeElement as HTMLElement;
          const style = getComputedStyle(el);
          return {
            id: el.id || el.textContent?.trim() || el.tagName,
            outlineStyle: style.outlineStyle,
            outlineWidth: Number.parseFloat(style.outlineWidth),
          };
        }),
      );
      await p.keyboard.press("Tab");
    }
    expect(stops.map((s) => s.id).slice(0, 5)).toEqual([
      "product-name",
      "product-description",
      "product-category",
      "product-tax-category",
      "product-available",
    ]);
    for (const stop of stops) {
      expect(stop.outlineStyle, stop.id).not.toBe("none");
      expect(stop.outlineWidth, stop.id).toBeGreaterThan(0);
    }

    // The summary's links are real stops too, in the same outline: Tab from the focused summary.
    await field(p, t("catalog.form.name")).fill("");
    await p.getByRole("button", { name: t("catalog.edit.save") }).click();
    const summary = p.getByRole("region", {
      name: t("components.errorSummary.title", { count: 1 }),
    });
    await expect(summary).toBeFocused();
    await p.keyboard.press("Tab");
    const link = summary.getByRole("link");
    await expect(link).toBeFocused();
    const outline = await link.evaluate((el) => {
      const style = getComputedStyle(el);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
    await p.keyboard.press("Enter");
    await expect(field(p, t("catalog.form.name"))).toBeFocused();
  });
}
