import { type Page, expect, test } from "@playwright/test";

/**
 * RT-267 (UX-11) — outline-focus + forced-colors baseline. Keyboard-walks the
 * shell, a table surface (/stores) and a form (/tenants/new) in normal and
 * forced-colors modes and asserts every focus stop draws a real outline (not a
 * box-shadow, which forced-colors drops). Also checks the non-color cues for
 * "current" state: the active-nav marker and the active scope-menu item.
 * Mocked DP2 (C-5).
 */

const context = {
  user: {
    id: "u1",
    email: "amal@northstar.eg",
    display_name: "Amal Saleh",
    is_platform_admin: true,
  },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "platform_admin",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "platform_admin" }],
};

async function mockApi(page: Page): Promise<void> {
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(context) }),
  );
  await page.route("**/api/v1/stores", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true },
        { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: false },
      ]),
    }),
  );
}

interface FocusStop {
  label: string;
  outlineStyle: string;
  outlineWidth: number;
}

/** Tab through the page until focus wraps (or a cap), recording each stop's outline. */
async function walkFocus(page: Page, maxStops = 40): Promise<FocusStop[]> {
  const stops: FocusStop[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < maxStops; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const path: string[] = [];
      for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
        path.unshift(
          `${n.tagName}:${Array.prototype.indexOf.call(n.parentElement?.children ?? [], n)}`,
        );
      }
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
      return {
        key: path.join("/"),
        label: `${el.tagName.toLowerCase()}.${el.className} "${name}"`,
        outlineStyle: cs.outlineStyle,
        outlineWidth: Number.parseFloat(cs.outlineWidth),
      };
    });
    if (!stop || seen.has(stop.key)) break;
    seen.add(stop.key);
    stops.push({
      label: stop.label,
      outlineStyle: stop.outlineStyle,
      outlineWidth: stop.outlineWidth,
    });
  }
  return stops;
}

function expectVisibleOutlines(stops: FocusStop[]): void {
  expect(stops.length).toBeGreaterThan(3);
  const missing = stops.filter((s) => s.outlineStyle !== "solid" || s.outlineWidth < 2);
  expect(
    missing,
    `focus stops without a >=2px solid outline:\n${missing.map((s) => s.label).join("\n")}`,
  ).toEqual([]);
}

for (const forcedColors of ["none", "active"] as const) {
  test.describe(`forced-colors: ${forcedColors}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ forcedColors });
      await mockApi(page);
    });

    test("shell + store table: every keyboard focus stop shows an outline", async ({ page }) => {
      await page.goto("/stores");
      await expect(page.getByRole("cell", { name: "Cairo Festival City" })).toBeVisible();
      expectVisibleOutlines(await walkFocus(page));
    });

    test("tenant form: every keyboard focus stop shows an outline", async ({ page }) => {
      await page.goto("/tenants/new");
      await expect(page.getByLabel(/slug/i)).toBeVisible();
      expectVisibleOutlines(await walkFocus(page));
    });

    test("scope menu items show an outline and mark the active scope without color", async ({
      page,
    }) => {
      await page.goto("/stores");
      const scopeBtn = page.getByRole("button", { name: /Northstar Retail/ });
      await scopeBtn.focus();
      await page.keyboard.press("Enter");
      const allStores = page.getByRole("menuitem", { name: /all stores/i });
      await expect(allStores).toHaveAttribute("aria-current", "true");
      await page.keyboard.press("Tab");
      await expect(allStores).toBeFocused();
      const outline = await allStores.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { style: cs.outlineStyle, width: Number.parseFloat(cs.outlineWidth) };
      });
      expect(outline.style).toBe("solid");
      expect(outline.width).toBeGreaterThanOrEqual(2);
    });

    test("active nav entry keeps a visible marker distinct from its background", async ({
      page,
    }) => {
      await page.goto("/stores");
      const active = page.locator(".sidebar a[aria-current='page']");
      await expect(active).toHaveText(/Stores/);
      const { marker, background } = await active.evaluate((el) => ({
        marker: getComputedStyle(el, "::before").backgroundColor,
        background: getComputedStyle(el).backgroundColor,
      }));
      expect(marker).not.toBe("rgba(0, 0, 0, 0)");
      expect(marker).not.toBe(background);
    });

    test("keyboard-opened drawer: no ring on the panel, outline on its controls", async ({
      page,
    }) => {
      await page.route("**/api/v1/audit/events**", (r) =>
        r.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: [
              {
                id: "e1",
                occurred_at: "2026-06-01T21:14:03Z",
                action: "shift.forced_close",
                actor_label: "Omar Khaled",
                store_id: "s1",
                target_type: "shift",
                target_id: "sh-9",
                request_id: "11111111-1111-1111-1111-111111111111",
                metadata: {},
              },
            ],
            next_cursor: null,
          }),
        }),
      );
      await page.goto("/audit");
      await page.getByRole("button", { name: /apply/i }).click();
      await page.getByRole("button", { name: "shift.forced_close" }).focus();
      await page.keyboard.press("Enter");
      const drawer = page.getByRole("dialog");
      await expect(drawer).toBeFocused();
      // The panel is a programmatic initial-focus target (tabindex=-1), not a Tab
      // stop: a 2px ring around the whole pane would be noise, not a focus signal.
      expect(await drawer.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
      await page.keyboard.press("Tab");
      const close = drawer.getByRole("button", { name: "Close", exact: true });
      await expect(close).toBeFocused();
      expect(await close.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
    });
  });
}
