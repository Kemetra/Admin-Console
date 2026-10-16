import { type Page, expect, test } from "./fixtures";

/**
 * RT-371 device registry E2E against mocked Backend-Core (C-5).
 * S1: owner → nav → fleet in the server's order → filters sent to the server →
 *     detail (Overview, History) → Back keeps the filters.
 * S2: Store Detail deep link → the registry filtered to that store.
 * S3: a store manager's deep link to a store outside the scope → the server's
 *     404 reads as that store's devices being unavailable, never as empty.
 * S4: a role the API refuses (store_staff) has no nav entry, and a direct URL
 *     gets the uniform 404 as "not available", never an empty fleet.
 * S5: an empty fleet says so.
 * RT-399: runs in both locales; copy comes from the catalog (`t`), mocked data
 * (store names, labels, ids) stays as authored.
 */
const DUBAI = "0190f000-0000-7000-8000-0000000000a1";
const OTHER_STORE = "0190f000-0000-7000-8000-0000000000a9";
const DEVICE_1 = "0190f000-0000-7000-8000-0000000000e1";
const DEVICE_2 = "0190f000-0000-7000-8000-0000000000e2";
const SHIFT_OPEN = "0190f000-0000-7000-8000-0000000000b9";
const USER = "0190f000-0000-7000-8000-0000000000c1";

function ctx(role: string) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: role,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
  };
}

const store = {
  id: DUBAI,
  tenant_id: "t1",
  code: "DXB",
  name: "Dubai Mall",
  timezone: "Asia/Dubai",
  is_active: true,
};

function device(over: Record<string, unknown> = {}) {
  return {
    deviceId: DEVICE_1,
    storeId: DUBAI,
    label: "Till 1",
    trustState: "active",
    createdAt: "2026-07-01T09:00:00Z",
    expiresAt: "2099-01-01T00:00:00Z",
    lastSeenAt: null,
    lastSeenSource: null,
    revokedAt: null,
    revokedByUserId: null,
    revokeReason: null,
    retiredAt: null,
    replacesDeviceId: null,
    replacedByDeviceId: null,
    custodyExceptionShiftId: null,
    ...over,
  };
}

const custodyDevice = device({
  deviceId: DEVICE_2,
  label: "Till 2",
  trustState: "revoked",
  revokedAt: "2026-10-10T12:00:00Z",
  revokedByUserId: USER,
  revokeReason: "stolen",
  custodyExceptionShiftId: SHIFT_OPEN,
});

const custodyDetail = {
  ...custodyDevice,
  revokeNote: "Reported stolen at 11:40; drawer cash counted into the safe.",
  retiredByUserId: null,
  retireReason: null,
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function mockBase(page: Page, role: string): Promise<void> {
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json([store])));
  await page.route(`**/api/v1/stores/${DUBAI}`, (r) => r.fulfill(json(store)));
}

/** Records every list query and answers with `items`. */
async function mockList(page: Page, items: unknown[]): Promise<URLSearchParams[]> {
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/devices?**", (r) => {
    queries.push(new URL(r.request().url()).searchParams);
    return r.fulfill(json({ items, nextCursor: null }));
  });
  return queries;
}

