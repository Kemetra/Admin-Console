import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-826 (RT-785 slice 2, D4: no card layout). At 360px a wide list table
 * scrolls inside its own focusable region; neither the page nor `.content`
 * scrolls sideways. Checked on the stores roster and on the sales results
 * (the widest table), in both locales, with realistic data.
 */
const CAIRO = "0190f000-0000-7000-8000-0000000005a1";

const ctx = {
  user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "owner",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "owner" }],
};

function json(body: unknown) {
  return { status: 200, contentType: "application/json", body: JSON.stringify(body) };
}

const stores = [
  { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true, timezone: "Africa/Cairo" },
  { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: false, timezone: "Africa/Cairo" },
  {
    id: "s3",
    code: "ALX",
    name: "Alexandria City Centre",
    is_active: true,
    timezone: "Africa/Cairo",
  },
];

const sales = Array.from({ length: 8 }, (_, i) => ({
  saleRef: `0190f000-0000-7000-8000-00000000060${i}`,
  storeRef: CAIRO,
  saleNumber: `R-00${40 + i}`,
  businessDate: "2026-10-07",
  occurredAt: "2026-10-07T10:30:00Z",
  receivedAt: "2026-10-07T10:30:04Z",
  device: { deviceRef: null, label: "Till 1", labelSource: "snapshot" },
  operator: { userRef: null, displayName: "Mona Adel", nameSource: "snapshot" },
  currencyCode: "EGP",
  posTotal: "1234.5000",
  syncStatus: "synced",
  voided: i % 3 === 0,
  returnState: "partial",
  erpPostingState: "unknown",
}));

async function mock(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx)));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json(stores)));
  await page.route("**/api/v1/sales?**", (r) =>
    r.fulfill(
      json({
        items: sales,
        nextCursor: null,
        asOf: "2026-10-08T09:15:00Z",
        storeRef: CAIRO,
        storeTimezone: "Africa/Cairo",
        from: "2026-10-01",
        to: "2026-10-07",
      }),
    ),
  );
}

async function expectContainedScroll(page: Page, caption: string, label: string): Promise<void> {
  const region = page.getByRole("region", { name: caption });
  await expect(region, label).toBeVisible();
  // The top bar (RT-825) is out of this slice: until its compact layout lands it
  // alone overflows 360px, so the page-level check runs with it taken out.
  await page.addStyleTag({ content: ".topbar { display: none !important; }" });
  const m = await region.evaluate((el) => {
    const content = document.querySelector(".content");
    return {
      regionScrolls: el.scrollWidth > el.clientWidth,
      page: document.documentElement.scrollWidth <= window.innerWidth,
      content:
        !!content &&
        content.scrollWidth <= content.clientWidth &&
        content.getBoundingClientRect().right <= window.innerWidth,
      focusable: el.getAttribute("tabindex") === "0",
    };
  });
  expect(m, label).toEqual({ regionScrolls: true, page: true, content: true, focusable: true });
  await region.focus();
  await expect(region, label).toBeFocused();
  await expectNoAxeViolations(page, label);
}

test.use({ viewport: { width: 360, height: 740 } });

test("stores table scrolls inside its region at 360px", async ({ page, t }) => {
  await mock(page);
  await page.goto("/stores");
  await expect(page.getByRole("row").filter({ hasText: "Cairo Festival City" })).toBeVisible();
  await expectContainedScroll(page, t("stores.list.caption"), "stores 360px");
});

test("sales table scrolls inside its region at 360px", async ({ page, t }) => {
  await mock(page);
  await page.goto(`/sales?store=${CAIRO}&from=2026-10-01&to=2026-10-07`);
  await expect(page.getByRole("row").filter({ hasText: "R-0040" })).toBeVisible();
  await expectContainedScroll(page, t("sales.list.caption"), "sales 360px");
});

test("content gutter is 16px at <=600px and unchanged on desktop", async ({ page }) => {
  await mock(page);
  await page.goto("/stores");
  const pad = () =>
    page.locator(".content").evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.paddingLeft, s.paddingRight];
    });
  expect(await pad()).toEqual(["16px", "16px"]);
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await pad()).toEqual(["32px", "32px"]);
});
