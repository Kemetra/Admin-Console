import AxeBuilder from "@axe-core/playwright";
import { formatDateTime } from "../../src/i18n/format";
import { type Page, expect, test } from "./fixtures";

/**
 * RT-389 shift variance policy E2E against mocked Backend-Core (C-5).
 * S1 tenant default: view (system default none), set a limit with Apply Now.
 * S2 store: effective policy, override with a reason and an expiry in the store
 * zone, history with the expiry reversion, clear.
 * S3 RBAC: store_manager reads without edit controls, cashier sees nothing,
 * tenant_admin is routed to an owner for a permanent override.
 * S4 validation. S5 409 refresh-and-retry. S6 axe on both pages.
 * RT-399: runs in both locales; copy comes from the catalog (`t`).
 */
const TENANT = "t1";
const STORE = "s1";
const REV_1 = "0190f000-0000-7000-8000-0000000000b1";
const REV_2 = "0190f000-0000-7000-8000-0000000000b2";
const REV_3 = "0190f000-0000-7000-8000-0000000000b3";
const USER = "0190f000-0000-7000-8000-0000000000c1";
const OWNER = "0190f000-0000-7000-8000-0000000000c2";

/**
 * `@axe-core/playwright` is typed against the playwright-core of `@e2e-dev/web`
 * (a newer minor than `@playwright/test`'s), so the two `Page` types differ
 * though the runtime object is the same.
 */
function axeFor(page: Page): AxeBuilder {
  return new AxeBuilder({
    page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]["page"],
  });
}

const NONE = { mode: "none" };
const limit = (amount: string) => ({ mode: "limit", limitAmount: amount, currencyCode: "EGP" });

function ctx(role: string) {
  return {
    user: { id: "u1", email: "amal@northstar.eg", display_name: "Amal Saleh" },
    active_tenant: { id: TENANT, name: "Northstar Retail" },
    active_store: null,
    active_role_code: role,
    memberships: [{ tenant_id: TENANT, tenant_name: "Northstar Retail", role_code: role }],
  };
}

const tenant = { id: TENANT, slug: "northstar", name: "Northstar Retail", status: "active" };
const store = {
  id: STORE,
  tenant_id: TENANT,
  code: "CFC",
  name: "Cairo Festival City",
  timezone: "Africa/Cairo",
  is_active: true,
};

function json(body: unknown, status = 200) {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}
const apiError = (code: string, status: number) =>
  json({ error: { code, message: "x", request_id: `req-${code}` } }, status);

function revision(over: Record<string, unknown>) {
  return {
    revisionId: REV_1,
    scope: "tenant",
    storeId: null,
    kind: "set",
    policyValue: limit("1250.0000"),
    reason: "Quarterly review",
    effectiveFrom: "2026-10-07T10:00:00Z",
    effectiveUntil: null,
    permanent: false,
    approvedByUserId: null,
    supersedesRevisionId: null,
    state: "current",
    createdByUserId: USER,
    createdAt: "2026-10-07T10:00:00Z",
    ...over,
  };
}

const systemTenant = {
  tenantDefault: { policySource: "system", policyRevisionId: null, policyValue: NONE },
  latestRevision: null,
  latestRevisionId: null,
};
const limitTenant = {
  tenantDefault: {
    policySource: "tenant",
    policyRevisionId: REV_1,
    policyValue: limit("1250.0000"),
  },
  latestRevision: revision({}),
  latestRevisionId: REV_1,
};
const plainStore = {
  storeId: STORE,
  effective: { policySource: "tenant", policyRevisionId: REV_1, policyValue: limit("1250.0000") },
  tenantDefault: limitTenant.tenantDefault,
  activeOverride: null,
  latestRevisionId: REV_1,
  permanentOverrideHorizonDays: 90,
};
const overriddenStore = {
  ...plainStore,
  effective: { policySource: "store", policyRevisionId: REV_2, policyValue: limit("500.0000") },
  activeOverride: {
    revisionId: REV_2,
    policyValue: limit("500.0000"),
    reason: "Shrinkage audit",
    effectiveUntil: "2026-11-01T09:00:00Z",
    permanent: false,
    approvedByUserId: null,
    createdByUserId: USER,
    createdAt: "2026-10-08T09:00:00Z",
  },
  latestRevisionId: REV_2,
};

