import type { MessageKey } from "../../src/i18n/translate";
import type { RevokeReason } from "../../src/lib/device-queries";
import { DEVICE_1, DEVICE_2, DUBAI_STORE, SHIFT_OPEN, detail } from "../unit/device-fixtures";
import { conflict, impact, openShift, retired, revoked } from "../unit/device-lifecycle-fixtures";
import { expectNoAxeViolations } from "./axe";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-372 device lifecycle (revoke and retire) E2E against mocked Backend-Core
 * (C-5). The console renders the server's impact preview and never computes a
 * consequence:
 *   S1 allowed: reason → impact → confirm → revoked.
 *   S2 blocked (409 unresolved_cash_session): why and what to do, no override.
 *   S3 allowed_with_custody_exception, the recovery path: the server's `requires`
 *      asks for the note and the acknowledgement; both are sent.
 *   S4 forbidden_recovery for a store manager: an owner or tenant admin must do it.
 *   S5 store-scope refusal (non-disclosing 404) reads as unavailable.
 *   S6 retire: allowed with a required reason, and blocked by a custody exception.
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

const store = {
  id: DUBAI_STORE,
  tenant_id: "t1",
  code: "DXB",
  name: "Dubai Mall",
  timezone: "Asia/Dubai",
  is_active: true,
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

const NOT_FOUND = { error: { code: "not_found", message: "Not found", request_id: "req-404" } };

interface Calls {
  impact: URLSearchParams[];
  revoke: unknown[];
  retire: unknown[];
}

async function mockDevice(
  page: Page,
  role: string,
  device: Record<string, unknown>,
): Promise<Calls> {
  const calls: Calls = { impact: [], revoke: [], retire: [] };
  const id = String(device.deviceId);
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json([store])));
  await page.route(`**/api/v1/stores/${DUBAI_STORE}`, (r) => r.fulfill(json(store)));
  await page.route(`**/api/v1/devices/${id}`, (r) => r.fulfill(json(device)));
  await page.route("**/api/v1/pairing-codes?**", (r) =>
    r.fulfill(json({ items: [], nextCursor: null })),
  );
  await page.route(`**/api/v1/devices/${id}/impact?**`, (r) => {
    calls.impact.push(new URL(r.request().url()).searchParams);
    return r.fulfill(json(impact({ deviceId: id })));
  });
  return calls;
}

async function route(
  page: Page,
  pattern: string,
  handler: (body: unknown) => unknown,
  status = 200,
) {
  await page.route(pattern, async (r) => {
    const body = r.request().postDataJSON?.() ?? null;
    return r.fulfill(json(await handler(body), status));
  });
}

type Translate = (key: MessageKey) => string;

/** Open Revoke on Till 1 as `role`, pick `reason`, and ask the server for the impact it is given. */
async function reviewRevoke(
  page: Page,
  t: Translate,
  {
    role,
    reason,
    preview,
  }: { role: string; reason: RevokeReason; preview: Record<string, unknown> },
) {
  const calls = await mockDevice(page, role, detail());
  await page.route(`**/api/v1/devices/${DEVICE_1}/impact?**`, (r) => r.fulfill(json(preview)));
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.revoke") }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("radio", { name: t(`devices.reason.${reason}`) }).check();
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  return { calls, drawer };
}

test("S1: owner revokes a device: reason → the server's impact → confirm", async ({ page, t }) => {
  const calls = await mockDevice(page, "owner", detail());
  await route(page, `**/api/v1/devices/${DEVICE_1}/revoke`, (body) => {
    calls.revoke.push(body);
    return revoked().data;
  });

  await page.goto(`/devices/${DEVICE_1}`);
  await expect(page.getByRole("heading", { level: 1, name: "Till 1" })).toBeVisible();
  await expect(page.getByRole("button", { name: /deactivate/i })).toHaveCount(0);

  await page.getByRole("button", { name: t("devices.actions.revoke") }).click();
  const drawer = page.getByRole("dialog");
  // The security class is its own group, with the real-event warning.
  const security = drawer.getByRole("group", { name: t("devices.revoke.group.security") });
  await expect(security.getByText(t("devices.revoke.group.securityHelp"))).toBeVisible();
  await drawer.getByRole("radio", { name: t("devices.reason.lost") }).check();
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();

  await expect(drawer.getByText(t("devices.impact.verdict.allowed"))).toBeVisible();
  expect(calls.impact.at(-1)?.get("action")).toBe("revoke");
  expect(calls.impact.at(-1)?.get("reason")).toBe("lost");

  await drawer.getByRole("button", { name: t("devices.revoke.confirm") }).click();
  await expect(drawer.getByText(t("devices.revoke.done"))).toBeVisible();
  expect(calls.revoke).toEqual([{ reason: "lost" }]);
});

