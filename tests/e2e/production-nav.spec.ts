import { expect, test } from "@playwright/test";

/**
 * RT-270 (UX-09: no dead destinations) against the BUILT SPA (production
 * preview, C-5 mocked Backend-Core): the sidebar lists only live destinations,
 * with no RF-* gated placeholder.
 */
const ctx = {
  user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "owner",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "owner" }],
};

test("production sidebar shows no RF-* placeholder entries", async ({ page }) => {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );

  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary" });
  await expect(nav.getByRole("link", { name: "Audit" })).toBeVisible();
  await expect(nav.locator(".nav-entry__label")).toHaveText([
    "Overview",
    "Tenants",
    "Stores",
    "Operators",
    "Audit",
    "Stock discrepancies",
    "Sign out",
  ]);
  await expect(nav.locator("[aria-disabled='true']")).toHaveCount(0);
  await expect(nav.getByText(/^RF-/)).toHaveCount(0);
});