interface Seed {
  tenantRead?: unknown;
  storeRead?: unknown;
  tenantRevisions?: unknown[];
  storeRevisions?: unknown[];
}

interface Calls {
  tenantPublishes: { body: Record<string, unknown>; key: string | undefined }[];
  storePublishes: { body: Record<string, unknown>; key: string | undefined }[];
  tenantPolicyGets: number;
  storePolicyGets: number;
}

/** Mock the shell, the two detail reads and the six policy operations. */
async function mockApi(page: Page, role: string, seed: Seed = {}): Promise<Calls> {
  const calls: Calls = {
    tenantPublishes: [],
    storePublishes: [],
    tenantPolicyGets: 0,
    storePolicyGets: 0,
  };
  await page.route("**/api/v1/**", (r) => r.fulfill(json({})));
  await page.route("**/api/v1/context/me", (r) => r.fulfill(json(ctx(role))));
  await page.route("**/api/v1/stores", (r) => r.fulfill(json([store])));
  await page.route(`**/api/v1/stores/${STORE}`, (r) => r.fulfill(json(store)));
  await page.route(`**/api/v1/tenants/${TENANT}`, (r) => r.fulfill(json(tenant)));

  await page.route(`**/api/v1/tenants/${TENANT}/cash-variance-policy`, (r) => {
    calls.tenantPolicyGets += 1;
    return r.fulfill(json(seed.tenantRead ?? systemTenant));
  });
  await page.route(/\/api\/v1\/tenants\/t1\/cash-variance-policy\/revisions(\?.*)?$/, (r) => {
    if (r.request().method() === "POST") {
      calls.tenantPublishes.push({
        body: r.request().postDataJSON(),
        key: r.request().headers()["idempotency-key"],
      });
      return r.fulfill(json(limitTenantAfterPublish(r.request().postDataJSON()), 201));
    }
    return r.fulfill(json({ items: seed.tenantRevisions ?? [], nextCursor: null }));
  });
  await page.route(`**/api/v1/stores/${STORE}/cash-variance-policy`, (r) => {
    calls.storePolicyGets += 1;
    return r.fulfill(json(seed.storeRead ?? plainStore));
  });
  await page.route(/\/api\/v1\/stores\/s1\/cash-variance-policy\/revisions(\?.*)?$/, (r) => {
    if (r.request().method() === "POST") {
      const body = r.request().postDataJSON();
      calls.storePublishes.push({ body, key: r.request().headers()["idempotency-key"] });
      return r.fulfill(json(body.kind === "clear" ? plainStore : overriddenStore, 201));
    }
    return r.fulfill(json({ items: seed.storeRevisions ?? [], nextCursor: null }));
  });
  return calls;
}

function limitTenantAfterPublish(body: { policyValue: { limitAmount?: string }; reason: string }) {
  return {
    tenantDefault: {
      policySource: "tenant",
      policyRevisionId: REV_2,
      policyValue: body.policyValue.limitAmount ? limit(body.policyValue.limitAmount) : NONE,
    },
    latestRevision: revision({
      revisionId: REV_2,
      reason: body.reason,
      supersedesRevisionId: REV_1,
    }),
    latestRevisionId: REV_2,
  };
}