test("S2: a blocked verdict says what to do and offers no override", async ({ page, t }) => {
  const { calls, drawer } = await reviewRevoke(page, t, {
    role: "owner",
    reason: "admin_error",
    preview: impact({
      revokeReason: "admin_error",
      verdict: "blocked",
      blockCode: "unresolved_cash_session",
      openShift: openShift(),
    }),
  });
  await expect(drawer.getByText(t("devices.impact.blocked.cashSession"))).toBeVisible();
  await expect(drawer.getByRole("button", { name: t("devices.revoke.confirm") })).toHaveCount(0);
  expect(calls.revoke).toEqual([]);
});

test("S2b: a 409 from the revoke itself carries a fresh preview that replaces the old one", async ({
  page,
  t,
}) => {
  await mockDevice(page, "owner", detail());
  await route(
    page,
    `**/api/v1/devices/${DEVICE_1}/revoke`,
    () =>
      conflict(
        "unresolved_cash_session",
        impact({
          revokeReason: "lost",
          verdict: "blocked",
          blockCode: "unresolved_cash_session",
          openShift: openShift(),
        }),
      ).error,
    409,
  );
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.revoke") }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("radio", { name: t("devices.reason.lost") }).check();
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await drawer.getByRole("button", { name: t("devices.revoke.confirm") }).click();
  await expect(drawer.getByText(t("devices.flow.error.changed"))).toBeVisible();
  await expect(drawer.getByText(t("devices.impact.blocked.cashSession"))).toBeVisible();
  await expect(drawer.getByRole("button", { name: t("devices.revoke.confirm") })).toHaveCount(0);
});

test("S3: recovery revoke (allowed_with_custody_exception): note and acknowledgement from `requires`", async ({
  page,
  t,
}) => {
  const calls = await mockDevice(page, "tenant_admin", detail());
  await page.route(`**/api/v1/devices/${DEVICE_1}/impact?**`, (r) =>
    r.fulfill(
      json(
        impact({
          verdict: "allowed_with_custody_exception",
          revokeReason: "hardware_failure",
          requires: ["owner_or_tenant_admin", "note", "acknowledge_custody_exception"],
          openShift: openShift(),
        }),
      ),
    ),
  );
  await route(page, `**/api/v1/devices/${DEVICE_1}/revoke`, (body) => {
    calls.revoke.push(body);
    return revoked({ revokeReason: "hardware_failure", custodyExceptionShiftId: SHIFT_OPEN }).data;
  });
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.revoke") }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("radio", { name: t("devices.reason.hardware_failure") }).check();
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();

  await expect(drawer.getByText(t("devices.impact.verdict.allowedCustody"))).toBeVisible();
  await expect(drawer.getByText(t("devices.impact.cashFacts.note"))).toBeVisible();
  await drawer.getByRole("button", { name: t("devices.revoke.confirm") }).click();
  await expect(drawer.getByText(t("devices.revoke.acknowledgeRequired"))).toBeVisible();
  expect(calls.revoke).toEqual([]);

  await drawer.getByLabel(t("devices.revoke.noteRecovery")).fill("Screen cracked; cash in safe");
  await drawer.getByRole("checkbox", { name: t("devices.revoke.acknowledge") }).check();
  await drawer.getByRole("button", { name: t("devices.revoke.confirm") }).click();
  await expect(drawer.getByText(t("devices.revoke.done"))).toBeVisible();
  expect(calls.revoke).toEqual([
    {
      reason: "hardware_failure",
      note: "Screen cracked; cash in safe",
      acknowledgeCustodyException: true,
    },
  ]);
});

test("S4: forbidden_recovery for a store manager: an owner or tenant admin must do it", async ({
  page,
  t,
}) => {
  const { drawer } = await reviewRevoke(page, t, {
    role: "store_manager",
    reason: "hardware_failure",
    preview: impact({
      verdict: "forbidden_recovery",
      revokeReason: "hardware_failure",
      requires: ["owner_or_tenant_admin", "note", "acknowledge_custody_exception"],
      openShift: openShift(),
    }),
  });
  await expect(drawer.getByText(t("devices.impact.verdict.forbidden"))).toBeVisible();
  await expect(drawer.getByRole("button", { name: t("devices.revoke.confirm") })).toHaveCount(0);
});

test("S5: a store-scope refusal (404 on the impact) reads as unavailable", async ({ page, t }) => {
  await mockDevice(page, "store_manager", detail());
  await page.route(`**/api/v1/devices/${DEVICE_1}/impact?**`, (r) =>
    r.fulfill(json(NOT_FOUND, 404)),
  );
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.revoke") }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("radio", { name: t("devices.reason.lost") }).check();
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await expect(drawer.getByText(t("devices.flow.error.notFound"))).toBeVisible();
  await expect(drawer.getByText("req-404")).toBeVisible();
  await expect(drawer.getByRole("button", { name: t("devices.revoke.confirm") })).toHaveCount(0);
});

