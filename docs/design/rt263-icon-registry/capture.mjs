// RT-696 (RT-263 IC-3) — before/after captures of the shell and nav for the
// owner's visual sign-off. Not part of the test suite: run it against a
// preview build (`pnpm build && pnpm preview --port 4173`) on each baseline.
//
//   node docs/design/rt263-icon-registry/capture.mjs <out-dir> <before|after>
//
// Mocked API only (C-5). Chromium comes from the preinstalled browser.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [outDir, phase] = process.argv.slice(2);
if (!outDir || !phase) throw new Error("usage: capture.mjs <out-dir> <before|after>");
mkdirSync(outDir, { recursive: true });

const BASE = "http://localhost:4173";

const admin = {
  user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh", is_platform_admin: true },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "platform_admin",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "platform_admin" }],
};
const noAccess = {
  user: { id: "u2", email: "new@northstar.eg", display_name: "New User", is_platform_admin: false },
  active_tenant: null,
  active_store: null,
  active_role_code: null,
  memberships: [],
};
const stores = [
  { id: "s1", code: "CFC", name: "Cairo Festival City", is_active: true, timezone: "UTC" },
  { id: "s2", code: "NCM", name: "New Cairo Mall", is_active: false, timezone: "UTC" },
];

const tenant = { id: "t1", name: "Northstar Retail", slug: "northstar", is_active: true };

async function mock(page, context) {
  const json = (body) => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(context)));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json(stores)));
  await page.route("**/api/v1/stores/s1", (r) => r.fulfill(json(stores[0])));
  await page.route("**/api/v1/tenants/t1", (r) => r.fulfill(json(tenant)));
  await page.route("**/api/v1/tenants/t1/members", (r) => r.fulfill(json([])));
}

function seedLocale(locale) {
  window.localStorage.setItem("rt.locale.v1:last", locale);
  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function (key) {
    const value = getItem.call(this, key);
    return value === null && key.startsWith("rt.locale.v1:user:") ? locale : value;
  };
}

/** Each scene: what to open, and what to frame. */
const SCENES = [
  { id: "shell-nav", ctx: admin, path: "/stores", ready: ".nav-entry" },
  {
    id: "scope-menu",
    ctx: admin,
    path: "/stores",
    ready: ".scope__caret",
    act: async (page) => {
      await page.locator("button[aria-haspopup='menu']").first().click();
      await page.locator(".scope-menu__check").waitFor();
    },
  },
  { id: "back-link", ctx: admin, path: "/tenants/t1", ready: ".back-arrow, .rt-icon[data-icon='back']" },
  {
    id: "drawer",
    ctx: admin,
    path: "/operators",
    ready: ".nav-entry",
    act: async (page) => {
      await page.locator(".page-head button, main button").filter({ hasText: /invite|دعوة/i }).first().click();
      await page.locator("dialog.drawer").waitFor();
    },
  },
  { id: "no-access", ctx: noAccess, path: "/", ready: ".noaccess" },
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
try {
  for (const locale of ["en", "ar"]) {
    for (const colors of ["light", "forced"]) {
      for (const scene of SCENES) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.emulateMedia({ forcedColors: colors === "forced" ? "active" : "none" });
        await page.addInitScript(seedLocale, locale);
        await mock(page, scene.ctx);
        await page.goto(BASE + scene.path);
        await page.locator(scene.ready).first().waitFor();
        if (scene.act) await scene.act(page);
        await page.waitForTimeout(300); // let transitions settle
        const file = join(outDir, `${scene.id}-${locale}-${colors}-${phase}.png`);
        await page.screenshot({ path: file });
        console.log(file);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