test("S1: owner views the system default and applies a limit on the tenant page", async ({
  page,
  t,
}) => {
  const calls = await mockApi(page, "owner");
  await page.goto(`/tenants/${TENANT}`);

  await expect(page.getByRole("heading", { name: t("cashPolicy.tenant.title") })).toBeVisible();
  await expect(page.getByText(t("cashPolicy.source.system"))).toBeVisible();
  await expect(page.getByText(t("cashPolicy.value.none")).first()).toBeVisible();

  await page.getByLabel(t("cashPolicy.form.modeLimit")).check();
  await page.getByLabel(t("cashPolicy.form.limitAmount")).fill("800.50");
  await expect(page.getByLabel(t("cashPolicy.form.currency"))).toHaveValue("EGP");
  await page.getByLabel(t("cashPolicy.form.reason"), { exact: true }).fill("Tighten for Q4");
  await page.getByRole("button", { name: t("cashPolicy.form.applyNow") }).click();

  await expect(page.getByText(t("cashPolicy.form.saved"))).toBeVisible();
  // UX-12 money: the saved limit as 800.50 EGP.
  await expect(page.getByText("800.50 EGP").first()).toBeVisible();
  expect(calls.tenantPublishes).toHaveLength(1);
  expect(calls.tenantPublishes[0].body).toEqual({
    expectedRevisionId: null,
    policyValue: { mode: "limit", limitAmount: "800.50", currencyCode: "EGP" },
    reason: "Tighten for Q4",
  });
  expect(calls.tenantPublishes[0].key).toMatch(/^[\x21-\x7E]{16,128}$/);
});

test("S1b: a tenant default with history shows the money format and the revisions", async ({
  page,
  t,
}) => {
  await mockApi(page, "tenant_admin", {
    tenantRead: limitTenant,
    tenantRevisions: [
      revision({}),
      revision({ revisionId: REV_3, state: "superseded", reason: "Initial" }),
    ],
  });
  await page.goto(`/tenants/${TENANT}`);
  await expect(page.getByText("1,250.00 EGP").first()).toBeVisible();
  const table = page.getByRole("table", { name: t("cashPolicy.history.caption") });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByText("Quarterly review")).toBeVisible();
  await expect(table.getByText("Initial")).toBeVisible();
});

test("S2: owner sees the effective policy, sets an override with an expiry, then clears it", async ({
  page,
  t,
  appLocale,
}) => {
  const calls = await mockApi(page, "owner", {
    storeRead: overriddenStore,
    storeRevisions: [
      revision({
        revisionId: REV_2,
        scope: "store",
        storeId: STORE,
        policyValue: limit("500.0000"),
        reason: "Shrinkage audit",
        effectiveUntil: "2026-10-20T09:00:00Z",
        state: "expired",
      }),
    ],
  });
  await page.goto(`/stores/${STORE}`);

  await expect(page.getByRole("heading", { name: t("cashPolicy.store.title") })).toBeVisible();
  await expect(page.getByText(t("cashPolicy.source.store")).first()).toBeVisible();
  await expect(page.getByText("500.00 EGP").first()).toBeVisible();
  await expect(page.getByText("Shrinkage audit").first()).toBeVisible();
  // The expiry is shown in the store's zone (Cairo, UTC+2 on 1 Nov 2026).
  await expect(
    page
      .getByText(
        formatDateTime("2026-11-01T09:00:00Z", { timeZone: "Africa/Cairo", locale: appLocale }),
      )
      .first(),
  ).toBeVisible();
  // The expiry reversion reads from the revision history.
  await expect(page.getByText(t("cashPolicy.history.expiredNote"))).toBeVisible();

  await page.getByLabel(t("cashPolicy.form.modeLimit")).check();
  await page.getByLabel(t("cashPolicy.form.limitAmount")).fill("400");
  await page.getByLabel(t("cashPolicy.form.reason"), { exact: true }).fill("Audit follow-up");
  await page.getByLabel(t("cashPolicy.form.expiry")).fill("2026-12-01T10:30");
  await page.getByRole("button", { name: t("cashPolicy.form.applyNow") }).click();
  await expect(page.getByText(t("cashPolicy.form.saved"))).toBeVisible();
  expect(calls.storePublishes[0].body).toEqual({
    expectedRevisionId: REV_2,
    kind: "set",
    policyValue: { mode: "limit", limitAmount: "400", currencyCode: "EGP" },
    reason: "Audit follow-up",
    effectiveUntil: "2026-12-01T08:30:00.000Z",
  });

  await page.getByLabel(t("cashPolicy.form.clearReason")).fill("Audit done");
  await page.getByRole("button", { name: t("cashPolicy.form.clear") }).click();
  await expect(page.getByText(t("cashPolicy.form.cleared"))).toBeVisible();
  expect(calls.storePublishes[1].body).toEqual({
    expectedRevisionId: REV_2,
    kind: "clear",
    reason: "Audit done",
  });
  await expect(page.getByText(t("cashPolicy.override.none"))).toBeVisible();
});

