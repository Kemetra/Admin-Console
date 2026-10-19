import { expect, test } from "./fixtures";

/**
 * RT-665 against the BUILT SPA (production preview, C-5 mocked Backend-Core).
 * The AI plan & usage panel is unreleased: the Backend-Core runtime (RT-664)
 * does not exist, so a production build follows the gated-nav precedent
 * (RT-270) and shows no panel and sends no request, for any role. The panel's
 * content, roles and states are covered by the unit tests. Axe (WCAG 2.1 A/AA,
 * en + ar) was run by hand against the dev server (the `import.meta.env.DEV` gate
 * on); that spec is not committed, see the PR's release steps.
 */
const TENANT = "t1";

function ctx(role: string) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: TENANT, name: "Northstar Retail" },
    active_store: null,
    active_role_code: role,
    memberships: [{ tenant_id: TENANT, tenant_name: "Northstar Retail", role_code: role }],
  };
}

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

for (const role of ["owner", "tenant_admin", "store_manager"]) {
  test(`production build: ${role} sees no AI panel and no AI request is sent`, async ({
    page,
    t,
  }) => {
    let aiGets = 0;
    await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
    await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
    await page.route("**/api/v1/stores", (r) => r.fulfill(json([])));
    await page.route(`**/api/v1/tenants/${TENANT}`, (r) =>
      r.fulfill(
        json({ id: TENANT, slug: "northstar", name: "Northstar Retail", status: "active" }),
      ),
    );
    await page.route(`**/api/v1/tenants/${TENANT}/ai/entitlements`, (r) => {
      aiGets += 1;
      return r.fulfill(json({}, 404));
    });

    await page.goto(`/tenants/${TENANT}`);
    await expect(page.getByRole("heading", { name: "Northstar Retail" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(t("aiPlan.full.title"))).toHaveCount(0);
    await expect(page.getByText(t("aiPlan.minimal.title"))).toHaveCount(0);
    expect(aiGets).toBe(0);
  });
}
