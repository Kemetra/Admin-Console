import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const role = vi.hoisted(() => ({ current: "owner" }));
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => ({
    context: { active_tenant: { id: "t1" }, active_role_code: role.current },
  }),
}));

const get = vi.fn();
const list = vi.fn();
const publish = vi.fn();
vi.mock("@/lib/cash-variance-policy-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cash-variance-policy-queries")>();
  return {
    ...actual,
    consoleGetStoreCashVariancePolicy: (...a: unknown[]) => get(...a),
    consoleListStoreCashVariancePolicyRevisions: (...a: unknown[]) => list(...a),
    consolePublishStoreCashVariancePolicyOverride: (...a: unknown[]) => publish(...a),
  };
});

import { StorePolicySection } from "@/cash-policy/StorePolicySection";
import { setLocale } from "@/i18n/locale";
import {
  LIMIT_500,
  REV_2,
  REV_3,
  STORE_ID,
  USER_A,
  USER_OWNER,
  apiError,
  overriddenStoreRead,
  plainStoreRead,
  renderWithQuery,
  revision,
} from "./cash-policy-fixtures";

const emptyPage = { status: 200, data: { items: [], nextCursor: null } };

function mount(timeZone = "Africa/Cairo") {
  return renderWithQuery(<StorePolicySection storeId={STORE_ID} timeZone={timeZone} />);
}

function field(label: string): HTMLElement {
  const row = screen.getByText(label, { selector: ".field-row__label" }).closest(".field-row");
  if (!row) throw new Error(`no field row for ${label}`);
  return row as HTMLElement;
}

async function fillOverride(over: { amount?: string; reason?: string; expiry?: string } = {}) {
  await screen.findByRole("button", { name: "Apply now" });
  fireEvent.click(screen.getByLabelText(/^Limit: approval needed/));
  fireEvent.change(screen.getByLabelText("Variance limit"), {
    target: { value: over.amount ?? "500" },
  });
  fireEvent.change(screen.getByLabelText("Reason"), { target: { value: over.reason ?? "Audit" } });
  if (over.expiry !== undefined) {
    fireEvent.change(screen.getByLabelText("Expiry (optional)"), {
      target: { value: over.expiry },
    });
  }
}

/**
 * RT-389 store page (AD-CASH-001 F6): the effective (resolved) policy and the
 * tenant default it inherits come from the server as-is; an override needs a
 * reason and takes an optional expiry; no expiry means permanent and owner-only
 * (DR-4, owner ruling 2026-10-11). store_manager reads, never edits.
 */