test("S2b: a permanent override is labelled and names its approving owner", async ({ page, t }) => {
  await mockApi(page, "owner", {
    storeRead: {
      ...overriddenStore,
      activeOverride: {
        ...overriddenStore.activeOverride,
        effectiveUntil: null,
        permanent: true,
        approvedByUserId: OWNER,
      },
    },
  });
  await page.goto(`/stores/${STORE}`);
  await expect(page.getByText(t("cashPolicy.override.permanent")).first()).toBeVisible();
  await expect(
    page.locator(".cash-policy__line", { hasText: t("cashPolicy.override.noExpiry") }),
  ).toBeVisible();
  await expect(page.getByText(OWNER)).toBeVisible();
});

test("S3: store_manager reads the store policy with no edit controls; the tenant page has no section", async ({
  page,
  t,
}) => {
  const calls = await mockApi(page, "store_manager", { storeRead: overriddenStore });
  await page.goto(`/stores/${STORE}`);
  await expect(page.getByText("500.00 EGP").first()).toBeVisible();
  await expect(page.getByText(t("cashPolicy.readOnly"))).toBeVisible();
  await expect(page.getByRole("button", { name: t("cashPolicy.form.applyNow") })).toHaveCount(0);
  await expect(page.getByRole("button", { name: t("cashPolicy.form.clear") })).toHaveCount(0);
  await expect(page.getByText(t("cashPolicy.history.title"))).toHaveCount(0);

  await page.goto(`/tenants/${TENANT}`);
  await expect(page.getByRole("heading", { name: tenant.name })).toBeVisible();
  await expect(page.getByText(t("cashPolicy.tenant.title"))).toHaveCount(0);
  expect(calls.tenantPolicyGets).toBe(0);
});

test("S3b: a cashier sees no policy on the store page", async ({ page, t }) => {
  const calls = await mockApi(page, "cashier");
  await page.goto(`/stores/${STORE}`);
  await expect(page.getByRole("heading", { name: store.name })).toBeVisible();
  await expect(page.getByText(t("cashPolicy.store.title"))).toHaveCount(0);
  expect(calls.storePolicyGets).toBe(0);
});

test("S3c: a tenant_admin is told to ask an owner for a permanent override; nothing is sent", async ({
  page,
  t,
}) => {
  const calls = await mockApi(page, "tenant_admin");
  await page.goto(`/stores/${STORE}`);
  await expect(page.getByText(t("cashPolicy.override.permanentNote", { days: 90 }))).toBeVisible();
  await page.getByLabel(t("cashPolicy.form.reason"), { exact: true }).fill("Long term");
  await page.getByRole("button", { name: t("cashPolicy.form.applyNow") }).click();
  await expect(page.getByText(t("cashPolicy.error.expiryRequiredForAdmin"))).toBeVisible();
  expect(calls.storePublishes).toHaveLength(0);
});

