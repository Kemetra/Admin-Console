import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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

const withTenant = { context: { active_tenant: { id: "t1", name: "Northstar Retail" } } };

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
