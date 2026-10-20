import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RF-2 store list E2E (VG-2, Scenarios S4/S5). With an active tenant the store
 * roster renders scoped to it; with no active tenant the surface pre-gates to a
 * scope prompt (S5) and never issues listStores. Mocked DP2 (C-5).
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

test("S4: store list renders the active tenant's stores and opens a detail", async ({
  page,
  t,
}) => {
  await mockBase(page, {
    user,
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: "tenant_admin",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
  });
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "s1",
          code: "CFC",
          name: "Cairo Festival City",
          is_active: true,
          timezone: "Africa/Cairo",
        },
        { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: false, timezone: "UTC" },
      ]),
    }),
  );
  await page.route("**/api/v1/stores/s1", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true }),
    }),
  );

  await page.goto("/stores");
  await expect(
    page.getByRole("heading", { name: t("stores.list.title"), exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "Cairo Festival City" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "New Cairo Mall" })).toBeVisible();
  // State badges are catalog labels, one per row.
  await expect(
    page.getByRole("cell", { name: t("stores.state.active"), exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: t("stores.state.inactive"), exact: true }),
  ).toBeVisible();

  // RT-477: the store's time zone, as its IANA identity.
  await expect(page.getByRole("columnheader", { name: t("stores.field.timezone") })).toBeVisible();
  await expect(page.getByRole("cell", { name: /Africa\/Cairo/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: "UTC", exact: true })).toBeVisible();

  await page.getByRole("cell", { name: "Cairo Festival City" }).click();
  await expect(page.getByRole("heading", { name: "Cairo Festival City" })).toBeVisible();
  await expect(page.getByText("CFC")).toBeVisible();
});

test("S5: no active tenant -> scope prompt, store list never loads", async ({ page, t }) => {
  let storesCalled = false;
  await mockBase(page, {
    user,
    // Platform admin with multiple memberships but no tenant selected yet.
    active_tenant: null,
    active_store: null,
    memberships: [
      { tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "platform_admin" },
      { tenant_id: "t2", tenant_name: "Helios Markets", role_code: "platform_admin" },
    ],
  });
  await page.route("**/api/v1/stores", (r) => {
    storesCalled = true;
    return r.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  });

  // With no active tenant RF-1 shows the scope gate at "/", so assert the gate
  // is what an operator sees; the store route is unreachable without scope.
  await page.goto("/stores");
  // The protected layout gates on context: no active tenant -> RF-1 scope gate.
  await expect(page.getByRole("heading", { name: t("shell.gate.title") })).toBeVisible();
  expect(storesCalled).toBe(false);
});

test("RT-549: loading shows the skeleton table with the real headers, then the rows", async ({
  page,
  t,
}) => {
  await mockBase(page, {
    user,
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: "tenant_admin",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
  });
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/stores", async (r) => {
    await gate;
    await r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
      ]),
    });
  });

  await page.goto("/stores");
  const table = page.getByRole("table", { name: t("stores.list.caption") });
  await expect(table).toHaveAttribute("aria-busy", "true");
  // Store, code, time zone (RT-477), status.
  await expect(table.getByRole("columnheader")).toHaveCount(4);
  await expect(table.locator("tbody tr")).toHaveCount(6);
  await expect(
    page.getByRole("status").filter({
      hasText: t("components.list.loading", { label: t("stores.list.loadingNoun") }),
    }),
  ).toHaveCount(1);
  // Hovering a skeleton row must not drop its surface ground (bars stay visible).
  const row = table.locator("tbody tr").first();
  const before = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
  await row.hover();
  // Let the row's colour transition (--duration-2) settle before reading it back.
  await row.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(before);
  // The header action is available while loading.
  await expect(page.getByRole("link", { name: t("stores.list.add") })).toBeVisible();

  release();
  await expect(page.getByRole("cell", { name: "Cairo Festival City" })).toBeVisible();
  await expect(page.getByRole("table", { name: t("stores.list.caption") })).not.toHaveAttribute(
    "aria-busy",
    "true",
  );
});

test("RT-549: forced colours keep the skeleton bars visible as outlines", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await mockBase(page, {
    user,
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: "tenant_admin",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
  });
  await page.route("**/api/v1/stores", () => new Promise(() => {}));

  await page.goto("/stores");
  const bar = page.locator(".skeleton").first();
  await expect(bar).toBeVisible();
  await expect(bar).toHaveCSS("border-top-width", "1px");
});

/**
 * RT-753 (UX-10) — the shared DataTable sort on its reference screen: the
 * keyboard reaches the header button, Enter/Space sorts, `aria-sort` follows,
 * and the page stays free of WCAG 2.1 A/AA axe violations with a sort active.
 * Focus outlines for the header buttons are covered by focus-forced-colors.spec.ts.
 */
async function openSortableRoster(page: Page): Promise<void> {
  await mockBase(page, {
    user,
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: "tenant_admin",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
  });
  const roster = [
    { id: "s1", code: "ZMK", name: "Zamalek", is_active: false },
    { id: "s2", code: "ALX", name: "Mall 10", is_active: true },
    { id: "s3", code: "MAD", name: "Mall 2", is_active: true },
  ];
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(roster) }),
  );
  await page.goto("/stores");
  await expect(page.getByRole("table")).toBeVisible();
}

const storeNames = (page: Page) => page.locator("tbody tr td:first-child").allTextContents();

test("RT-753: the roster starts in the server's order with no aria-sort", async ({ page }) => {
  await openSortableRoster(page);
  expect(await storeNames(page)).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
  await expect(page.locator("th[aria-sort]")).toHaveCount(0);
});

test("RT-753: the keyboard sorts a column and aria-sort follows", async ({ page, t }) => {
  await openSortableRoster(page);
  const header = page.getByRole("columnheader", { name: t("stores.list.col.store") });
  await header.getByRole("button").focus();
  await page.keyboard.press("Enter");
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  expect(await storeNames(page)).toEqual(["Mall 2", "Mall 10", "Zamalek"]);

  await page.keyboard.press("Space");
  await expect(header).toHaveAttribute("aria-sort", "descending");
  expect(await storeNames(page)).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
  await expect(page.locator("th[aria-sort]")).toHaveCount(1);
});

test("RT-753: no axe violations with a sort active", async ({ page, t }) => {
  await openSortableRoster(page);
  await page
    .getByRole("columnheader", { name: t("stores.list.col.store") })
    .getByRole("button")
    .click();
  await expectNoAxeViolations(page, "/stores sorted");
});
