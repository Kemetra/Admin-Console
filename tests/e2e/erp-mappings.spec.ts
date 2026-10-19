import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-725 ERPNext item and warehouse mappings E2E against mocked Backend-Core
 * (C-5), in both locales (copy from the catalog via `t`).
 * M1: owner → ERP connection → mappings; confirm a suggestion, retire a mapping
 *     and suggest its replacement, set a warehouse for an unmapped store and
 *     retire another. Each mutation is sent once, only after its confirm, with
 *     the version on screen; every request stays on Backend-Core `/api/v1/`.
 * M2: store_manager — NoAccess on the direct URL, no mapping request.
 */
const STORE_A = "0190f000-0000-7000-8000-0000000000a1";
const STORE_B = "0190f000-0000-7000-8000-0000000000a2";
const PRODUCT_1 = "0190f000-0000-7000-8000-0000000000c1";
const PRODUCT_2 = "0190f000-0000-7000-8000-0000000000c2";
const MAP_PATHS = /\/api\/v1\/catalog\/erpnext-(item|warehouse)-mappings/;
const T0 = "2026-10-18T09:00:00Z";

function ctx(role: string) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: role,
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
  };
}

const stores = [
  { id: STORE_A, tenant_id: "t1", code: "MAD", name: "Maadi", is_active: true },
  { id: STORE_B, tenant_id: "t1", code: "ZAM", name: "Zamalek", is_active: true },
];

function item(id: string, product: string, ref: string, state: string, version: number) {
  return {
    id,
    tenant_product_id: product,
    erpnext_item_ref: ref,
    state,
    suggestion_source: "manual",
    version,
    suggested_by: null,
    suggested_at: T0,
    confirmed_by: null,
    confirmed_at: state === "confirmed" ? T0 : null,
    retired_at: null,
    created_at: T0,
    updated_at: T0,
  };
}

function warehouse(id: string, store: string, ref: string, version: number) {
  return {
    id,
    store_id: store,
    purpose: "stock",
    erpnext_warehouse_ref: ref,
    version,
    set_by: null,
    set_at: T0,
    retired_at: null,
    created_at: T0,
    updated_at: T0,
  };
}

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/** The mocked row a mutation addresses (the test only addresses rows it listed). */
function byId<R extends { id: string }>(rows: readonly R[], id: string | undefined): R {
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`no mocked row ${id}`);
  return row;
}

interface Sent {
  method: string;
  url: string;
  body: unknown;
}