describe("StorePolicySection", () => {
  beforeEach(() => {
    role.current = "owner";
    get.mockReset();
    list.mockReset();
    publish.mockReset();
    list.mockResolvedValue(emptyPage);
    setLocale("en");
  });

  test("shows the effective policy and its source exactly as resolved by the server", async () => {
    get.mockResolvedValue({ status: 200, data: overriddenStoreRead() });
    mount();
    expect(await screen.findByRole("heading", { name: "Shift variance policy" })).toBeDefined();
    await screen.findByText("Effective policy", { selector: ".field-row__label" });
    expect(field("Effective policy").textContent).toContain(
      "Approval needed when the variance is over 500.00 EGP",
    );
    expect(field("Source").textContent).toContain("Store override");
    expect(field("Tenant default").textContent).toContain("1,250.00 EGP");
    expect(get).toHaveBeenCalledWith(STORE_ID);
  });

  test("shows the active override with reason and expiry in the store zone", async () => {
    get.mockResolvedValue({ status: 200, data: overriddenStoreRead() });
    mount("Africa/Cairo");
    await screen.findByText("Store override", { selector: ".field-row__label" });
    const row = field("Store override");
    expect(row.textContent).toContain("Shrinkage audit");
    // 2026-11-01T09:00Z in Cairo (UTC+2 after the DST end).
    expect(row.textContent).toContain("Nov 1, 2026, 11:00");
    expect(row.textContent).not.toContain("Permanent");
  });

  test("a permanent override is labelled and names the approving owner", async () => {
    get.mockResolvedValue({
      status: 200,
      data: overriddenStoreRead({
        activeOverride: {
          ...overriddenStoreRead().activeOverride,
          effectiveUntil: null,
          permanent: true,
          approvedByUserId: USER_OWNER,
        },
      }),
    });
    mount();
    await screen.findByText("Store override", { selector: ".field-row__label" });
    const row = field("Store override");
    expect(row.textContent).toContain("Permanent");
    expect(row.textContent).toContain("No expiry");
    expect(row.textContent).toContain(USER_OWNER);
  });

  test("with no override the store is shown following the tenant default", async () => {
    get.mockResolvedValue({ status: 200, data: plainStoreRead });
    mount();
    expect(
      await screen.findByText("No override. This store follows the tenant default."),
    ).toBeDefined();
    expect(field("Source").textContent).toContain("Tenant default");
    expect(screen.queryByRole("button", { name: "Remove override" })).toBeNull();
  });

  test("a store_manager sees the policy read-only: no form, no clear, no history request", async () => {
    role.current = "store_manager";
    get.mockResolvedValue({ status: 200, data: overriddenStoreRead() });
    mount();
    await screen.findByText("Effective policy", { selector: ".field-row__label" });
    expect(field("Effective policy").textContent).toContain("500.00 EGP");
    expect(
      screen.getByText("You can view this policy. Only an owner or tenant admin can change it."),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Apply now" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove override" })).toBeNull();
    expect(screen.queryByLabelText("Reason")).toBeNull();
    expect(screen.queryByText("Revision history")).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  test.each(["cashier", "platform_admin", undefined])(
    "role %s sees nothing and nothing is requested",
    async (r) => {
      role.current = r as string;
      const { container } = mount();
      await Promise.resolve();
      expect(container.textContent).toBe("");
      expect(get).not.toHaveBeenCalled();
    },
  );

  test("a non-disclosing 404 renders the unavailable copy", async () => {
    get.mockResolvedValue({ status: 404, error: apiError("not_found") });
    mount();
    expect(
      await screen.findByText("The shift variance policy is not available to you."),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Apply now" })).toBeNull();
  });

  test("the override form starts from the active override, not the tenant default", async () => {
    get.mockResolvedValue({ status: 200, data: overriddenStoreRead() });
    publish.mockResolvedValue({ status: 201, data: overriddenStoreRead(), headers: new Headers() });
    mount();
    await screen.findByRole("button", { name: "Apply now" });
    // The override is 500, the tenant default 1250: editing only the reason must not reset the limit.
    expect((screen.getByLabelText("Variance limit") as HTMLInputElement).value).toBe("500");
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Extend" } });
    fireEvent.change(screen.getByLabelText("Expiry (optional)"), {
      target: { value: "2026-12-01T10:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(publish.mock.calls[0][1].policyValue).toEqual({
      mode: "limit",
      limitAmount: "500",
      currencyCode: "EGP",
    });
  });

  test("a store with no override starts from the tenant default", async () => {
    get.mockResolvedValue({ status: 200, data: plainStoreRead });
    mount();
    await screen.findByRole("button", { name: "Apply now" });
    expect((screen.getByLabelText("Variance limit") as HTMLInputElement).value).toBe("1250");
  });

  test("a 200 whose body is not a store policy is a load failure, not a crash", async () => {
    get.mockResolvedValue({ status: 200, data: {} });
    mount();
    expect(await screen.findByText("The policy could not be loaded.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Apply now" })).toBeNull();
  });

  test("an owner sets an override with no expiry: no effectiveUntil is sent", async () => {
    get.mockResolvedValue({ status: 200, data: plainStoreRead });
    publish.mockResolvedValue({
      status: 201,
      data: overriddenStoreRead(),
      headers: new Headers(),
    });
    mount();
    await fillOverride();
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    const [storeId, body, key] = publish.mock.calls[0];
    expect(storeId).toBe(STORE_ID);
    expect(body).toEqual({
      expectedRevisionId: null,
      kind: "set",
      policyValue: { mode: "limit", limitAmount: "500", currencyCode: "EGP" },
      reason: "Audit",
    });
    expect(key).toMatch(/^[\x21-\x7E]{16,128}$/);
    expect(await screen.findByText("The policy was applied.")).toBeDefined();
    expect(field("Effective policy").textContent).toContain("500.00 EGP");
  });

  test("an expiry is read in the store zone and sent with an offset", async () => {
    get.mockResolvedValue({ status: 200, data: plainStoreRead });
    publish.mockResolvedValue({ status: 201, data: overriddenStoreRead(), headers: new Headers() });
    mount("Africa/Cairo");
    await fillOverride({ expiry: "2026-12-01T10:30" });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(publish.mock.calls[0][1].effectiveUntil).toBe("2026-12-01T08:30:00.000Z");
  });

  test("the permanent rule is always explained, with the horizon from the server read", async () => {
    get.mockResolvedValue({
      status: 200,
      data: { ...plainStoreRead, permanentOverrideHorizonDays: 90 },
    });
    mount();
    await screen.findByRole("button", { name: "Apply now" });
    expect(
      screen.getByText(
        "An override with no expiry, or an expiry more than 90 days after publishing, is permanent. Only an owner can publish it.",
      ),
    ).toBeDefined();
  });

  test("a tenant_admin cannot publish an override with no expiry: routed to an owner, nothing sent", async () => {
    role.current = "tenant_admin";
    get.mockResolvedValue({ status: 200, data: plainStoreRead });
    mount();
    await fillOverride();
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    expect(
      await screen.findByText(
        "Set an expiry. Only an owner can publish an override with no expiry.",
      ),
    ).toBeDefined();
    expect(publish).not.toHaveBeenCalled();
  });

  test("a tenant_admin with an expiry publishes; the server's 403 owner_approval_required is shown for a far expiry", async () => {
    role.current = "tenant_admin";
    get.mockResolvedValue({ status: 200, data: plainStoreRead });
    publish.mockResolvedValue({
      status: 403,
      error: apiError("owner_approval_required", "req-403"),
      headers: new Headers(),
    });
    mount();
    await fillOverride({ expiry: "2027-12-01T10:30" });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Only an owner can publish a permanent override.");
    expect(alert.textContent).toContain("req-403");
  });

  test("422 looser than the tenant is shown, not pre-computed", async () => {
    get.mockResolvedValue({ status: 200, data: plainStoreRead });
    publish.mockResolvedValue({
      status: 422,
      error: apiError("override_looser_than_tenant"),
      headers: new Headers(),
    });
    mount();
    // A value looser than the tenant's 1250: the UI still sends it; the server refuses.
    await fillOverride({ amount: "9999" });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    expect(
      await screen.findByText("A store override cannot be looser than the tenant default."),
    ).toBeDefined();
    expect(publish).toHaveBeenCalledTimes(1);
  });

  test("409 changed concurrently: refresh-and-retry message, draft kept", async () => {
    get.mockResolvedValueOnce({ status: 200, data: plainStoreRead });
    publish.mockResolvedValueOnce({
      status: 409,
      error: apiError("cash_variance_policy_changed_concurrently"),
      headers: new Headers(),
    });
    mount();
    await fillOverride({ reason: "Mine" });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Someone else changed the policy.");
    get.mockResolvedValueOnce({
      status: 200,
      data: { ...plainStoreRead, latestRevisionId: REV_3 },
    });
    fireEvent.click(within(alert).getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect((screen.getByLabelText("Reason") as HTMLInputElement).value).toBe("Mine");
  });

  test("clearing needs a reason, then sends kind clear with the reason only", async () => {
    get.mockResolvedValue({ status: 200, data: overriddenStoreRead() });
    publish.mockResolvedValue({ status: 201, data: plainStoreRead, headers: new Headers() });
    mount();
    const clear = await screen.findByRole("button", { name: "Remove override" });
    fireEvent.click(clear);
    expect(await screen.findByText("Enter a reason for the change.")).toBeDefined();
    expect(publish).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Reason for removing"), {
      target: { value: "Audit done" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove override" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(publish.mock.calls[0][1]).toEqual({
      expectedRevisionId: REV_2,
      kind: "clear",
      reason: "Audit done",
    });
    expect(await screen.findByText("The override was removed.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Remove override" })).toBeNull();
  });

  test("history shows set, clear, permanent and the expiry reversion", async () => {
    get.mockResolvedValue({ status: 200, data: plainStoreRead });
    list.mockResolvedValue({
      status: 200,
      data: {
        items: [
          revision({
            revisionId: REV_3,
            scope: "store",
            storeId: STORE_ID,
            kind: "clear",
            policyValue: null,
            reason: "Audit done",
            state: "current",
          }),
          revision({
            revisionId: REV_2,
            scope: "store",
            storeId: STORE_ID,
            policyValue: LIMIT_500,
            reason: "Shrinkage audit",
            effectiveUntil: "2026-10-20T09:00:00Z",
            state: "expired",
          }),
          revision({
            revisionId: "0190f000-0000-7000-8000-0000000000b4",
            scope: "store",
            storeId: STORE_ID,
            reason: "Long term",
            effectiveUntil: null,
            permanent: true,
            approvedByUserId: USER_OWNER,
            state: "superseded",
          }),
        ],
        nextCursor: null,
      },
    });
    mount();
    const table = await screen.findByRole("table", {
      name: "Shift variance policy revisions, newest first",
    });
    expect(within(table).getByText("Removed")).toBeDefined();
    expect(within(table).getByText("No value")).toBeDefined();
    expect(within(table).getByText("Expired")).toBeDefined();
    expect(within(table).getByText("This override expired and no longer applies.")).toBeDefined();
    expect(within(table).getByText("Permanent")).toBeDefined();
    expect(within(table).getAllByText(USER_A).length).toBeGreaterThan(0);
    expect(list).toHaveBeenCalledWith(STORE_ID, expect.anything());
  });

  test("Arabic: the override form and the permanent note speak Arabic", async () => {
    setLocale("ar");
    get.mockResolvedValue({ status: 200, data: plainStoreRead });
    mount();
    expect(await screen.findByRole("button", { name: "تطبيق الآن" })).toBeDefined();
    expect(screen.getByLabelText("تاريخ الانتهاء (اختياري)")).toBeDefined();
    expect(screen.getByText(/ولا ينشره إلا المالك/)).toBeDefined();
  });
});
