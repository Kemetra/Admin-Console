import { test } from "@e2e-dev/web";
import { expect } from "e2e";

/**
 * RT-299: RF-2 tenant create (VG-2, Scenario S2) on the tester-army/e2e
 * engine. Locator steps only, no model. Mocked API (C-5), same shapes as
 * tests/e2e/tenant-create.spec.ts.
 */

const resolvedContext = {
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

const createdTenant = { id: "t9", slug: "acme", name: "Acme Corp", status: "active" };

test("S2: platform admin creates a tenant and lands on its detail", async ({
  app,
  screen,
  browser,
}) => {
  const createBodies: unknown[] = [];

  // Routes run newest first: register the catch-all before the specific ones.
  await browser.route("**/api/v1/**", (route) => route.fulfill({ json: {} }));
  await browser.route("**/api/v1/context/me", (route) => route.fulfill({ json: resolvedContext }));
  await browser.route("**/api/v1/tenants", (route) => {
    if (route.request.method === "POST") {
      createBodies.push(JSON.parse(route.request.postData ?? "null"));
      return route.fulfill({ status: 201, json: createdTenant });
    }
    return route.fulfill({ json: [] });
  });
  await browser.route("**/api/v1/tenants/t9", (route) => route.fulfill({ json: createdTenant }));

  await app.open("/tenants/new");
  await expect(screen.getByRole("heading", "New tenant")).toBeVisible();

  await screen.getByLabel("Slug").fill("acme");
  await screen.getByLabel("Name").fill("Acme Corp");
  await screen.getByRole("button", "Create tenant").tap();

  await expect(screen.getByRole("heading", "Acme Corp")).toBeVisible();
  await expect(browser).toHaveURL("/tenants/t9");
  expect(createBodies).toEqual([{ slug: "acme", name: "Acme Corp" }]);
});
