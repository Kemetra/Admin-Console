import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const consoleListReceivables = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, consoleListReceivables: (...a: unknown[]) => consoleListReceivables(...a) };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { ReceivableList } from "@/receivables/ReceivableList";

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
      <ReceivableList />
    </Tree>,
  );
}

const withTenant = { context: { active_tenant: { id: "t1", name: "Northstar Retail" } } };

function receivable(over: Record<string, unknown> = {}) {
  return {
    receivableRef: "r1",
    saleRef: "s1",
    payerRef: "p1",
    outstandingBalance: "120.00",
    state: "open",
    erpnextPaymentEntryRef: null,
    version: 0,
    ...over,
  };
}

/**
 * 018 ReceivableList state matrix (VG-1). Table of receivables (outstanding
 * balance formatted from the exact-decimal Money string as `1,250.00 EGP` —
 * RT-399, no float; localized state badge; ERP
 * Payment-Entry "not posted" when null). No active tenant → scope prompt (wrapper
 * never called). 403 → banner. Empty → zero-state.
 */
describe("ReceivableList", () => {
  beforeEach(() => {
    consoleListReceivables.mockReset();
    activeContext.mockReset();
  });

  test("no active tenant -> scope prompt, wrapper NOT called", async () => {
    activeContext.mockReturnValue({ context: { active_tenant: null } });
    renderList();
    expect(await screen.findByText(/select a tenant/i)).toBeDefined();
    expect(consoleListReceivables).not.toHaveBeenCalled();
  });

  test("active tenant + receivables -> table with formatted balance + state label", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListReceivables.mockResolvedValue({
      status: 200,
      data: {
        items: [
          receivable(),
          receivable({ receivableRef: "r2", outstandingBalance: "0.00", state: "settled" }),
        ],
        nextCursor: null,
      },
    });
    renderList();
    expect(await screen.findByText("120.00 EGP")).toBeDefined();
    expect(screen.getByText("0.00 EGP")).toBeDefined();
    const badges = screen.getAllByText((_, el) => el?.classList.contains("badge") ?? false);
    const badgeText = badges.map((b) => b.textContent);
    expect(badgeText).toEqual(["Open", "Settled"]);
  });

  test("a large balance formats exactly from the string (no float rounding), LTR-isolated", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListReceivables.mockResolvedValue({
      status: 200,
      // numeric(19,4) maximum: Number() would round this to 1e15.
      data: {
        items: [receivable({ outstandingBalance: "999999999999999.9999" })],
        nextCursor: null,
      },
    });
    renderList();
    const cell = await screen.findByText("999,999,999,999,999.9999 EGP");
    expect(cell.tagName).toBe("BDI");
    expect(cell.getAttribute("dir")).toBe("ltr");
    expect(screen.queryByText(/1,000,000,000,000,000/)).toBeNull();
  });

  test("an unknown lifecycle state renders the localized fallback, not the raw code", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListReceivables.mockResolvedValue({
      status: 200,
      data: { items: [receivable({ state: "reversal_consumed" })], nextCursor: null },
    });
    renderList();
    expect(await screen.findByText("Unknown state")).toBeDefined();
    expect(screen.queryByText("reversal_consumed")).toBeNull();
  });

  test("erpnextPaymentEntryRef null -> 'not posted' shown", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListReceivables.mockResolvedValue({
      status: 200,
      data: { items: [receivable({ erpnextPaymentEntryRef: null })], nextCursor: null },
    });
    renderList();
    expect(await screen.findByText(/not posted/i)).toBeDefined();
  });

  test("empty -> zero-receivables state", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListReceivables.mockResolvedValue({
      status: 200,
      data: { items: [], nextCursor: null },
    });
    renderList();
    expect(await screen.findByText(/no receivables/i)).toBeDefined();
  });

  test("403 -> forbidden banner", async () => {
    activeContext.mockReturnValue(withTenant);
    consoleListReceivables.mockResolvedValue({
      status: 403,
      error: { error: { request_id: "req-403" } },
    });
    renderList();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/req-403/)).toBeDefined();
  });

  test("Arabic: heading, columns, state label and row actions render in Arabic only", async () => {
    setLocale("ar");
    activeContext.mockReturnValue(withTenant);
    consoleListReceivables.mockResolvedValue({
      status: 200,
      data: { items: [receivable({ outstandingBalance: "1250.0000" })], nextCursor: null },
    });
    renderList();
    expect(await screen.findByRole("button", { name: "تخصيص دفعة" })).toBeDefined();
    expect(screen.getByRole("button", { name: "تقديم مطالبة" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "الذمم المدينة" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "المبلغ المستحق" })).toBeDefined();
    expect(screen.getByText("مفتوحة")).toBeDefined();
    expect(screen.getByText("لم يُرحَّل")).toBeDefined();
    // Money keeps Western digits and the EGP code in Arabic (UX-12).
    expect(screen.getByText("1,250.00 EGP")).toBeDefined();
    expect(screen.queryByText("Receivables")).toBeNull();
    expect(screen.queryByText(/not posted/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /apply payment/i })).toBeNull();
  });
});
