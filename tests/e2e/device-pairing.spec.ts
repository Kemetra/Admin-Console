import type { MessageKey, Params } from "../../src/i18n/translate";
import { DEVICE_1, DUBAI_STORE, NEW_YORK_STORE, SHIFT_OPEN, detail } from "../unit/device-fixtures";
import { impact, openShift, revoked } from "../unit/device-lifecycle-fixtures";
import { CODE_ID, SECRET_CODE, issued, pending } from "../unit/device-pairing-fixtures";
import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-372 part B E2E against mocked Backend-Core (C-5): replace, move and the
 * pairing codes (issue, list, cancel). The console renders the server's impact
 * preview and the code once; nothing about the code outlives the drawer.
 *   S1 replace allowed: the five binding fields, the impact, the code shown once with its TTL.
 *   S2 move: the store-scope refusal (non-disclosing 404) reads as unavailable.
 *   S3 blocked unresolved_cash_session: nothing to issue, no override.
 *   S4 replacement_already_pending: its own message, never retried.
 *   S5 pending codes: list, cancel with confirm, a used code.
 *   S6 after a security revoke, Replace is offered directly.
 * RT-399: runs in both locales; copy comes from the catalog (`t`).
 */

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
  {
    id: DUBAI_STORE,
    tenant_id: "t1",
    code: "DXB",
    name: "Dubai Mall",
    timezone: "Asia/Dubai",
    is_active: true,
  },
  {
    id: NEW_YORK_STORE,
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

interface Issues {
  bodies: unknown[];
  keys: (string | undefined)[];
}

async function mockDevice(page: Page, role = "owner", preview = impact()): Promise<Issues> {
  const issues: Issues = { bodies: [], keys: [] };
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json(stores)));
  await page.route(`**/api/v1/stores/${DUBAI_STORE}`, (r) => r.fulfill(json(stores[0])));
  await page.route(`**/api/v1/devices/${DEVICE_1}`, (r) => r.fulfill(json(detail())));
  await page.route(`**/api/v1/devices/${DEVICE_1}/impact?**`, (r) => r.fulfill(json(preview)));
  await page.route("**/api/v1/pairing-codes", (r) => {
    issues.bodies.push(r.request().postDataJSON());
    issues.keys.push(r.request().headers()["idempotency-key"]);
    return r.fulfill(json(issued(), 201));
  });
  return issues;
}

async function fillBinding(page: Page, t: (k: MessageKey, p?: Params) => string): Promise<void> {
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel(t("devices.issue.field.branchName")).fill("Dubai Mall");
  await drawer.getByLabel(t("devices.issue.field.branchAddress")).fill("Level 1");
  await drawer.getByLabel(t("devices.issue.field.taxRegistrationId")).fill("TRN-100");
  await drawer.getByLabel(t("devices.issue.field.printerVendorId", { bus: "USB" })).fill("0x04B8");
  await drawer.getByLabel(t("devices.issue.field.printerProductId", { bus: "USB" })).fill("0x0E15");
}

test("S1: replace: binding → the server's impact → the code, once, with its TTL", async ({
  page,
  t,
}) => {
  const issues = await mockDevice(
    page,
    "owner",
    impact({ action: "replace", revokeReason: "replaced" }),
  );
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.replace") }).click();
  const drawer = page.getByRole("dialog");

  // The five binding fields are required (decision C1).
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await expect(drawer.getByText(t("devices.text.required"))).toHaveCount(5);

  await fillBinding(page, t);
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await expect(drawer.getByText(t("devices.impact.verdict.allowed"))).toBeVisible();
  await drawer.getByRole("button", { name: t("devices.issue.confirm") }).click();

  await expect(drawer.getByText(SECRET_CODE)).toBeVisible();
  await expect(drawer.getByText(t("devices.issue.issued.once"))).toBeVisible();
  await expect(drawer.getByText(/REPLACEMENT_BLOCKED/)).toBeVisible();
  expect(issues.bodies).toEqual([
    {
      storeId: DUBAI_STORE,
      replacesDeviceId: DEVICE_1,
      branchName: "Dubai Mall",
      branchAddress: "Level 1",
      taxRegistrationId: "TRN-100",
      printerVendorId: "0x04B8",
      printerProductId: "0x0E15",
    },
  ]);
  expect(issues.keys[0]).toMatch(/^[\x21-\x7E]{16,128}$/);

  // Gone with the drawer: not on the page, not in storage, not in the URL.
  await drawer.getByRole("button", { name: t("devices.flow.done") }).click();
  await expect(page.getByText(SECRET_CODE)).toHaveCount(0);
  expect(page.url()).not.toContain(SECRET_CODE);
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(stored).not.toContain(SECRET_CODE);
});