/** A small stateful Backend-Core: the lists answer what the mutations left behind. */
async function mockBackend(page: Page, role: string): Promise<{ sent: Sent[]; urls: string[] }> {
  const sent: Sent[] = [];
  const urls: string[] = [];
  page.on("request", (r) => {
    if (["fetch", "xhr"].includes(r.resourceType())) urls.push(r.url());
  });
  let items = [
    item("i1", PRODUCT_1, "ITEM-COLA-330", "suggested", 3),
    item("i2", PRODUCT_2, "ITEM-WATER-1L", "confirmed", 5),
  ];
  let warehouses = [warehouse("w1", STORE_A, "Maadi Stores - NS", 2)];

  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json(stores)));
  // The ERP connection page (the way in) reads its own five sources: empty, contract-shaped.
  await page.route("**/api/v1/connector/**", (r) => r.fulfill(json({ items: [] })));
  await page.route("**/api/v1/catalog/erpnext-sync-ops/summary**", (r) =>
    r.fulfill(json({ domains: [] })),
  );
  await page.route(
    "**/api/v1/catalog/erpnext-sync-ops/{posting-backlog,reconciliation-runs}**",
    (r) => r.fulfill(json({ items: [], nextCursor: null })),
  );
  await page.route("**/api/v1/catalog/erpnext-item-mappings**", (r) => {
    const req = r.request();
    const url = new URL(req.url());
    if (req.method() === "GET") {
      const state = url.searchParams.get("state");
      return r.fulfill(json({ items: items.filter((i) => !state || i.state === state) }));
    }
    const body = req.postDataJSON();
    sent.push({ method: req.method(), url: url.pathname, body });
    const [, id, action] =
      url.pathname.match(/erpnext-item-mappings\/([^/]+)\/(confirm|retire)$/) ?? [];
    if (action === "confirm") {
      const row = { ...byId(items, id), state: "confirmed", confirmed_at: T0 };
      row.version += 1;
      items = items.map((i) => (i.id === id ? row : i));
      return r.fulfill(json(row));
    }
    if (action === "retire") {
      const row = byId(items, id);
      items = items.filter((i) => i.id !== id);
      return r.fulfill(json({ ...row, retired_at: T0, version: row.version + 1 }));
    }
    const created = item("i3", body.tenant_product_id, body.erpnext_item_ref, "suggested", 1);
    items = [...items, created];
    return r.fulfill(json(created, 201));
  });
  await page.route("**/api/v1/catalog/erpnext-warehouse-mappings**", (r) => {
    const req = r.request();
    const url = new URL(req.url());
    if (req.method() === "GET") return r.fulfill(json({ items: warehouses }));
    const body = req.postDataJSON();
    sent.push({ method: req.method(), url: url.pathname, body });
    const [, id] = url.pathname.match(/erpnext-warehouse-mappings\/([^/]+)\/retire$/) ?? [];
    if (id) {
      const row = byId(warehouses, id);
      warehouses = warehouses.filter((w) => w.id !== id);
      return r.fulfill(json({ ...row, retired_at: T0, version: row.version + 1 }));
    }
    const created = warehouse("w2", body.store_id, body.erpnext_warehouse_ref, 1);
    warehouses = [...warehouses, created];
    return r.fulfill(json(created, 201));
  });
  return { sent, urls };
}