test("S1: owner → fleet (server order) → filters → detail tabs → Back keeps filters", async ({
  page,
  t,
}) => {
  await mockBase(page, "owner");
  const queries = await mockList(page, [custodyDevice, device()]);
  await page.route(`**/api/v1/devices/${DEVICE_2}`, (r) => r.fulfill(json(custodyDetail)));

  await page.goto("/");
  await page.getByRole("link", { name: t("devices.nav.label") }).click();
  await expect(page.getByRole("heading", { name: t("devices.list.title") })).toBeVisible();

  // The server's exception-first order, as received; Unknown is never "healthy".
  const rows = page.getByRole("row").filter({ hasText: "Dubai Mall" });
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Till 2");
  await expect(rows.nth(0)).toContainText(t("devices.attention.custody"));
  await expect(rows.nth(1)).toContainText("Till 1");
  await expect(rows.nth(1).getByText(t("devices.lastSeen.unknown"))).toBeVisible();
  expect(queries[0].get("store_id")).toBeNull();

  // Filters are applied by the server, and live in the URL.
  await page.getByLabel(t("devices.filter.store")).selectOption(DUBAI);
  await page.getByLabel(t("devices.filter.trust")).selectOption("revoked");
  await page.getByRole("button", { name: t("devices.filter.apply") }).click();
  await expect(page).toHaveURL(new RegExp(`/devices\\?store=${DUBAI}&state=revoked$`));
  await expect.poll(() => queries.at(-1)?.get("trust_state")).toBe("revoked");
  expect(queries.at(-1)?.get("store_id")).toBe(DUBAI);

  // Detail: the custody exception is stated; the revoke note is on History only.
  await rows.nth(0).click();
  await expect(page.getByRole("heading", { level: 1, name: "Till 2" })).toBeVisible();
  await expect(page.getByText(t("devices.custody.title"))).toBeVisible();
  await expect(page.getByText(SHIFT_OPEN)).toBeVisible();
  await expect(page.getByText(/Reported stolen/)).toHaveCount(0);

  await page.getByRole("tab", { name: t("devices.detail.tab.history") }).click();
  await expect(page).toHaveURL(/\?tab=history$/);
  const history = page.getByRole("tabpanel");
  await expect(history.getByText(t("devices.reason.stolen"), { exact: true })).toBeVisible();
  await expect(history.getByText(/Reported stolen/)).toBeVisible();

  await page.getByRole("link", { name: t("devices.detail.back") }).click();
  await expect(page).toHaveURL(new RegExp(`/devices\\?store=${DUBAI}&state=revoked$`));
  await expect(page.getByLabel(t("devices.filter.trust"))).toHaveValue("revoked");
});

test("S2: Store Detail deep-links to the registry filtered to that store", async ({ page, t }) => {
  await mockBase(page, "store_manager");
  const queries = await mockList(page, [device()]);

  await page.goto(`/stores/${DUBAI}`);
  await page.getByRole("link", { name: t("stores.detail.devices") }).click();
  await expect(page).toHaveURL(new RegExp(`/devices\\?store=${DUBAI}$`));
  await expect(page.getByRole("row").filter({ hasText: "Till 1" })).toBeVisible();
  expect(queries[0].get("store_id")).toBe(DUBAI);
  await expect(page.getByLabel(t("devices.filter.store"))).toHaveValue(DUBAI);
});

test("S3: a deep link to a store outside the scope reads as unavailable, not empty", async ({
  page,
  t,
}) => {
  await mockBase(page, "store_manager");
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/devices?**", (r) => {
    queries.push(new URL(r.request().url()).searchParams);
    return r.fulfill(json({ error: { code: "not_found", message: "Not found" } }, 404));
  });

  await page.goto(`/devices?store=${OTHER_STORE}`);
  await expect(page.getByText(t("devices.list.storeUnavailable"))).toBeVisible();
  await expect(page.getByText(t("devices.list.empty"))).toHaveCount(0);
  expect(queries[0].get("store_id")).toBe(OTHER_STORE);
  await expect(page.getByLabel(t("devices.filter.store"))).toHaveValue(OTHER_STORE);
});

test("S4: a refused role has no nav entry, and a direct URL reads as unavailable", async ({
  page,
  t,
}) => {
  await mockBase(page, "store_staff");
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/devices?**", (r) => {
    queries.push(new URL(r.request().url()).searchParams);
    return r.fulfill(json({ error: { code: "not_found", message: "Not found" } }, 404));
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: t("shell.overview.title") })).toBeVisible();
  await expect(page.getByRole("link", { name: t("devices.nav.label") })).toHaveCount(0);

  // The nav mirrors the API; the API's non-disclosing 404 is the authority.
  await page.goto("/devices");
  await expect(page.getByText(t("devices.list.unavailable"))).toBeVisible();
  await expect(page.getByText(t("devices.list.empty"))).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(queries).toHaveLength(1);
});

test("S5: an empty fleet says so", async ({ page, t }) => {
  await mockBase(page, "tenant_admin");
  await mockList(page, []);
  await page.goto("/devices");
  await expect(page.getByText(t("devices.list.empty"))).toBeVisible();
});
