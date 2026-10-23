import {
  CAIRO,
  EGP_USD_DAY,
  NEW_YORK,
  scopeSummary,
  storeSummary,
} from "../unit/sales-daily-fixtures";
import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-821 (VIZ-3) the daily received-sales report against mocked Backend-Core:
 * reached from the Sales screen, one read per range, the partial day and the
 * range total in words, a keyboard walk that visits only real controls and the
 * two scroll regions (no row is a tab stop), and no WCAG 2.1 A/AA axe
 * violation in light, dark and forced colours. Runs once per locale (RT-399);
 * copy comes from the catalog (`t`).
 */

function ctx(activeStore: { id: string; name: string } | null) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: activeStore,
    active_role_code: "owner",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "owner" }],
  };
}

const stores = [
  {
    id: CAIRO,
    tenant_id: "t1",
    code: "CAI",
    name: "Cairo Festival",
    timezone: "Africa/Cairo",
    is_active: true,
  },
  {
    id: NEW_YORK,
    tenant_id: "t1",
    code: "NYC",
    name: "Fifth Avenue",
    timezone: "America/New_York",
    is_active: true,
  },
];

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

async function mockBase(page: Page, activeStore: { id: string; name: string } | null) {
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(activeStore))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json(stores)));
  await page.route("**/api/v1/sales?**", (r) => r.fulfill(json({ items: [], nextCursor: null })));
}

/** Records each summary query and answers it with `body`. */
async function mockSummary(page: Page, body: unknown): Promise<URLSearchParams[]> {
  const queries: URLSearchParams[] = [];
  await page.route("**/api/v1/sales-summary?**", (r) => {
    queries.push(new URL(r.request().url()).searchParams);
    return r.fulfill(json(body));
  });
  return queries;
}

const CAIRO_STORE = { id: CAIRO, name: "Cairo Festival" };
const STORE_READ = storeSummary(
  { ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" },
  undefined,
  { "2026-10-20": EGP_USD_DAY },
);

test("RT-821: Sales links to the report; the default range is read once for the scope's store", async ({
  page,
  t,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-23T09:00:00Z"));
  await mockBase(page, CAIRO_STORE);
  const queries = await mockSummary(page, STORE_READ);
  await page.goto("/sales");
  await page.getByRole("link", { name: t("salesDaily.entry") }).click();
  await expect(page).toHaveURL(/\/sales-daily$/);
  await expect(page.getByRole("heading", { level: 1, name: t("salesDaily.title") })).toBeVisible();
  const table = page.getByRole("table", { name: t("salesDaily.table.money.caption") });
  await expect(table.locator('tr[data-business-date="2026-10-23"]')).toContainText(
    t("metrics.context.soFar"),
  );
  await expect(table.locator("tfoot")).toContainText(t("salesDaily.row.totalSoFar"));
  expect(queries).toHaveLength(1);
  expect(Object.fromEntries(queries[0])).toEqual({
    from: "2026-10-16",
    to: "2026-10-23",
    store_id: CAIRO,
  });
  await page
    .getByRole("main")
    .getByRole("link", { name: t("salesDaily.back") })
    .click();
  await expect(page).toHaveURL(/\/sales$/);
});

test("RT-821: a whole scope with mixed zones names every zone and the calendar", async ({
  page,
  t,
}) => {
  await mockBase(page, null);
  await mockSummary(
    page,
    scopeSummary(
      [
        { ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-24" },
        { ref: NEW_YORK, timeZone: "America/New_York", currentBusinessDate: "2026-10-23" },
      ],
      { range: { from: "2026-10-17", to: "2026-10-24" } },
    ),
  );
  await page.goto("/sales-daily?from=2026-10-17&to=2026-10-24");
  const context = page.getByTestId("sales-daily-context");
  await expect(context).toContainText(t("metrics.context.allInScope", { count: 2 }));
  await expect(context).toContainText("Africa/Cairo");
  await expect(context).toContainText("America/New_York");
});

test("RT-821: a range over 31 days is refused at the To field and nothing is read", async ({
  page,
  t,
}) => {
  await mockBase(page, CAIRO_STORE);
  const queries = await mockSummary(page, STORE_READ);
  await page.goto("/sales-daily?from=2026-10-01&to=2026-11-01");
  await expect(page.getByLabel(t("sales.filter.to"))).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(t("sales.filter.spanTooWide"))).toBeVisible();
  expect(queries).toHaveLength(0);
});

test("RT-821: Tab goes Show → each table's scroll region → the definitions; no row is a stop", async ({
  page,
  t,
}) => {
  await mockBase(page, CAIRO_STORE);
  await mockSummary(page, STORE_READ);
  await page.goto("/sales-daily?from=2026-10-16&to=2026-10-23");
  await expect(page.getByRole("table").first()).toBeVisible();
  await page.getByRole("button", { name: t("salesDaily.range.apply") }).focus();
  const stops: string[] = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const labelledBy = el?.getAttribute("aria-labelledby");
        if (labelledBy) return document.getElementById(labelledBy)?.textContent ?? "";
        return el?.textContent?.trim() ?? "<none>";
      }),
    );
  }
  expect(stops).toEqual([
    t("salesDaily.table.money.caption"),
    t("salesDaily.table.status.caption"),
    t("salesDaily.about"),
  ]);
  expect(await page.locator("tr[tabindex]").count()).toBe(0);
  await page.keyboard.press("Enter");
  await expect(page.getByText(t("metrics.erpPosting.unknown"))).toBeVisible();
});

for (const mode of ["light", "dark", "forced"] as const) {
  test(`RT-821: no axe violations, definitions closed and open (${mode})`, async ({ page }) => {
    await mockBase(page, CAIRO_STORE);
    await mockSummary(page, STORE_READ);
    await page.goto("/sales-daily?from=2026-10-16&to=2026-10-23");
    await expect(page.getByRole("table").first()).toBeVisible();
    if (mode === "forced") await page.emulateMedia({ forcedColors: "active" });
    if (mode === "dark") {
      await page.evaluate(() => {
        document.documentElement.dataset.theme = "dark";
      });
    }
    await expectNoAxeViolations(page, `daily report, closed (${mode})`);
    await page.evaluate(() => {
      for (const d of document.querySelectorAll("details")) d.open = true;
    });
    await expectNoAxeViolations(page, `daily report, open (${mode})`);
    await page.screenshot({
      path: test.info().outputPath(`sales-daily-${mode}.png`),
      fullPage: true,
    });
  });
}

test.describe("compact width", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("RT-821: both tables scroll inside their own region; the page does not (RT-826 D4)", async ({
    page,
    t,
  }) => {
    await mockBase(page, CAIRO_STORE);
    await mockSummary(page, STORE_READ);
    await page.goto("/sales-daily?from=2026-10-16&to=2026-10-23");
    await expect(page.getByRole("table").first()).toBeVisible();
    for (const key of [
      "salesDaily.table.money.caption",
      "salesDaily.table.status.caption",
    ] as const) {
      const region = page.getByRole("region", { name: t(key) });
      const m = await region.evaluate((el) => {
        const content = document.querySelector(".content");
        return {
          regionScrolls: el.scrollWidth > el.clientWidth,
          page: document.documentElement.scrollWidth <= window.innerWidth,
          content: !!content && content.scrollWidth <= content.clientWidth,
        };
      });
      expect(m, key).toEqual({ regionScrolls: true, page: true, content: true });
    }
  });
});
