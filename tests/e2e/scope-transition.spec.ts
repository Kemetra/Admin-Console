import { type Page, expect, test } from "./fixtures";

/**
 * RT-268 (UX-09) — scope change and navigation are context transitions. With
 * unsaved form work they ask Stay / Discard; a deep link to another store's
 * view never switches scope by itself. Runs on the built SPA with the real data
 * router. Mocked DP2 (C-5).
 */

let activeStore: { id: string; name: string } | null = null;
let storeSwitches: string[] = [];

function ctx() {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: activeStore,
    active_role_code: "tenant_admin",
    memberships: [
      {
        tenant_id: "t1",
        tenant_name: "Northstar Retail",
        role_code: "tenant_admin",
        store_access_kind: "all",
      },
    ],
  };
}

const stores = [
  { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
  { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: true },
];

async function mock(page: Page): Promise<void> {
  storeSwitches = [];
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx()) }),
  );
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(stores) }),
  );
  await page.route("**/api/v1/context/store", (r) => {
    const method = r.request().method();
    if (method === "DELETE") {
      activeStore = null;
      storeSwitches.push("all");
    } else {
      const body = r.request().postDataJSON() as { store_id: string };
      const s = stores.find((x) => x.id === body.store_id);
      activeStore = s ? { id: s.id, name: s.name } : null;
      storeSwitches.push(body.store_id);
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx()) });
  });
}

test.beforeEach(async ({ page }) => {
  activeStore = null;
  await mock(page);
});

test("scope switch with a dirty form: Stay keeps the work, Discard switches", async ({
  page,
  t,
}) => {
  await page.goto("/tenants/new");
  const name = page.getByLabel(t("tenants.field.name"), { exact: true });
  await name.fill("Helios Markets");

  await page.getByRole("button", { name: /Northstar Retail/ }).click();
  await page.getByRole("menuitem", { name: "New Cairo Mall" }).click();
  const dialog = page.getByRole("alertdialog", { name: t("shell.leave.title") });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: t("shell.leave.stay") })).toBeFocused();

  await page.getByRole("button", { name: t("shell.leave.stay") }).click();
  await expect(dialog).toBeHidden();
  await expect(name).toHaveValue("Helios Markets");
  expect(storeSwitches).toEqual([]);

  await page.getByRole("button", { name: /Northstar Retail/ }).click();
  await page.getByRole("menuitem", { name: "New Cairo Mall" }).click();
  await page.getByRole("button", { name: t("shell.leave.discard") }).click();
  await expect(page.getByRole("button", { name: /New Cairo Mall/ })).toBeVisible();
  expect(storeSwitches).toEqual(["s2"]);
  // The old scope's draft is gone: the routed surface remounted.
  await expect(page.getByLabel(t("tenants.field.name"), { exact: true })).toHaveValue("");
});

test("navigating away from a dirty form asks first", async ({ page, t }) => {
  await page.goto("/tenants/new");
  await page.getByLabel(t("tenants.field.name"), { exact: true }).fill("Helios Markets");
  await page.getByRole("link", { name: t("shell.nav.stores") }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/tenants\/new$/);

  await page.getByRole("link", { name: t("shell.nav.stores") }).click();
  await page.getByRole("button", { name: t("shell.leave.discard") }).click();
  await expect(page).toHaveURL(/\/stores$/);
});

test("a deep link to another store's view asks instead of switching", async ({ page, t }) => {
  activeStore = { id: "s1", name: "Cairo Festival City" };
  await page.goto("/stock-discrepancies/s2");
  const notice = page.getByRole("region", { name: t("shell.mismatch.label") });
  await expect(notice).toContainText(t("shell.mismatch.message", { store: "Cairo Festival City" }));
  expect(storeSwitches).toEqual([]);

  await notice.getByRole("button", { name: t("shell.mismatch.switch") }).click();
  await expect(notice).toBeHidden();
  expect(storeSwitches).toEqual(["s2"]);
});
