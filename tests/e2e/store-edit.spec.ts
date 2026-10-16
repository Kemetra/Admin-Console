import { type Page, expect, test } from "./fixtures";

/**
 * RT-400 store detail → edit E2E (screens 17 and 19). The detail page offers
 * «Edit store» and no delete. On the edit page the name save sends `{ name }`
 * only and routes back to the detail; «Suspend store» sends
 * `{ is_active: false }` on its own and stays put. Mocked DP2 (C-5).
 */

const ctx = {
  user: {
    id: "u1",
    email: "amal@northstar.eg",
    display_name: "Amal Saleh",
    is_platform_admin: true,
  },
  active_tenant: { id: "t1", name: "Northstar Retail" },
  active_store: null,
  active_role_code: "tenant_admin",
  memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: "tenant_admin" }],
};

async function mockStore(page: Page, patches: unknown[]): Promise<void> {
  const store = {
    id: "s1",
    code: "CFC",
    name: "Cairo Festival City",
    is_active: true,
    timezone: "UTC",
  };
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.route("**/api/v1/context/me", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ctx) }),
  );
  await page.route("**/api/v1/stores/s1", (r) => {
    if (r.request().method() === "PATCH") {
      const body = r.request().postDataJSON() as Record<string, unknown>;
      patches.push(body);
      for (const key of ["name", "is_active", "timezone"]) {
        if (key in body) Object.assign(store, { [key]: body[key] });
      }
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(store) });
  });
}

test("RT-400: detail offers edit and no delete; save sends the name only", async ({ page, t }) => {
  const patches: unknown[] = [];
  await mockStore(page, patches);

  await page.goto("/stores/s1");
  await expect(page.getByRole("heading", { name: "Cairo Festival City" })).toBeVisible();
  await expect(page.getByRole("button", { name: /delete|حذف/i })).toHaveCount(0);
  await page.getByRole("link", { name: t("stores.detail.edit"), exact: true }).click();

  await expect(page.getByRole("heading", { name: t("stores.form.section") })).toBeVisible();
  await expect(page.locator("#store-code")).toHaveAttribute("readonly", "");
  await page.locator("#store-name").fill("CFC Mall");
  await page.getByRole("button", { name: t("stores.form.saveChanges"), exact: true }).click();

  await expect(page.getByRole("heading", { name: "CFC Mall" })).toBeVisible();
  expect(patches).toEqual([{ name: "CFC Mall" }]);
});

test("RT-400: «Suspend store» asks first, then sends is_active=false", async ({ page, t }) => {
  const patches: unknown[] = [];
  await mockStore(page, patches);

  await page.goto("/stores/s1/edit");
  const status = page.getByRole("region", { name: t("stores.status.title") });
  await expect(status.getByText(t("stores.state.active"), { exact: true })).toBeVisible();
  await status.getByRole("button", { name: t("stores.status.suspend"), exact: true }).click();

  // nothing is sent until the inline confirm, which names the store
  const confirm = page.getByRole("region", { name: t("stores.status.confirmLabel") });
  await expect(confirm).toContainText("Cairo Festival City");
  expect(patches).toEqual([]);
  await confirm.getByRole("button", { name: t("stores.status.suspend"), exact: true }).click();

  await expect(status.getByText(t("stores.state.inactive"), { exact: true })).toBeVisible();
  await expect(
    status.getByRole("button", { name: t("stores.status.activate"), exact: true }),
  ).toBeVisible();
  expect(patches).toEqual([{ is_active: false }]);
});

const preview = {
  store_id: "s1",
  current_timezone: "UTC",
  proposed_timezone: "Africa/Cairo",
  no_op: false,
  now: "2026-10-16T22:30:00Z",
  utc_offset_minutes_current: 0,
  utc_offset_minutes_proposed: 180,
  business_date_current: "2026-10-16",
  business_date_proposed: "2026-10-17",
  business_date_changes_now: true,
  open_shift_count: 0,
  blockers: [],
};

async function mockPreview(page: Page): Promise<void> {
  await page.route("**/api/v1/stores/s1/timezone-change-preview*", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(preview) }),
  );
}

test("RT-477: a zone change is previewed, reviewed, then sent with all three fields", async ({
  page,
  t,
}) => {
  const patches: unknown[] = [];
  await mockStore(page, patches);
  await mockPreview(page);

  await page.goto("/stores/s1/edit");
  const zone = page.locator("#store-timezone");
  await expect(zone).toHaveValue("UTC");
  await zone.selectOption("Africa/Cairo");

  const impact = page.getByRole("region", { name: t("stores.timezone.impact.title") });
  await expect(impact).toContainText("2026-10-17");
  const save = page.getByRole("button", { name: t("stores.form.saveChanges"), exact: true });
  await expect(save).toBeDisabled();
  await impact.getByRole("checkbox").check();
  await expect(save).toBeEnabled();
  await save.click();

  await expect(page.getByRole("heading", { name: "Cairo Festival City" })).toBeVisible();
  expect(patches).toEqual([
    {
      name: "Cairo Festival City",
      timezone: "Africa/Cairo",
      expected_current_timezone: "UTC",
      timezone_impact_reviewed: true,
    },
  ]);
  // The detail now shows the zone as city and IANA identity, with no UTC offset.
  await expect(page.locator("bdi", { hasText: "Africa/Cairo" })).toBeVisible();
});

test("RT-477: store_has_open_shift on save -> a banner carrying the request id", async ({
  page,
  t,
}) => {
  const patches: unknown[] = [];
  await mockStore(page, patches);
  await mockPreview(page);
  await page.route("**/api/v1/stores/s1", (r) => {
    if (r.request().method() !== "PATCH") return r.fallback();
    patches.push(r.request().postDataJSON());
    return r.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "store_has_open_shift", message: "open", request_id: "req_e2e_shift" },
      }),
    });
  });

  await page.goto("/stores/s1/edit");
  await page.locator("#store-timezone").selectOption("Africa/Cairo");
  await page
    .getByRole("region", { name: t("stores.timezone.impact.title") })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: t("stores.form.saveChanges"), exact: true }).click();

  const banner = page.getByRole("alert");
  await expect(banner).toContainText(t("stores.errors.storeHasOpenShift"));
  await expect(banner).toContainText("req_e2e_shift");
  expect(patches).toHaveLength(1);
});

test("RT-477: create requires a time zone, preselected to Africa/Cairo, and sends it", async ({
  page,
  t,
}) => {
  const posts: unknown[] = [];
  await mockStore(page, []);
  await page.route("**/api/v1/stores", (r) => {
    if (r.request().method() !== "POST") return r.fallback();
    posts.push(r.request().postDataJSON());
    return r.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "s1",
        code: "NEW",
        name: "New Store",
        is_active: true,
        timezone: "Africa/Cairo",
      }),
    });
  });

  await page.goto("/stores/new");
  const zone = page.locator("#store-timezone");
  await expect(zone).toHaveValue("Africa/Cairo");
  await expect(zone).toHaveAttribute("aria-required", "true");
  await page.locator("#store-name").fill("New Store");
  await page.locator("#store-code").fill("NEW");
  await page.getByRole("button", { name: t("stores.form.create"), exact: true }).click();

  await expect(page.getByRole("heading", { name: "Cairo Festival City" })).toBeVisible();
  expect(posts).toEqual([{ code: "NEW", name: "New Store", timezone: "Africa/Cairo" }]);
});
