import { type Page, expect, test } from "./fixtures";

/**
 * RF-1 E2E journeys (VG-2). Drives the built SPA with mocked DP2 responses
 * (C-5: no live backend). Covers the scenarios the validation gate names:
 * S1 single-membership auto-select, S2 multi-membership gate, S6 sign-out,
 * S7 no-access. Register the broad catch-all before the specific route so the
 * specific one wins (Playwright matches in reverse registration order).
 */

const user = {
  id: "u1",
  email: "amal@northstar.eg",
  display_name: "Amal Saleh",
  is_platform_admin: false,
};

async function mockContext(page: Page, body: unknown) {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }),
  );
}

test("S2: multi-membership lands on the full-screen scope gate", async ({ page, t }) => {
  await mockContext(page, {
    user,
    active_tenant: null,
    memberships: [
      { tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "platform_admin" },
      { tenant_id: "t2", tenant_name: "Helios Markets", role_code: "platform_admin" },
    ],
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.gate.title") })).toBeVisible();
  await expect(page.getByText("Northstar Retail")).toBeVisible();
  await expect(page.getByText("Helios Markets")).toBeVisible();
});

test("resolved context renders the app shell with the gold scope header", async ({ page, t }) => {
  await mockContext(page, {
    user,
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: { id: "s1", name: "Cairo Festival City" },
    active_role_code: "tenant_admin",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail" }],
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  // Scope header shows tenant > store
  await expect(
    page.getByRole("button", { name: /Northstar Retail.*Cairo Festival City/s }),
  ).toBeVisible();
});

test("S7: zero memberships renders the no-access state with sign-out", async ({ page, t }) => {
  await mockContext(page, { user, active_tenant: null, memberships: [] });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("auth.noAccess.title") })).toBeVisible();
  await expect(page.getByRole("button", { name: t("auth.noAccess.signOut") })).toBeVisible();
});

test("S5/A7: a 401 on the protected route redirects to sign-in (refresh also fails)", async ({
  page,
  t,
}) => {
  // No session: context (and the refresh retry) both 401. The guard must route
  // to SF-1, NOT render no-access. Distinguishes 'not signed in' from 'no access'.
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"error":{"code":"unauthenticated"}}',
    }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/signin$/);
  await expect(page.getByRole("button", { name: t("auth.signIn.submit") })).toBeVisible();
});
