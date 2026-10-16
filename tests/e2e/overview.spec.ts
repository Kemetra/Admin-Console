import { type Page, expect, test } from "./fixtures";

/**
 * RT-559 Overview (spec 009) on the built SPA, in both locales. AC-12: changing
 * the store re-reads every panel and no row from the old scope stays visible.
 * AC-13: the page renders in light, dark and forced-colors (captures attached)
 * and its controls are reachable by keyboard. Mocked Backend-Core (C-5).
 */

let activeStore: { id: string; name: string } | null = null;

function ctx() {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: activeStore,
    active_role_code: "owner",
    memberships: [
      {
        tenant_id: "t1",
        tenant_name: "Northstar Retail",
        role_code: "owner",
        store_access_kind: "all",
      },
    ],
  };
}

const stores = [
  { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true, timezone: "Africa/Cairo" },
  { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: true, timezone: "Africa/Cairo" },
];

function snapshot() {
  return {
    status: "fresh",
    erpnextWarehouseRef: "Stores - NSR",
    runId: "0190f000-0000-7000-8000-0000000000f1",
    readAt: "2026-10-15T07:58:12.000Z",
    recordedAt: "2026-10-15T08:00:03.000Z",
    staleAfterSeconds: 86400,
    reportedEntryCount: 42,
    pendingRequest: null,
  };
}

/** Each panel's answer depends on the store it was asked for. */
const ANSWERS = {
  unknown: { all: 5, s2: 1 },
  shift: { all: 2, s2: 0 },
  receivables: { all: 3, s2: 1 },
} as const;

type Panel = "stock" | "shift" | "unknown" | "receivables" | "audit";

async function mock(page: Page): Promise<Record<Panel, (string | null)[]>> {
  const seen: Record<Panel, (string | null)[]> = {
    stock: [],
    shift: [],
    unknown: [],
    receivables: [],
    audit: [],
  };
  const json = (body: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  const storeOf = (url: string) => new URL(url).searchParams.get("store_id");
  const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `row-${i}` }));

  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx())));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json(stores)));
  await page.route("**/api/v1/context/store", (r) => {
    if (r.request().method() === "DELETE") activeStore = null;
    else {
      const body = r.request().postDataJSON() as { store_id: string };
      const s = stores.find((x) => x.id === body.store_id);
      activeStore = s ? { id: s.id, name: s.name } : null;
    }
    return r.fulfill(json(ctx()));
  });
  await page.route("**/api/v1/catalog/erpnext-reconciliation/negative-on-hand/stores**", (r) => {
    seen.stock.push(activeStore?.id ?? null);
    return r.fulfill(
      json({
        items: [
          {
            storeId: "s1",
            storeName: "Cairo Festival City",
            snapshot: snapshot(),
            negativeItemCount: 7,
          },
          {
            storeId: "s2",
            storeName: "New Cairo Mall",
            snapshot: snapshot(),
            negativeItemCount: 4,
          },
        ],
        nextCursor: null,
      }),
    );
  });
  const counted =
    (panel: "shift" | "unknown" | "receivables", cursorField: string) =>
    (r: Parameters<Parameters<Page["route"]>[1]>[0]) => {
      const store = storeOf(r.request().url());
      seen[panel].push(store);
      const n = store === "s2" ? ANSWERS[panel].s2 : ANSWERS[panel].all;
      return r.fulfill(json({ items: items(n), [cursorField]: null }));
    };
  await page.route("**/api/v1/shift-closes**", counted("shift", "nextCursor"));
  await page.route("**/api/v1/catalog/unknown-items**", counted("unknown", "next_cursor"));
  await page.route("**/api/v1/settlement/receivables**", counted("receivables", "nextCursor"));
  await page.route("**/api/v1/audit/events**", (r) => {
    const store = storeOf(r.request().url());
    seen.audit.push(store);
    const actor = store === "s2" ? "Hana Fahmy" : "Omar Nabil";
    return r.fulfill(
      json({
        items: [
          {
            id: `0190f000-0000-7000-8000-0000000000${store === "s2" ? "e2" : "e1"}`,
            occurred_at: "2026-10-15T09:30:00Z",
            actor_label: actor,
            action: "shift.opened",
            metadata: {},
          },
        ],
        next_cursor: null,
      }),
    );
  });
  return seen;
}

