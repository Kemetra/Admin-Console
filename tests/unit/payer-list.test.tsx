import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const consoleListPayerAccounts = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    consoleListPayerAccounts: (...a: unknown[]) => consoleListPayerAccounts(...a),
  };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));
const storeRows = vi.fn();
vi.mock("@/stores/useStoreQueries", () => ({
  useStoreList: (tenantId: string | null) => ({
    result: tenantId ? { kind: "rows", rows: storeRows() } : undefined,
    isLoading: false,
  }),
}));

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { PayerList } from "@/payers/PayerList";

function renderList(): void {
  const qc = createQueryClient();
  function Tree({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  render(
    <Tree>
      <PayerList />
    </Tree>,
  );
}

const withTenant = {
  context: {
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: null,
    active_role_code: "tenant_admin",
    memberships: [{ tenant_id: "t1" }],
  },
};
const asRole = (role: string) => ({
  context: { ...withTenant.context, active_role_code: role },
});

function payer(over: Record<string, unknown> = {}) {
  return {
    payerRef: "p1",
    category: "insurer",
    displayName: "MedCover Insurance",
    externalRef: "INS-99",
    status: "active",
    storeId: null,
    version: 0,
    ...over,
  };
}

/**
 * 017 PayerList state matrix (VG-1). Renders payer accounts as a table
 * (displayName, category, status). No active tenant → scope prompt, wrapper NOT
 * called (pre-call guard). 403/other → banner. Empty → empty state with Create
 * action. status is display-only (OQ-CON-EDIT deferred).
 */
describe("PayerList", () => {
  beforeEach(() => {
    consoleListPayerAccounts.mockReset();
    activeContext.mockReset();
    storeRows.mockReturnValue([{ id: "s1", name: "Cairo Festival City" }]);
  });

  test.each(["store_manager", "store_staff", "cashier", "auditor"])(
    "RT-421: %s who opens /payer-accounts sees no payer surface and nothing is requested",
    async (role) => {
      activeContext.mockReturnValue(asRole(role));
      renderList();
      expect(await screen.findByText("No assigned access")).toBeDefined();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByRole("button", { name: /create payer/i })).toBeNull();
      expect(consoleListPayerAccounts).not.toHaveBeenCalled();
    },
  );

  test.each(["owner", "tenant_admin"])("RT-421: %s reads the payer list", async (role) => {
    activeContext.mockReturnValue(asRole(role));
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: { items: [payer()], nextCursor: null },
    });
    renderList();
    expect(await screen.findByText("MedCover Insurance")).toBeDefined();
  });

  test("no active tenant -> scope prompt, wrapper NOT called (pre-call guard)", async () => {
    activeContext.mockReturnValue({ context: { active_tenant: null } });
    renderList();
    expect(await screen.findByText(/select a tenant/i)).toBeDefined();
    expect(consoleListPayerAccounts).not.toHaveBeenCalled();
  });

  test("active tenant + payers -> table with displayName, category + status labels", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: {
        items: [
          payer(),
          payer({
            payerRef: "p2",
            displayName: "Acme Corp",
            category: "corporate",
            status: "suspended",
          }),
        ],
        nextCursor: null,
      },
    });
    renderList();
    expect(await screen.findByText("MedCover Insurance")).toBeDefined();
    expect(screen.getByText("Acme Corp")).toBeDefined();
    // Category + status render as badges in the table cells. Scope to the badge
    // elements so the page subtitle ("…corporate & insurer payers…") does not
    // false-match the category assertion. RT-399: the raw codes render as
    // catalog labels, never verbatim.
    const badges = screen.getAllByText((_, el) => el?.classList.contains("badge") ?? false);
    const badgeText = badges.map((b) => b.textContent);
    expect(badgeText).toEqual(["Insurer", "Active", "Corporate", "Suspended"]);
    expect(badgeText).not.toContain("insurer");
    expect(badgeText).not.toContain("suspended");
  });

  test("an unknown upstream category renders the localized fallback, not the raw code", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: { items: [payer({ category: "patient_plan" })], nextCursor: null },
    });
    renderList();
    expect(await screen.findByText("Unknown category")).toBeDefined();
    expect(screen.queryByText("patient_plan")).toBeNull();
  });

  test("Arabic: heading, create action, columns and labels render in Arabic only", async () => {
    setLocale("ar");
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: { items: [payer({ status: "suspended" })], nextCursor: null },
    });
    renderList();
    expect(await screen.findByRole("button", { name: "إضافة جهة دفع" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "حسابات جهات الدفع" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "الفئة" })).toBeDefined();
    expect(screen.getByText("شركة تأمين")).toBeDefined();
    expect(screen.getByText("موقوف")).toBeDefined();
    // The tenant name stays as authored, isolated inside the Arabic sentence.
    expect(screen.getByText("Northstar Retail").tagName).toBe("BDI");
    expect(screen.queryByText("Payer accounts")).toBeNull();
    expect(screen.queryByRole("button", { name: /create payer/i })).toBeNull();
  });

  test("scope column: a tenant-wide payer (storeId null) and a store-scoped payer read differently", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: {
        items: [
          payer({ payerRef: "p1" }),
          payer({ payerRef: "p2", displayName: "Acme Corp", storeId: "s1" }),
          payer({ payerRef: "p3", displayName: "Delta Co", storeId: "s-unknown" }),
        ],
        nextCursor: null,
      },
    });
    renderList();
    await screen.findByText("MedCover Insurance");
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getByText("Whole tenant")).toBeDefined();
    expect(within(rows[1]).getByText("Cairo Festival City")).toBeDefined();
    // A store the roster does not list is "one store", never its raw id.
    expect(within(rows[2]).getByText("One store")).toBeDefined();
    expect(screen.queryByText("s-unknown")).toBeNull();
  });

  test("externalRef is labelled as the ERPNext Customer link; an unlinked payer says so", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: {
        items: [payer(), payer({ payerRef: "p2", displayName: "Acme Corp", externalRef: null })],
        nextCursor: null,
      },
    });
    renderList();
    expect(await screen.findByRole("columnheader", { name: "ERPNext Customer" })).toBeDefined();
    expect(screen.getByText("INS-99")).toBeDefined();
    expect(screen.getByText("Not linked")).toBeDefined();
    expect(screen.queryByRole("columnheader", { name: /credit/i })).toBeNull();
  });

  test("Load more appears only while the cursor is non-null and walks to the next page", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockImplementation((q: { cursor?: string }) =>
      Promise.resolve(
        q?.cursor === "CUR1"
          ? {
              status: 200,
              data: {
                items: [payer({ payerRef: "p2", displayName: "Acme Corp" })],
                nextCursor: null,
              },
            }
          : { status: 200, data: { items: [payer()], nextCursor: "CUR1" } },
      ),
    );
    renderList();
    await screen.findByText("MedCover Insurance");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Acme Corp")).toBeDefined();
    expect(screen.getByText("MedCover Insurance")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  test("an empty page with a non-null cursor is NOT the empty state: it offers Load more", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockImplementation((q: { cursor?: string }) =>
      Promise.resolve(
        q?.cursor === "CUR1"
          ? { status: 200, data: { items: [payer()], nextCursor: null } }
          : { status: 200, data: { items: [], nextCursor: "CUR1" } },
      ),
    );
    renderList();
    expect(await screen.findByText(/no payer accounts on this page yet/i)).toBeDefined();
    expect(screen.queryByText("No payer accounts in this tenant yet.")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("MedCover Insurance")).toBeDefined();
  });

  test("a failed Load more keeps the rows already shown and says the list could not be loaded", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockImplementation((q: { cursor?: string }) =>
      Promise.resolve(
        q?.cursor === "CUR1"
          ? { status: 400, error: { error: { message: "bad cursor", request_id: "req-c" } } }
          : { status: 200, data: { items: [payer()], nextCursor: "CUR1" } },
      ),
    );
    renderList();
    await screen.findByText("MedCover Insurance");
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("Payer accounts could not be loaded.")).toBeDefined();
    expect(screen.getByText("MedCover Insurance")).toBeDefined();
    expect(screen.queryByText(/bad cursor/)).toBeNull();
  });

  test.each([400, 404, 422])(
    "%s -> one generic message; the server's words never show",
    async (status) => {
      activeContext.mockReturnValue(withTenant);
      consoleListPayerAccounts.mockResolvedValue({
        status,
        error: { error: { code: "secret_code", message: "secret cause", request_id: "req-x" } },
      });
      renderList();
      expect(await screen.findByText("Payer accounts could not be loaded.")).toBeDefined();
      expect(screen.queryByText(/secret/)).toBeNull();
      expect(screen.queryByText(/No payer accounts in this tenant yet/)).toBeNull();
    },
  );

  test("401 -> the session-expired words (the interceptor owns the redirect)", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockResolvedValue({ status: 401, error: { error: {} } });
    renderList();
    expect(await screen.findByText("Your session has expired. Sign in again.")).toBeDefined();
  });

  test("the Create action stays available once payers are listed", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: { items: [payer()], nextCursor: null },
    });
    renderList();
    await screen.findByText("MedCover Insurance");
    expect(screen.getByRole("button", { name: /create payer/i })).toBeDefined();
  });

  test("empty -> zero-payers state with the Create action", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: { items: [], nextCursor: null },
    });
    renderList();
    expect(await screen.findByText(/no payer accounts/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /create payer/i })).toBeDefined();
  });

  test("403 -> forbidden banner", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListPayerAccounts.mockResolvedValue({
      status: 403,
      error: { error: { request_id: "req-403" } },
    });
    renderList();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/req-403/)).toBeDefined();
  });
});
