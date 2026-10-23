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

test("RT-823: Tab goes Show → export → currency → chart region → each bar → each table's region → the definitions; no row is a stop", async ({
  page,
  t,
}) => {
  await mockBase(page, CAIRO_STORE);
  await mockSummary(page, STORE_READ);
  await page.goto("/sales-daily?from=2026-10-16&to=2026-10-23");
  await expect(page.getByRole("table").first()).toBeVisible();
  await page.getByRole("button", { name: t("salesDaily.range.apply") }).focus();
  const stops: string[] = [];
  // Show, then the export button, the currency select, the chart region, 8 bars, 2 table regions, the definitions.
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (el?.closest(".daily-report__export")) return "export";
        if (el?.tagName === "SELECT") return "select";
        if (el?.closest("svg")) return "bar";
        const labelledBy = el?.getAttribute("aria-labelledby");
        if (labelledBy) return document.getElementById(labelledBy)?.textContent ?? "";
        return el?.textContent?.trim() ?? "<none>";
      }),
    );
  }
  expect(stops).toEqual([
    "export",
    "select",
    t("salesDaily.chart.title"),
    ...Array.from({ length: 8 }, () => "bar"),
    t("salesDaily.table.money.caption"),
    t("salesDaily.table.status.caption"),
    t("salesDaily.about"),
  ]);
  expect(await page.locator("tr[tabindex]:not([tabindex='-1'])").count()).toBe(0);
  await page.keyboard.press("Enter");
  await expect(page.getByText(t("metrics.erpPosting.unknown"))).toBeVisible();
});

test("RT-823: a bar by keyboard moves focus to its table row; the time axis follows the direction", async ({
  page,
}) => {
  await mockBase(page, CAIRO_STORE);
  await mockSummary(page, STORE_READ);
  await page.goto("/sales-daily?from=2026-10-16&to=2026-10-23");
  const figure = page.getByRole("figure");
  await expect(figure).toBeVisible();
  const bar = figure.locator('a[href="#sales-daily-day-2026-10-20"]');
  await bar.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#sales-daily-day-2026-10-20")).toBeFocused();
  const first = await figure.locator("a rect.daily-chart__hit").first().boundingBox();
  const last = await figure.locator("a rect.daily-chart__hit").last().boundingBox();
  const rtl = (await page.evaluate(() => document.documentElement.dir)) === "rtl";
  if (!first || !last) throw new Error("no chart bars");
  expect(rtl ? first.x > last.x : first.x < last.x).toBe(true);
});

test("RT-823: the chart does not move under reduced motion, and has no animation at all", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockBase(page, CAIRO_STORE);
  await mockSummary(page, STORE_READ);
  await page.goto("/sales-daily?from=2026-10-16&to=2026-10-23");
  const figure = page.getByRole("figure");
  await expect(figure).toBeVisible();
  const motion = await figure.evaluate((el) => {
    const durations = Array.from(el.querySelectorAll("*")).map((n) => {
      const s = getComputedStyle(n);
      return `${s.transitionDuration}|${s.animationName}`;
    });
    return {
      moving: durations.filter((d) => d !== "0s|none"),
      running: document.getAnimations().length,
    };
  });
  expect(motion).toEqual({ moving: [], running: 0 });
});

test("RT-823: the partial day's bar paints the hatch pattern, not a solid fill (light and forced colors)", async ({
  page,
}) => {
  await mockBase(page, CAIRO_STORE);
  await mockSummary(page, STORE_READ);
  await page.goto("/sales-daily?from=2026-10-16&to=2026-10-23");
  const figure = page.getByRole("figure");
  await expect(figure).toBeVisible();
  const fills = async () =>
    figure.evaluate((el) => ({
      partial: getComputedStyle(el.querySelector(".daily-chart__bar--so-far") as Element).fill,
      complete: getComputedStyle(
        el.querySelector(".daily-chart__bar:not(.daily-chart__bar--so-far)") as Element,
      ).fill,
    }));
  for (const forced of [false, true]) {
    if (forced) await page.emulateMedia({ forcedColors: "active" });
    const { partial, complete } = await fills();
    expect(partial, `partial, forced=${forced}`).toMatch(/^url\(/);
    expect(complete, `complete, forced=${forced}`).not.toMatch(/^url\(/);
  }
});

/**
 * RT-824 runtime check: a Blob download under the production CSP. The CSP is
 * `default-src 'self'; connect-src 'self'; object-src 'none'; ...` (Backend-
 * Core Caddyfile:46, RT-751 AC 2). That file is not in this repo, so the page
 * is served with those documented directives (plus what the pre-paint inline
 * script of index.html needs); the header the deployed console really gets is
 * not read here.
 */
const PROD_LIKE_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";

test("RT-824: the CSV downloads under a production-like CSP: a UTF-8 BOM, the exact figures, no CSP violation", async ({
  page,
  t,
}) => {
  await mockBase(page, CAIRO_STORE);
  await mockSummary(page, STORE_READ);
  await page.route("**/sales-daily?**", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": PROD_LIKE_CSP },
    });
  });
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  const navigation = await page.goto("/sales-daily?from=2026-10-16&to=2026-10-23");
  expect(navigation?.headers()["content-security-policy"]).toBe(PROD_LIKE_CSP);
  const button = page.getByRole("button", { name: t("salesDaily.export.button") });
  await expect(button).toBeVisible();
  const downloading = page.waitForEvent("download");
  await button.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("sales-daily_2026-10-16_2026-10-23.csv");
  const path = await download.path();
  const { readFileSync } = await import("node:fs");
  const bytes = readFileSync(path);
  expect(Array.from(bytes.subarray(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  const text = bytes.toString("utf8");
  expect(text).toContain("1250.5000");
  expect(text).toContain("completeness,received_only");
  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
  await expect(page.getByRole("figure")).toBeVisible();
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
    await expect(page.getByRole("figure")).toBeVisible();
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