test("S3d: the server's owner_approval_required refusal is shown", async ({ page, t }) => {
  await mockApi(page, "tenant_admin");
  await page.route(/\/api\/v1\/stores\/s1\/cash-variance-policy\/revisions(\?.*)?$/, (r) =>
    r.request().method() === "POST"
      ? r.fulfill(apiError("owner_approval_required", 403))
      : r.fulfill(json({ items: [], nextCursor: null })),
  );
  await page.goto(`/stores/${STORE}`);
  await page.getByLabel(t("cashPolicy.form.reason"), { exact: true }).fill("Far away");
  await page.getByLabel(t("cashPolicy.form.expiry")).fill("2027-12-01T10:30");
  await page.getByRole("button", { name: t("cashPolicy.form.applyNow") }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "req-owner_approval_required" }),
  ).toContainText(t("cashPolicy.error.ownerApprovalRequired"));
});

test("S4: validation blocks a blank reason and a bad amount; nothing is sent", async ({
  page,
  t,
}) => {
  const calls = await mockApi(page, "owner");
  await page.goto(`/tenants/${TENANT}`);
  await page.getByLabel(t("cashPolicy.form.modeLimit")).check();
  await page.getByLabel(t("cashPolicy.form.limitAmount")).fill("12.345");
  await page.getByRole("button", { name: t("cashPolicy.form.applyNow") }).click();
  await expect(page.getByText(t("cashPolicy.error.reasonRequired"))).toBeVisible();
  await expect(page.getByText(t("cashPolicy.error.amountInvalid"))).toBeVisible();
  expect(calls.tenantPublishes).toHaveLength(0);
});

test("S5: a 409 changed-concurrently asks to refresh and retry; the draft survives", async ({
  page,
  t,
}) => {
  const calls = await mockApi(page, "owner", { tenantRead: limitTenant });
  let first = true;
  await page.route(/\/api\/v1\/tenants\/t1\/cash-variance-policy\/revisions(\?.*)?$/, (r) => {
    if (r.request().method() !== "POST") return r.fulfill(json({ items: [], nextCursor: null }));
    calls.tenantPublishes.push({
      body: r.request().postDataJSON(),
      key: r.request().headers()["idempotency-key"],
    });
    if (first) {
      first = false;
      return r.fulfill(apiError("cash_variance_policy_changed_concurrently", 409));
    }
    return r.fulfill(json(limitTenantAfterPublish(r.request().postDataJSON()), 201));
  });
  await page.goto(`/tenants/${TENANT}`);
  await page.getByLabel(t("cashPolicy.form.limitAmount")).fill("900");
  await page.getByLabel(t("cashPolicy.form.reason"), { exact: true }).fill("Mine");
  await page.getByRole("button", { name: t("cashPolicy.form.applyNow") }).click();

  const alert = page
    .getByRole("alert")
    .filter({ hasText: t("cashPolicy.error.changedConcurrently") });
  await expect(alert).toBeVisible();
  await expect(page.getByLabel(t("cashPolicy.form.reason"), { exact: true })).toHaveValue("Mine");
  await alert.getByRole("button", { name: t("cashPolicy.refresh") }).click();
  await expect(alert).toHaveCount(0);
  await page.getByRole("button", { name: t("cashPolicy.form.applyNow") }).click();
  await expect(page.getByText(t("cashPolicy.form.saved"))).toBeVisible();
  expect(calls.tenantPublishes).toHaveLength(2);
  expect(calls.tenantPolicyGets).toBe(2);
});

test("S6: axe finds no violations on the tenant and store policy sections", async ({ page }) => {
  await mockApi(page, "owner", {
    tenantRead: limitTenant,
    storeRead: overriddenStore,
    tenantRevisions: [revision({})],
    storeRevisions: [
      revision({
        scope: "store",
        storeId: STORE,
        reason: "Shrinkage audit",
        state: "expired",
        effectiveUntil: "2026-10-20T09:00:00Z",
      }),
    ],
  });
  for (const path of [`/tenants/${TENANT}`, `/stores/${STORE}`]) {
    await page.goto(path);
    await expect(page.locator(".cash-policy table")).toBeVisible();
    const results = await axeFor(page)
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    // Guard against a vacuous pass: the engine must have evaluated rules on this page.
    expect(results.passes.length, path).toBeGreaterThan(10);
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
      ),
      path,
    ).toEqual([]);
  }
});
