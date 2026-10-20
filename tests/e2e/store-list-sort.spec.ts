import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-753 (UX-10) — the shared DataTable sort on its reference screen. Drives the
 * built SPA with a mocked API (C-5): the keyboard reaches the header button,
 * Enter/Space sorts, `aria-sort` follows, and the page stays free of WCAG 2.1
 * A/AA axe violations with a sort active. Forced-colors focus outlines for the
 * new header buttons are covered by focus-forced-colors.spec.ts, which
 * keyboard-walks /stores.
 */

const context = {
  user: {
    id: "u1",
    email: "amal@northstar.eg",
    display_name: "Amal Saleh",
    is_platform_admin: true,
  },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "platform_admin",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "platform_admin" }],
};

const stores = [
  { id: "s1", code: "ZMK", name: "Zamalek", is_active: false },
  { id: "s2", code: "ALX", name: "Mall 10", is_active: true },
  { id: "s3", code: "MAD", name: "Mall 2", is_active: true },
];

async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(context) }),
  );
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stores) }),
  );
}

async function firstColumn(page: Page): Promise<string[]> {
  return page.locator("tbody tr td:first-child").allTextContents();
}

test.describe("store list sort (RT-753)", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await page.goto("/stores");
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("starts in the server's order with no aria-sort", async ({ page }) => {
    expect(await firstColumn(page)).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
    await expect(page.locator("th[aria-sort]")).toHaveCount(0);
  });

  test("the keyboard sorts a column and aria-sort follows", async ({ page, t }) => {
    const header = page.getByRole("columnheader", { name: t("stores.list.col.store") });
    await header.getByRole("button").focus();
    await page.keyboard.press("Enter");
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(await firstColumn(page)).toEqual(["Mall 2", "Mall 10", "Zamalek"]);

    await page.keyboard.press("Space");
    await expect(header).toHaveAttribute("aria-sort", "descending");
    expect(await firstColumn(page)).toEqual(["Zamalek", "Mall 10", "Mall 2"]);
    await expect(page.locator("th[aria-sort]")).toHaveCount(1);
  });

  test("no axe violations with a sort active", async ({ page, t }) => {
    await page
      .getByRole("columnheader", { name: t("stores.list.col.store") })
      .getByRole("button")
      .click();
    await expectNoAxeViolations(page, "/stores sorted");
  });
});