test("M1: owner confirms, retires and re-points item mappings, and sets and retires warehouse mappings", async ({
  page,
  t,
  baseURL,
}) => {
  const { sent, urls } = await mockBackend(page, "owner");
  await page.goto("/erp-connection");
  await page.getByRole("link", { name: t("erp.map.link") }).click();
  await expect(page.getByRole("heading", { name: t("erp.map.title"), level: 1 })).toBeVisible();

  const items = page.getByRole("region", { name: t("erp.map.items.title") });
  const cola = items.getByRole("row", { name: /ITEM-COLA-330/ });
  await expect(cola.getByText(t("erp.map.state.suggested"))).toBeVisible();
  await expectNoAxeViolations(page, "mappings list");

  // Confirm: nothing is sent until the explicit confirm.
  await cola.getByRole("button", { name: t("erp.map.items.confirm.action") }).click();
  const confirmStep = page.getByRole("region", { name: t("erp.map.items.confirm.label") });
  await expect(confirmStep).toContainText(PRODUCT_1);
  expect(sent).toEqual([]);
  await confirmStep.getByRole("button", { name: t("erp.map.items.confirm.action") }).click();
  await expect(items.getByText(t("erp.map.items.notice.confirmed"))).toBeVisible();
  await expect(cola.getByText(t("erp.map.state.confirmed"))).toBeVisible();

  // Retire the water mapping, then suggest its replacement for the same product.
  const water = items.getByRole("row", { name: /ITEM-WATER-1L/ });
  await water.getByRole("button", { name: t("erp.map.items.retire.action") }).click();
  const retireStep = page.getByRole("region", { name: t("erp.map.items.retire.label") });
  await retireStep.getByRole("button", { name: t("erp.map.items.retire.action") }).click();
  await expect(items.getByRole("row", { name: /ITEM-WATER-1L/ })).toHaveCount(0);
  const suggestForm = page.getByRole("form", { name: t("erp.map.items.suggest.label") });
  await expect(suggestForm).toContainText(PRODUCT_2);
  await suggestForm.getByLabel(t("erp.map.items.suggest.ref")).fill("ITEM-WATER-1.5L");
  await suggestForm.getByRole("button", { name: t("erp.map.review") }).click();
  const suggestStep = page.getByRole("region", { name: t("erp.map.items.suggest.label") });
  await suggestStep.getByRole("button", { name: t("erp.map.items.suggest.action") }).click();
  await expect(items.getByText(t("erp.map.items.notice.suggested"))).toBeVisible();
  await expect(
    items.getByRole("row", { name: /ITEM-WATER-1\.5L/ }).getByText(t("erp.map.state.suggested")),
  ).toBeVisible();

  // Warehouses: set Zamalek (the only unmapped store), then retire Maadi.
  const whs = page.getByRole("region", { name: t("erp.map.wh.title") });
  const setForm = page.getByRole("form", { name: t("erp.map.wh.set.label") });
  await setForm.getByLabel(t("erp.map.wh.set.store")).selectOption(STORE_B);
  await setForm.getByLabel(t("erp.map.wh.set.ref")).fill("Zamalek Stores - NS");
  await setForm.getByRole("button", { name: t("erp.map.review") }).click();
  const setStep = page.getByRole("region", { name: t("erp.map.wh.set.label") });
  await expect(setStep).toContainText("Zamalek");
  await setStep.getByRole("button", { name: t("erp.map.wh.set.action") }).click();
  await expect(whs.getByText(t("erp.map.wh.notice.set"))).toBeVisible();
  await expect(whs.getByRole("row", { name: /Zamalek Stores - NS/ })).toBeVisible();
  await expect(whs.getByText(t("erp.map.wh.set.allMapped"))).toBeVisible();

  const maadi = whs.getByRole("row", { name: /Maadi Stores - NS/ });
  await maadi.getByRole("button", { name: t("erp.map.wh.retire.action") }).click();
  const whRetire = page.getByRole("region", { name: t("erp.map.wh.retire.label") });
  await whRetire.getByRole("button", { name: t("erp.map.wh.retire.action") }).click();
  await expect(whs.getByText(t("erp.map.wh.notice.retired"))).toBeVisible();
  await expect(whs.getByRole("row", { name: /Maadi Stores - NS/ })).toHaveCount(0);
  await expectNoAxeViolations(page, "mappings after changes");

  // Each mutation once, in order, with the version on screen; nothing else.
  expect(sent).toEqual([
    {
      method: "POST",
      url: "/api/v1/catalog/erpnext-item-mappings/i1/confirm",
      body: { version: 3 },
    },
    {
      method: "POST",
      url: "/api/v1/catalog/erpnext-item-mappings/i2/retire",
      body: { version: 5 },
    },
    {
      method: "POST",
      url: "/api/v1/catalog/erpnext-item-mappings",
      body: { tenant_product_id: PRODUCT_2, erpnext_item_ref: "ITEM-WATER-1.5L" },
    },
    {
      method: "POST",
      url: "/api/v1/catalog/erpnext-warehouse-mappings",
      body: { store_id: STORE_B, erpnext_warehouse_ref: "Zamalek Stores - NS" },
    },
    {
      method: "POST",
      url: "/api/v1/catalog/erpnext-warehouse-mappings/w1/retire",
      body: { version: 2 },
    },
  ]);
  for (const url of urls) {
    expect(url.startsWith(`${baseURL}/api/v1/`), url).toBe(true);
  }
});

test("M2: store_manager gets NoAccess on the direct URL and no mapping request", async ({
  page,
  t,
}) => {
  const { urls } = await mockBackend(page, "store_manager");
  await page.goto("/erp-connection/mappings");
  await expect(page.getByRole("heading", { name: t("auth.noAccess.title") })).toBeVisible();
  expect(urls.filter((u) => MAP_PATHS.test(u))).toEqual([]);
});