test.beforeEach(() => {
  activeStore = null;
});

test("AC-12: changing the store re-reads every panel and drops the old scope's rows", async ({
  page,
  t,
}) => {
  const seen = await mock(page);
  const count = (noun: Parameters<typeof t>[0], n: number) =>
    t("overview.count.exact", { noun: t(noun), count: n });
  const stockLabel = (store: string) => t("overview.stock.label", { store });
  const ledger = page.getByRole("region", { name: t("overview.attention.title") });
  const activity = page.getByRole("region", { name: t("overview.activity.title") });

  await page.goto("/");
  await expect(ledger.getByText(stockLabel("Cairo Festival City"))).toBeVisible();
  await expect(ledger.getByText(stockLabel("New Cairo Mall"))).toBeVisible();
  await expect(ledger.getByText(count("overview.unknown.noun", 5))).toBeVisible();
  await expect(ledger.getByText(count("overview.shift.noun", 2))).toBeVisible();
  await expect(ledger.getByText(count("overview.receivables.noun", 3))).toBeVisible();
  await expect(activity.getByText("Omar Nabil")).toBeVisible();
  await expect(activity.getByText(t("overview.activity.action.shift"))).toBeVisible();
  await expect(activity.getByText("shift.opened")).toBeHidden();

  await page.getByRole("button", { name: /Northstar Retail/ }).click();
  await page.getByRole("menuitem", { name: "New Cairo Mall" }).click();

  await expect(ledger.getByText(stockLabel("New Cairo Mall"))).toBeVisible();
  await expect(ledger.getByText(count("overview.unknown.noun", 1))).toBeVisible();
  await expect(ledger.getByText(count("overview.receivables.noun", 1))).toBeVisible();
  await expect(activity.getByText("Hana Fahmy")).toBeVisible();
  // Nothing from the tenant-wide scope remains.
  await expect(ledger.getByText(stockLabel("Cairo Festival City"))).toBeHidden();
  await expect(ledger.getByText(count("overview.unknown.noun", 5))).toBeHidden();
  await expect(ledger.getByText(count("overview.shift.noun", 2))).toBeHidden();
  await expect(activity.getByText("Omar Nabil")).toBeHidden();
  for (const panel of ["shift", "unknown", "receivables", "audit"] as const) {
    expect(seen[panel], panel).toContain("s2");
  }
  expect(seen.stock).toContain("s2");

  // And back to the whole tenant.
  await page.getByRole("button", { name: /New Cairo Mall/ }).click();
  await page.getByRole("menuitem", { name: t("shell.scope.allStores") }).click();
  await expect(ledger.getByText(stockLabel("Cairo Festival City"))).toBeVisible();
  await expect(ledger.getByText(count("overview.unknown.noun", 5))).toBeVisible();
  await expect(activity.getByText("Hana Fahmy")).toBeHidden();
});

test("AC-13: light, dark and forced-colors render; every control is keyboard-reachable", async ({
  page,
  t,
  appLocale,
}, testInfo) => {
  await mock(page);
  await page.goto("/");
  const ledger = page.getByRole("region", { name: t("overview.attention.title") });
  await expect(
    ledger.getByText(t("overview.stock.label", { store: "New Cairo Mall" })),
  ).toBeVisible();

  const capture = async (name: string) => {
    const path = testInfo.outputPath(`overview-${appLocale}-${name}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(`overview-${appLocale}-${name}`, { path, contentType: "image/png" });
  };
  await capture("light");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await capture("dark");
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
  await page.emulateMedia({ forcedColors: "active" });
  await capture("forced-colors");
  await page.emulateMedia({ forcedColors: "none" });

  // Keyboard walk: Tab reaches the refresh control and every ledger link.
  const targets = [
    t("overview.refresh"),
    t("overview.stock.open"),
    t("overview.shift.open"),
    t("overview.unknown.open"),
    t("overview.activity.open"),
  ];
  const reached = new Set<string>();
  for (let i = 0; i < 60 && reached.size < targets.length; i++) {
    await page.keyboard.press("Tab");
    const name = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
    if (targets.includes(name)) reached.add(name);
  }
  expect([...reached].sort()).toEqual([...targets].sort());
});
