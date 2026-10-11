import { type Page, expect, test } from "./fixtures";

/**
 * RF-5 accept-invitation E2E (VG-2, S7). Public route. Valid token → session
 * established → land in the shell; invalid token → generic error. Mocked DP2.
 * RT-399: runs in both locales, selecting by the catalog copy the app renders.
 */

async function mockUnauthThenSession(page: Page): Promise<void> {
  // Before accept: no session (context 401). After accept 200: context resolves.
  let accepted = false;
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill(
      accepted
        ? {
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              user: { id: "u9", email: "new@northstar.eg", display_name: "New User" },
              active_tenant: { id: "t1", name: "Northstar Retail" },
              active_store: null,
              active_role_code: "store_staff",
              memberships: [
                { tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "store_staff" },
              ],
            }),
          }
        : { status: 401, contentType: "application/json", body: "{}" },
    ),
  );
  await page.route("**/api/v1/invitations/accept", (r) => {
    accepted = true;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "m9", tenant_id: "t1", user_id: "u9", role_code: "store_staff" }),
    });
  });
  await page.route("**/api/v1/auth/refresh", (r) => r.fulfill({ status: 401, body: "{}" }));
}

test("S7: valid token → accept → session established → land in the shell", async ({ page, t }) => {
  await mockUnauthThenSession(page);
  await page.goto("/accept-invitation?token=valid-token");
  await expect(page.getByRole("heading", { name: t("auth.acceptInvitation.title") })).toBeVisible();
  await page.getByLabel(t("auth.acceptInvitation.displayName.label")).fill("New User");
  await page.getByLabel(t("auth.acceptInvitation.password.label")).fill("a-strong-password");
  await page.getByRole("button", { name: t("auth.acceptInvitation.submit") }).click();

  // routed into the shell (Overview), context now resolves
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
});

test("S7: invalid/expired token → generic error, no navigation", async ({ page, t }) => {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/invitations/accept", (r) =>
    r.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "invalid_token" } }),
    }),
  );

  await page.goto("/accept-invitation?token=bad");
  await page.getByLabel(t("auth.acceptInvitation.password.label")).fill("whatever-it-is");
  await page.getByRole("button", { name: t("auth.acceptInvitation.submit") }).click();

  await expect(page.getByText(t("auth.acceptInvitation.errors.invalidLink"))).toBeVisible();
  await expect(page).toHaveURL(/\/accept-invitation/);
});