test("S6: retire needs a reason, shows the impact, and is terminal", async ({ page, t }) => {
  const calls = await mockDevice(page, "owner", detail());
  await page.route(`**/api/v1/devices/${DEVICE_1}/impact?**`, (r) =>
    r.fulfill(json(impact({ action: "retire", revokeReason: "retired" }))),
  );
  let isRetired = false;
  await page.route(`**/api/v1/devices/${DEVICE_1}`, (r) =>
    r.fulfill(json(isRetired ? retired().data.device : detail())),
  );
  await route(page, `**/api/v1/devices/${DEVICE_1}/retire`, (body) => {
    calls.retire.push(body);
    isRetired = true;
    return retired().data;
  });
  await page.goto(`/devices/${DEVICE_1}`);
  await page.getByRole("button", { name: t("devices.actions.retire") }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await expect(drawer.getByText(t("devices.text.required"))).toBeVisible();
  await drawer.getByLabel(t("devices.retire.reason")).fill("End of life");
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await expect(drawer.getByText(t("devices.impact.verdict.allowed"))).toBeVisible();
  await drawer.getByRole("button", { name: t("devices.retire.confirm") }).click();
  // The detail refetches as retired behind the drawer; the done step must outlive that.
  await expect(page.getByText(t("devices.actions.closed"))).toBeVisible();
  await expect(drawer.getByText(t("devices.retire.done"))).toBeVisible();
  expect(calls.retire).toEqual([{ retireReason: "End of life" }]);
  await drawer.getByRole("button", { name: t("devices.flow.done") }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("S6b: retire of a revoked device with a custody exception is blocked by the server", async ({
  page,
  t,
}) => {
  const revokedDevice = detail({
    deviceId: DEVICE_2,
    label: "Till 2",
    trustState: "revoked",
    revokedAt: "2026-10-10T12:00:00Z",
    revokeReason: "stolen",
    custodyExceptionShiftId: SHIFT_OPEN,
  });
  await mockDevice(page, "owner", revokedDevice);
  await page.route(`**/api/v1/devices/${DEVICE_2}/impact?**`, (r) =>
    r.fulfill(
      json(
        impact({
          deviceId: DEVICE_2,
          action: "retire",
          revokeReason: "retired",
          trustState: "revoked",
          verdict: "blocked",
          blockCode: "unresolved_custody_exception",
          openShift: openShift(),
          custodyExceptionShiftId: SHIFT_OPEN,
          cascade: null,
        }),
      ),
    ),
  );
  await page.goto(`/devices/${DEVICE_2}`);
  await expect(page.getByRole("button", { name: t("devices.actions.revoke") })).toHaveCount(0);
  await page.getByRole("button", { name: t("devices.actions.retire") }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel(t("devices.retire.reason")).fill("End of life");
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await expect(drawer.getByText(t("devices.impact.blocked.custodyException"))).toBeVisible();
  await expect(drawer.getByRole("button", { name: t("devices.retire.confirm") })).toHaveCount(0);
});

test("S7: axe finds no violations on the revoke details, the confirm steps and the blocked state", async ({
  page,
  t,
}) => {
  // The drawer's entrance fades in; contrast is measured on the settled page.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const recovery = impact({
    verdict: "allowed_with_custody_exception",
    revokeReason: "hardware_failure",
    requires: ["owner_or_tenant_admin", "note", "acknowledge_custody_exception"],
    openShift: openShift(),
  });
  const { drawer } = await reviewRevoke(page, t, {
    role: "owner",
    reason: "hardware_failure",
    preview: recovery,
  });
  await expect(drawer.getByText(t("devices.impact.verdict.allowedCustody"))).toBeVisible();
  await expectNoAxeViolations(page, "recovery confirm step");

  // The same step with its validation errors showing.
  await drawer.getByRole("button", { name: t("devices.revoke.confirm") }).click();
  await expect(drawer.getByText(t("devices.revoke.acknowledgeRequired"))).toBeVisible();
  await expectNoAxeViolations(page, "recovery confirm step with errors");

  await drawer.getByRole("button", { name: t("devices.flow.back") }).click();
  await expectNoAxeViolations(page, "revoke details");

  await page.route(`**/api/v1/devices/${DEVICE_1}/impact?**`, (r) =>
    r.fulfill(
      json(
        impact({
          verdict: "blocked",
          blockCode: "unresolved_cash_session",
          openShift: openShift(),
        }),
      ),
    ),
  );
  await drawer.getByRole("button", { name: t("devices.flow.review") }).click();
  await expect(drawer.getByText(t("devices.impact.blocked.cashSession"))).toBeVisible();
  await expectNoAxeViolations(page, "blocked confirm step");
});
