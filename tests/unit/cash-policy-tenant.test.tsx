import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const role = vi.hoisted(() => ({ current: "owner", activeTenant: "t1" }));
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => ({
    context: { active_tenant: { id: role.activeTenant }, active_role_code: role.current },
  }),
}));

const get = vi.fn();
const list = vi.fn();
const publish = vi.fn();
vi.mock("@/lib/cash-variance-policy-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cash-variance-policy-queries")>();
  return {
    ...actual,
    consoleGetTenantCashVariancePolicy: (...a: unknown[]) => get(...a),
    consoleListTenantCashVariancePolicyRevisions: (...a: unknown[]) => list(...a),
    consolePublishTenantCashVariancePolicy: (...a: unknown[]) => publish(...a),
  };
});

import { TenantPolicySection } from "@/cash-policy/TenantPolicySection";
import { setLocale } from "@/i18n/locale";
import {
  REV_1,
  REV_2,
  USER_A,
  apiError,
  limitTenantRead,
  renderWithQuery,
  revision,
  systemTenantRead,
} from "./cash-policy-fixtures";

const emptyPage = { status: 200, data: { items: [], nextCursor: null } };

function mount() {
  return renderWithQuery(<TenantPolicySection tenantId="t1" />);
}

function field(label: string): HTMLElement {
  const row = screen.getByText(label, { selector: ".field-row__label" }).closest(".field-row");
  if (!row) throw new Error(`no field row for ${label}`);
  return row as HTMLElement;
}

/**
 * RT-389 tenant default (AD-CASH-001 F6): view the default (`none`, or `limit`
 * with amount and currency), change it with Apply Now, owner / tenant_admin
 * only. The server resolves and refuses; the UI renders what it returns.
 */