test("S2: move: a store-scope refusal (404 on the issue) reads as unavailable", async ({
  page,
  t,
}) => {
  await mockDevice(page, "store_manager", impact({ action: "move", revokeReason: "moved" }));
  await page.route("**/api/v1/pairing-codes", (r) =>
    r.fulfill(
      json({ error: { code: "not_found", message: "Not found", request_id: "req-404" } }, 404),
    ),
  );
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.move") }).click();
  const drawer = page.getByRole("dialog");
  // Only another store is offered as the target.
  await expect(drawer.getByRole("option", { name: "Fifth Avenue" })).toBeAttached();
  await expect(drawer.getByRole("option", { name: "Dubai Mall" })).toHaveCount(0);
  await drawer.getByLabel(t("devices.issue.field.targetStore")).selectOption(NEW_YORK_STORE);
  await fillBinding(page, t);
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await drawer.getByRole("button", { name: t("devices.issue.confirm") }).click();
  await expect(drawer.getByText(t("devices.issue.error.notFound"))).toBeVisible();
  await expect(drawer.getByText("req-404")).toBeVisible();
  await expect(drawer.getByText(SECRET_CODE)).toHaveCount(0);
});

test("S3: a blocked replace explains what to do and issues nothing", async ({ page, t }) => {
  const issues = await mockDevice(
    page,
    "owner",
    impact({
      action: "replace",
      revokeReason: "replaced",
      verdict: "blocked",
      blockCode: "unresolved_cash_session",
      openShift: openShift(),
    }),
  );
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.replace") }).click();
  await fillBinding(page, t);
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await expect(drawer.getByText(t("devices.impact.blocked.cashSession"))).toBeVisible();
  await expect(drawer.getByRole("button", { name: t("devices.issue.confirm") })).toHaveCount(0);
  expect(issues.bodies).toEqual([]);
});

test("S4: a replacement already pending has its own message and is never retried", async ({
  page,
  t,
}) => {
  const issues = await mockDevice(
    page,
    "owner",
    impact({ action: "replace", revokeReason: "replaced" }),
  );
  await page.route("**/api/v1/pairing-codes", (r) => {
    issues.bodies.push(r.request().postDataJSON());
    return r.fulfill(
      json({ error: { code: "replacement_already_pending", message: "x", request_id: "r" } }, 409),
    );
  });
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.replace") }).click();
  await fillBinding(page, t);
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await drawer.getByRole("button", { name: t("devices.issue.confirm") }).click();
  await expect(drawer.getByText(t("devices.issue.error.alreadyPending"))).toBeVisible();
  await expect(drawer.getByRole("link", { name: t("devices.issue.viewCodes") })).toBeVisible();
  expect(issues.bodies).toHaveLength(1);
});

