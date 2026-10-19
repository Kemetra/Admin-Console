import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-728 inventory read views E2E against mocked Backend-Core (C-5).
 * S1 (happy path): owner → "Stock movements" → the store → its locations and
 * whole-store ledger (`scope=all`, Load more follows the cursor) → a movement's
 * product → its derived on-hand and tracking identities. Every request is a
 * GET to a Backend-Core route on the app's own origin; nothing is written.
 * S2: store_manager reaches on-hand but never requests tracking identities.
 * RT-399: runs in both locales; copy comes from the catalog (`t`).
 */
const CAIRO = "0190f000-0000-7000-8000-0000000007a1";
const PRODUCT = "0190f000-0000-7000-8000-0000000007c1";
const LOCATION = "0190f000-0000-7000-8000-0000000007d1";
const INV = "/api/inventory/v1";

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
  id: CAIRO,
  tenant_id: "t1",
  code: "CAI",
  name: "Cairo Festival",
  timezone: "Africa/Cairo",
  is_active: true,
};

function movement(id: string, quantity: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    storeId: CAIRO,
    movementType: "inbound",
    quantity,
    stockingUnit: "kg",
    tenantProductRef: PRODUCT,
    reason: null,
    occurredAt: "2026-10-18T09:00:00Z",
    receivedAt: "2026-10-18T09:00:01Z",
    createdBy: "0190f000-0000-7000-8000-000000000a01",
    origin: "retail",
    integrationState: "confirmed",
    erpConfirmedAt: "2026-10-18T09:05:00Z",
    stockLocationId: LOCATION,
    inventoryStatus: "sellable",
    positionInterpreted: false,
    trackingIdentityId: null,
    ...overrides,
  };
}

const firstPage = {
  items: [movement("0190f000-0000-7000-8000-000000000f01", "12.0000")],
  nextCursor: "cursor-2",
};
const secondPage = {
  items: [
    movement("0190f000-0000-7000-8000-000000000f02", "-3.0000", {
      movementType: "adjustment",
      tenantProductRef: null,
      reason: "damaged pack",
      integrationState: null,
    }),
  ],
  nextCursor: null,
};

const locations = {
  items: [
    {
      id: LOCATION,
      storeId: CAIRO,
      code: "MAIN",
      name: "Main floor",
      kind: "primary",
      isActive: true,
    },
  ],
};

const onHand = {
  storeId: CAIRO,
  productId: PRODUCT,
  quantity: "12.0000",
  stockingUnit: "kg",
  negativeBalance: false,
  sellableQuantity: "12.0000",
  statusQuantities: [{ inventoryStatus: "sellable", quantity: "12.0000" }],
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

interface Seen {
  movementQueries: URLSearchParams[];
  tracking: number;
  methods: string[];
}

async function mockBase(page: Page, role: string): Promise<Seen> {
  const seen: Seen = { movementQueries: [], tracking: 0, methods: [] };
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json([store])));
  await page.route(`**${INV}/**`, (r) => {
    seen.methods.push(r.request().method());
    return r.fulfill(json({ error: { code: "not_found", message: "Not found." } }, 404));
  });
  await page.route(`**${INV}/stores/${CAIRO}/movements**`, (r) => {
    seen.methods.push(r.request().method());
    const query = new URL(r.request().url()).searchParams;
    seen.movementQueries.push(query);
    return r.fulfill(json(query.get("cursor") === "cursor-2" ? secondPage : firstPage));
  });
  await page.route(`**${INV}/stores/${CAIRO}/locations`, (r) => {
    seen.methods.push(r.request().method());
    return r.fulfill(json(locations));
  });
  await page.route(`**${INV}/on-hand/${CAIRO}/${PRODUCT}`, (r) => {
    seen.methods.push(r.request().method());
    return r.fulfill(json(onHand));
  });
  await page.route(`**${INV}/products/${PRODUCT}/tracking-identities**`, (r) => {
    seen.methods.push(r.request().method());
    seen.tracking += 1;
    return r.fulfill(json({ items: [], nextCursor: null }));
  });
  return seen;
}

test("S1: owner → store ledger → product on-hand, read-only", async ({ page: p, t }) => {
  const seen = await mockBase(p, "owner");
  await p.goto("/");
  await p.waitForLoadState("networkidle");
  const requested: URL[] = [];
  p.on("request", (r) => requested.push(new URL(r.url())));

  await p.getByRole("link", { name: t("inventory.nav.label") }).click();
  await expect(p.getByRole("heading", { level: 1, name: t("inventory.title") })).toBeVisible();
  await p.getByRole("link", { name: "Cairo Festival" }).click();

  await expect(p.getByRole("heading", { level: 1, name: "Cairo Festival" })).toBeVisible();
  const locs = p.getByRole("table", { name: t("inventory.locations.caption") });
  await expect(locs).toContainText("Main floor");
  await expect(locs).toContainText(t("inventory.locations.kind.primary"));
  const ledger = p.getByRole("table", { name: t("inventory.movements.caption") });
  await expect(ledger.getByTestId("movement-quantity")).toHaveText(["12.0000 kg"]);
  await expect(ledger).toContainText(t("inventory.integration.confirmed"));
  await expectNoAxeViolations(p, "inventory store ledger");

  await p.getByRole("button", { name: t("inventory.movements.loadMore") }).click();
  await expect(ledger.getByTestId("movement-quantity")).toHaveText(["12.0000 kg", "-3.0000 kg"]);
  await expect(ledger).toContainText(t("inventory.movements.adhoc"));
  await expect(ledger).toContainText("damaged pack");
  await expect(p.getByRole("button", { name: t("inventory.movements.loadMore") })).toHaveCount(0);
  expect(seen.movementQueries.map((q) => q.get("scope"))).toEqual(["all", "all"]);
  expect(seen.movementQueries.map((q) => q.get("cursor"))).toEqual([null, "cursor-2"]);
  expect(seen.movementQueries.every((q) => !q.has("productId"))).toBe(true);

  await ledger
    .getByRole("link", { name: t("inventory.movements.openProduct", { ref: PRODUCT }) })
    .click();
  await expect(p).toHaveURL(new RegExp(`/inventory/stores/${CAIRO}/products/${PRODUCT}$`));
  await expect(p.getByTestId("on-hand-quantity")).toHaveText("12.0000 kg");
  await expect(p.getByText(t("inventory.tracking.empty"))).toBeVisible();
  await expectNoAxeViolations(p, "inventory product on-hand");
  expect(seen.tracking).toBe(1);

  // Reads only, all on the app's own origin: no write, no ERPNext / Frappe call.
  expect(seen.methods.every((m) => m === "GET")).toBe(true);
  const origin = new URL(p.url()).origin;
  expect(requested.filter((url) => url.origin !== origin)).toEqual([]);
  const api = [
    ...new Set(requested.filter((u) => u.pathname.startsWith("/api/")).map((u) => u.pathname)),
  ];
  for (const path of api) {
    expect(path).toMatch(
      /^\/api\/(v1\/(stores|context)|inventory\/v1\/(stores|on-hand|products))(\/|$)/,
    );
  }
});

test("S2: store_manager sees on-hand but never requests tracking identities", async ({
  page: p,
  t,
}) => {
  const seen = await mockBase(p, "store_manager");
  await p.goto(`/inventory/stores/${CAIRO}/products/${PRODUCT}`);
  await expect(p.getByTestId("on-hand-quantity")).toHaveText("12.0000 kg");
  await expect(p.getByRole("heading", { name: t("inventory.tracking.title") })).toHaveCount(0);
  expect(seen.tracking).toBe(0);
});