describe("TenantPolicySection", () => {
  beforeEach(() => {
    role.current = "owner";
    role.activeTenant = "t1";
    get.mockReset();
    list.mockReset();
    publish.mockReset();
    list.mockResolvedValue(emptyPage);
    setLocale("en");
  });

  test("shows a never-set tenant as the system default none", async () => {
    get.mockResolvedValue({ status: 200, data: systemTenantRead });
    mount();
    expect(await screen.findByRole("heading", { name: "Shift variance policy" })).toBeDefined();
    await screen.findByText("Current default", { selector: ".field-row__label" });
    const current = field("Current default");
    expect(current.textContent).toContain("No approval needed: the cashier closes alone");
    expect(field("Source").textContent).toContain("System default");
    expect(get).toHaveBeenCalledWith("t1");
  });

  test("shows a limit with the amount and currency in the UX-12 money format", async () => {
    get.mockResolvedValue({ status: 200, data: limitTenantRead });
    mount();
    const current = await screen.findByText("Current default");
    expect(current.closest(".field-row")?.textContent).toContain(
      "Approval needed when the variance is over 1,250.00 EGP",
    );
    expect(field("Source").textContent).toContain("Tenant default");
    expect(field("Reason").textContent).toContain("Quarterly review");
  });

  test("an owner and a tenant_admin see the form; the currency is a fixed EGP", async () => {
    for (const r of ["owner", "tenant_admin"]) {
      role.current = r;
      get.mockResolvedValue({ status: 200, data: limitTenantRead });
      const { unmount } = mount();
      expect(await screen.findByRole("button", { name: "Apply now" })).toBeDefined();
      const currency = screen.getByLabelText("Currency") as HTMLInputElement;
      expect(currency.value).toBe("EGP");
      expect(currency.readOnly).toBe(true);
      unmount();
    }
  });

  test.each(["store_manager", "cashier", "platform_admin", undefined])(
    "role %s sees nothing and nothing is requested",
    async (r) => {
      role.current = r as string;
      get.mockResolvedValue({ status: 200, data: limitTenantRead });
      const { container } = mount();
      await Promise.resolve();
      expect(container.textContent).toBe("");
      expect(get).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
    },
  );

  test("another tenant than the active one renders nothing (the API would 404)", async () => {
    role.activeTenant = "other";
    const { container } = mount();
    await Promise.resolve();
    expect(container.textContent).toBe("");
    expect(get).not.toHaveBeenCalled();
  });

  test("a non-disclosing 404 renders the unavailable copy, no form", async () => {
    get.mockResolvedValue({ status: 404, error: apiError("not_found") });
    mount();
    expect(
      await screen.findByText("The shift variance policy is not available to you."),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Apply now" })).toBeNull();
  });

  test("a 200 whose body is not a tenant policy is a load failure, not a crash", async () => {
    get.mockResolvedValue({ status: 200, data: {} });
    mount();
    expect(await screen.findByText("The policy could not be loaded.")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Apply now" })).toBeNull();
  });

  test("a 500 offers a retry that reads again", async () => {
    get.mockResolvedValueOnce({ status: 500, error: apiError("internal_error", "req-500") });
    get.mockResolvedValueOnce({ status: 200, data: limitTenantRead });
    mount();
    expect(await screen.findByText("The policy could not be loaded.")).toBeDefined();
    expect(screen.getByText(/req-500/)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("button", { name: "Apply now" })).toBeDefined();
  });

  test("validation: a blank reason and a bad amount block the request", async () => {
    get.mockResolvedValue({ status: 200, data: systemTenantRead });
    mount();
    fireEvent.click(await screen.findByLabelText(/^Limit: approval needed/));
    fireEvent.change(screen.getByLabelText("Variance limit"), { target: { value: "12.345" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    expect(await screen.findByText("Enter a reason for the change.")).toBeDefined();
    expect(screen.getByText(/Enter a valid amount with at most two decimal places/)).toBeDefined();
    expect(publish).not.toHaveBeenCalled();
  });

  test("Apply Now sends only contract fields with the read's latestRevisionId and an idempotency key", async () => {
    get.mockResolvedValue({ status: 200, data: limitTenantRead });
    const updated = {
      tenantDefault: {
        policySource: "tenant",
        policyRevisionId: REV_2,
        policyValue: { mode: "limit", limitAmount: "800.50", currencyCode: "EGP" },
      },
      latestRevision: revision({
        revisionId: REV_2,
        reason: "Tighten",
        policyValue: { mode: "limit", limitAmount: "800.50", currencyCode: "EGP" },
        supersedesRevisionId: REV_1,
      }),
      latestRevisionId: REV_2,
    };
    publish.mockResolvedValue({ status: 201, data: updated, headers: new Headers() });
    mount();
    await screen.findByRole("button", { name: "Apply now" });
    fireEvent.change(screen.getByLabelText("Variance limit"), { target: { value: "800.50" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "  Tighten  " } });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));

    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    const [tenantId, body, key] = publish.mock.calls[0];
    expect(tenantId).toBe("t1");
    expect(body).toEqual({
      expectedRevisionId: REV_1,
      policyValue: { mode: "limit", limitAmount: "800.50", currencyCode: "EGP" },
      reason: "Tighten",
    });
    expect(key).toMatch(/^[\x21-\x7E]{16,128}$/);
    expect(await screen.findByText("The policy was applied.")).toBeDefined();
    // The 201 body is the updated read: the new default shows without another GET.
    expect(field("Current default").textContent).toContain("800.50 EGP");
    expect(get).toHaveBeenCalledTimes(1);
  });

  test("switching to none sends no amount or currency; a never-set tenant sends a null token", async () => {
    get.mockResolvedValue({ status: 200, data: systemTenantRead });
    publish.mockResolvedValue({ status: 201, data: limitTenantRead, headers: new Headers() });
    mount();
    await screen.findByRole("button", { name: "Apply now" });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Reset" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(publish.mock.calls[0][1]).toEqual({
      expectedRevisionId: null,
      policyValue: { mode: "none" },
      reason: "Reset",
    });
  });

  test("409 changed concurrently: refresh-and-retry message, draft kept, Refresh re-reads", async () => {
    get.mockResolvedValueOnce({ status: 200, data: limitTenantRead });
    publish.mockResolvedValueOnce({
      status: 409,
      error: apiError("cash_variance_policy_changed_concurrently", "req-409"),
      headers: new Headers(),
    });
    mount();
    await screen.findByRole("button", { name: "Apply now" });
    fireEvent.change(screen.getByLabelText("Variance limit"), { target: { value: "900" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Mine" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "Someone else changed the policy. Refresh to see the latest version, then try again.",
    );
    expect(alert.textContent).toContain("req-409");
    expect((screen.getByLabelText("Reason") as HTMLInputElement).value).toBe("Mine");
    expect((screen.getByLabelText("Variance limit") as HTMLInputElement).value).toBe("900");

    get.mockResolvedValueOnce({
      status: 200,
      data: { ...limitTenantRead, latestRevisionId: REV_2 },
    });
    fireEvent.click(within(alert).getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    // The draft survives the refresh, and the retry uses the new token.
    expect((screen.getByLabelText("Reason") as HTMLInputElement).value).toBe("Mine");
    publish.mockResolvedValueOnce({ status: 201, data: limitTenantRead, headers: new Headers() });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2));
    expect(publish.mock.calls[1][1].expectedRevisionId).toBe(REV_2);
    expect(publish.mock.calls[1][2]).not.toBe(publish.mock.calls[0][2]);
  });

  test("422 currency refusal shows its own copy", async () => {
    get.mockResolvedValue({ status: 200, data: limitTenantRead });
    publish.mockResolvedValue({
      status: 422,
      error: apiError("policy_currency_unsupported"),
      headers: new Headers(),
    });
    mount();
    await screen.findByRole("button", { name: "Apply now" });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    expect(
      await screen.findByText("That currency is not supported. Only EGP is available."),
    ).toBeDefined();
  });

  test("a retry of the same body after a 5xx reuses the idempotency key", async () => {
    get.mockResolvedValue({ status: 200, data: limitTenantRead });
    publish.mockResolvedValueOnce({
      status: 500,
      error: apiError("internal_error"),
      headers: new Headers(),
    });
    publish.mockResolvedValueOnce({ status: 201, data: limitTenantRead, headers: new Headers() });
    mount();
    await screen.findByRole("button", { name: "Apply now" });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Apply now" }));
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2));
    expect(publish.mock.calls[1][2]).toBe(publish.mock.calls[0][2]);
  });

  test("history lists revisions newest first and loads more with the cursor", async () => {
    get.mockResolvedValue({ status: 200, data: limitTenantRead });
    list.mockResolvedValueOnce({
      status: 200,
      data: {
        items: [
          revision({
            reason: "Second",
            revisionId: REV_2,
            state: "current",
            supersedesRevisionId: REV_1,
          }),
        ],
        nextCursor: "abc_123",
      },
    });
    list.mockResolvedValueOnce({
      status: 200,
      data: {
        items: [revision({ reason: "First", state: "superseded" })],
        nextCursor: null,
      },
    });
    mount();
    const table = await screen.findByRole("table", {
      name: "Shift variance policy revisions, newest first",
    });
    expect(within(table).getByText("Second")).toBeDefined();
    expect(within(table).getByText("Current")).toBeDefined();
    expect(within(table).getAllByText(USER_A).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await within(table).findByText("First")).toBeDefined();
    expect(list).toHaveBeenLastCalledWith("t1", expect.objectContaining({ cursor: "abc_123" }));
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  test("history shows an empty state", async () => {
    get.mockResolvedValue({ status: 200, data: systemTenantRead });
    mount();
    expect(await screen.findByText("No revisions yet.")).toBeDefined();
  });

  test("Arabic: the section, the value and the form speak Arabic", async () => {
    setLocale("ar");
    get.mockResolvedValue({ status: 200, data: limitTenantRead });
    mount();
    expect(await screen.findByRole("heading", { name: "سياسة فرق الوردية" })).toBeDefined();
    expect(await screen.findByText("1,250.00 EGP")).toBeDefined();
    expect(field("الافتراضي الحالي").textContent).toContain("يلزم اعتماد عند تجاوز الفرق");
    expect(screen.getByRole("button", { name: "تطبيق الآن" })).toBeDefined();
  });
});
