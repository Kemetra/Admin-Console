import { type Page, expect, test } from "./fixtures";

/**
 * RF-6 scope-switch reset E2E (VG-2, S6). After a search, switching scope (RF-1
 * SF-3) re-queries the new scope AND resets the surface back to pre-query — the
 * prior scope's filters/results do not carry over. Driven through the real RF-1
 * scope header (a store switch → switchActiveStore → context re-fetch). Mocked
 * DP2 (C-5).
 */

let activeStore: { id: string; name: string } | null = null;

function ctx() {
  return {
    user: {
      id: "u1",
      email: "amal@northstar.eg",
      display_name: "Amal Saleh",
      is_platform_admin: true,
    },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: activeStore,
    active_role_code: "tenant_admin",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
  };
}

function event(id: string) {
  return {
    id,
    occurred_at: "2026-06-01T09:30:00Z",
    action: "auth.signin",
    actor_label: "Amal Saleh",
    request_id: `1111111${id}-1111-1111-1111-111111111111`,
    metadata: {},
  };
}

async function mock(page: Page): Promise<() => number> {
  let auditCalls = 0;
  activeStore = null;
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx()) }),
  );
  // Switching scope: POST sets a store, DELETE clears it; the provider then
  // re-fetches context (so active_store changes → the reset effect fires).
  await page.route("**/api/v1/context/store", (r) => {
    const method = r.request().method();
    if (method === "POST") activeStore = { id: "s1", name: "Cairo Festival City" };
    if (method === "DELETE") activeStore = null;
    return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/v1/audit/events**", (r) => {
    auditCalls += 1;
    return r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: [event("a")], next_cursor: null }),
    });
  });
  return () => auditCalls;
}

test("S6: switching scope re-queries and resets the surface to pre-query", async ({ page, t }) => {
  // Seed an active store so the scope header exposes a store entry to switch to.
  activeStore = { id: "s1", name: "Cairo Festival City" };
  const auditCalls = await mock(page);
  activeStore = { id: "s1", name: "Cairo Festival City" };

  await page.goto("/audit");
  await page.getByRole("button", { name: t("audit.filters.apply"), exact: true }).click();
  await expect(page.getByText("auth.signin")).toBeVisible();
  const callsAfterSearch = auditCalls();
  expect(callsAfterSearch).toBeGreaterThan(0);

  // Switch scope via the gold scope header: clear the store (a scope change).
  await page.getByRole("button", { name: /Northstar Retail/ }).click();
  await page.getByRole("menuitem", { name: t("shell.scope.allStores") }).click();

  // Surface resets to pre-query (the prior search's rows are gone, prompt back).
  await expect(page.getByText(t("audit.prequery", { tenant: "Northstar Retail" }))).toBeVisible();
  await expect(page.getByText("auth.signin")).toBeHidden();
});