test("S5: pending codes: list, cancel after a confirm, and a used code", async ({ page, t }) => {
  await mockDevice(page);
  let live = [
    pending(),
    pending({
      pairingCodeId: "c2",
      kind: "pair",
      terminalLabel: "Counter 4",
      replacesDeviceId: null,
    }),
  ];
  const cancelled: string[] = [];
  await page.route("**/api/v1/devices?**", (r) => r.fulfill(json({ items: [], nextCursor: null })));
  await page.route("**/api/v1/pairing-codes?**", (r) =>
    r.fulfill(json({ items: live, nextCursor: null })),
  );
  await page.route("**/api/v1/pairing-codes/*/cancel", (r) => {
    const id = r.request().url().split("/").at(-2) as string;
    if (id === "c2") {
      return r.fulfill(
        json(
          { error: { code: "pairing_code_used", message: "used", request_id: "req-used" } },
          409,
        ),
      );
    }
    cancelled.push(id);
    live = live.filter((c) => c.pairingCodeId !== id);
    return r.fulfill(
      json({ outcome: "cancelled", pairingCode: { ...pending(), status: "cancelled" } }),
    );
  });

  await page.goto("/devices");
  await page.getByRole("link", { name: t("devices.list.pairingCodes") }).click();
  await expect(page).toHaveURL(/\/devices\/pairing-codes$/);
  const rows = page.getByRole("row").filter({ hasText: /Counter/ });
  await expect(rows).toHaveCount(2);
  await expect(page.getByText(SECRET_CODE)).toHaveCount(0);

  // A used code can't be cancelled.
  await rows
    .nth(1)
    .getByRole("button", { name: t("devices.codes.cancel") })
    .click();
  await page
    .getByRole("group", { name: t("devices.codes.cancel") })
    .getByRole("button", { name: t("devices.codes.cancel") })
    .click();
  await expect(page.getByText(t("devices.codes.error.used"))).toBeVisible();

  // Cancel asks first, then cancels exactly that code.
  await rows
    .nth(0)
    .getByRole("button", { name: t("devices.codes.cancel") })
    .click();
  await expect(page.getByRole("group", { name: t("devices.codes.cancel") })).toBeVisible();
  expect(cancelled).toEqual([]);
  await page
    .getByRole("group", { name: t("devices.codes.cancel") })
    .getByRole("button", { name: t("devices.codes.cancel") })
    .click();
  await expect(page.getByText(t("devices.codes.cancelled"))).toBeVisible();
  expect(cancelled).toEqual([CODE_ID]);
  await expect(page.getByRole("row").filter({ hasText: /Counter 2/ })).toHaveCount(0);
});

test("S6: after a security revoke Replace is offered directly", async ({ page, t }) => {
  await mockDevice(
    page,
    "owner",
    impact({
      verdict: "allowed_with_custody_exception",
      revokeReason: "stolen",
      openShift: openShift(),
    }),
  );
  await page.route(`**/api/v1/devices/${DEVICE_1}/revoke`, (r) =>
    r.fulfill(json(revoked({ revokeReason: "stolen", custodyExceptionShiftId: SHIFT_OPEN }).data)),
  );
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.revoke") }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("radio", { name: t("devices.reason.stolen") }).check();
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await drawer.getByRole("button", { name: t("devices.revoke.confirm") }).click();
  await expect(drawer.getByText(t("devices.revoke.nextStep"))).toBeVisible();
  await drawer.getByRole("button", { name: t("devices.revoke.offerReplace") }).click();
  await expect(page.getByRole("dialog", { name: t("devices.issue.title.replace") })).toBeVisible();
});

test("S7: axe finds no violations on the replace form, the shown-once code and the pending codes", async ({
  page,
  t,
}) => {
  // The drawer's entrance fades in; contrast is measured on the settled page.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockDevice(page, "owner", impact({ action: "replace", revokeReason: "replaced" }));
  await page.route("**/api/v1/devices?**", (r) => r.fulfill(json({ items: [], nextCursor: null })));
  await page.route("**/api/v1/pairing-codes?**", (r) =>
    r.fulfill(json({ items: [pending()], nextCursor: null })),
  );
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.replace") }).click();
  const drawer = page.getByRole("dialog");
  await expectNoAxeViolations(page, "replace form");
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await expect(drawer.getByText(t("devices.text.required")).first()).toBeVisible();
  await expectNoAxeViolations(page, "replace form with errors");
  await fillBinding(page, t);
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await drawer.getByRole("button", { name: t("devices.issue.confirm") }).click();
  await expect(drawer.getByText(SECRET_CODE)).toBeVisible();
  await expectNoAxeViolations(page, "issued code");

  await page.goto("/devices/pairing-codes");
  await expect(page.getByText("Counter 2")).toBeVisible();
  await expectNoAxeViolations(page, "pending codes");
  await page
    .getByRole("button", { name: t("devices.codes.cancel") })
    .first()
    .click();
  await expectNoAxeViolations(page, "cancel confirm");
});
