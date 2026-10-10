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
  /** Selector of an overflow-clipping ancestor that cuts the ring off, if any. */
  clippedBy: string | null;
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ClipBox extends Box {
  name: string;
}

interface FocusedOutline {
  label: string;
  outlineStyle: string;
  outlineWidth: number;
  /** The painted ring: border box grown by outline offset + width. */
  ring: Box;
}

/** Marks each visited stop so the walk ends when Tab wraps back to one. */
const VISITED_ATTR = "data-focus-walk";

/**
 * Browser-side. Reads the focused element's outline and painted ring box, or
 * null once focus leaves the page or returns to an already-visited stop.
 * Serialized by Playwright, so it must not reference module scope.
 */
function readFocusedOutline(el: Element, attr: string): FocusedOutline | null {
  if (el === document.body || el.hasAttribute(attr)) return null;
  el.setAttribute(attr, "");
  const cs = getComputedStyle(el);
  const outlineWidth = Number.parseFloat(cs.outlineWidth);
  const grow = Number.parseFloat(cs.outlineOffset) + outlineWidth;
  const r = el.getBoundingClientRect();
  const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40);
  return {
    label: `${el.tagName.toLowerCase()}.${el.className} "${name}"`,
    outlineStyle: cs.outlineStyle,
    outlineWidth,
    ring: {
      left: r.left - grow,
      top: r.top - grow,
      right: r.right + grow,
      bottom: r.bottom + grow,
    },
  };
}

/**
 * Browser-side. The padding box of every ancestor whose overflow is not
 * `visible`: computed style alone can't see such an ancestor clipping the ring.
 */
function readClipBoxes(el: Element): ClipBox[] {
  const boxes: ClipBox[] = [];
  for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const acs = getComputedStyle(a);
    if (`${acs.overflowX}/${acs.overflowY}` === "visible/visible") continue;
    const ar = a.getBoundingClientRect();
    const left = ar.left + a.clientLeft;
    const top = ar.top + a.clientTop;
    boxes.push({
      name: `${a.tagName.toLowerCase()}.${a.className}`,
      left,
      top,
      right: left + a.clientWidth,
      bottom: top + a.clientHeight,
    });
  }
  return boxes;
}

/** Whether `inner` fits inside `outer`, with sub-pixel tolerance. */
function fitsInside(inner: Box, outer: Box, tol = 0.5): boolean {
  const fitsX = inner.left >= outer.left - tol && inner.right <= outer.right + tol;
  const fitsY = inner.top >= outer.top - tol && inner.bottom <= outer.bottom + tol;
  return fitsX && fitsY;
}

/** Press Tab and describe the stop it lands on; null ends the walk. */
async function nextFocusStop(page: Page): Promise<FocusStop | null> {
  await page.keyboard.press("Tab");
  const handle = await page.evaluateHandle(() => document.activeElement);
  const el = handle.asElement();
  const outline = el ? await el.evaluate(readFocusedOutline, VISITED_ATTR) : null;
  const clipBoxes = el && outline ? await el.evaluate(readClipBoxes) : [];
  await handle.dispose();
  if (!outline) return null;
  const clipper = clipBoxes.find((box) => !fitsInside(outline.ring, box));
  return {
    label: outline.label,
    outlineStyle: outline.outlineStyle,
    outlineWidth: outline.outlineWidth,
    clippedBy: clipper?.name ?? null,
  };
}

/**
 * Tab through the page until focus wraps (or a cap), recording each stop's
 * outline and whether an overflow ancestor clips its painted ring.
 */
async function walkFocus(page: Page, maxStops = 40): Promise<FocusStop[]> {
  const stops: FocusStop[] = [];
  for (let i = 0; i < maxStops; i++) {
    const stop = await nextFocusStop(page);
    if (!stop) break;
    stops.push(stop);
  }
  await page.evaluate((attr) => {
    for (const el of document.querySelectorAll(`[${attr}]`)) el.removeAttribute(attr);
  }, VISITED_ATTR);
  return stops;
}

function expectVisibleOutlines(stops: FocusStop[], minStops = 4): void {
  expect(stops.length).toBeGreaterThanOrEqual(minStops);
  const missing = stops.filter((s) => s.outlineStyle !== "solid" || s.outlineWidth < 2);
  expect(
    missing,
    `focus stops without a >=2px solid outline:\n${missing.map((s) => s.label).join("\n")}`,
  ).toEqual([]);
  const clipped = stops.filter((s) => s.clippedBy);
  expect(
    clipped,
    `focus rings clipped by an overflow ancestor:\n${clipped
      .map((s) => `${s.label} <- ${s.clippedBy}`)
      .join("\n")}`,
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

    test("scope gate: tenant picks show an unclipped outline", async ({ page }) => {
      await page.route("**/api/v1/context/me", (r) =>
        r.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...context,
            active_tenant: null,
            active_role_code: null,
            memberships: [
              { tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" },
              { tenant_id: "t2", tenant_name: "Helios Markets", role_code: "tenant_admin" },
            ],
          }),
        }),
      );
      await page.goto("/");
      await expect(page.getByText("Helios Markets")).toBeVisible();
      expectVisibleOutlines(await walkFocus(page), 2); // one pick per membership
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
      // Guard the opt-out itself: the panel DOES match :focus-visible here.
      expect(await drawer.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
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
