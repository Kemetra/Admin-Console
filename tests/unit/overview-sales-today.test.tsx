import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-820 Overview P-6 (spec 009 OD-009-1 / AC-11): today's received sales per
 * store, as text. The summary read and the store roster are mocked; everything
 * else on the Overview answers quietly.
 */
const consoleGetSalesSummary = vi.fn();
vi.mock("@/lib/sales-summary-queries", () => ({
  consoleGetSalesSummary: (...a: unknown[]) => consoleGetSalesSummary(...a),
}));
vi.mock("@/lib/stock-discrepancy-queries", () => ({
  listErpnextNegativeOnHandStores: () => Promise.resolve({ status: 200, data: { items: [] } }),
}));
vi.mock("@/lib/shift-close-queries", () => ({
  consoleListShiftCloses: () => Promise.resolve({ status: 200, data: { items: [] } }),
}));
vi.mock("@/lib/unknown-items-queries", () => ({
  listUnknownItems: () => Promise.resolve({ status: 200, data: { items: [] } }),
}));
vi.mock("@/lib/client", () => ({ listAuditEvents: vi.fn() }));
const storeRows = vi.fn();
vi.mock("@/stores/useStoreQueries", () => ({
  useStoreList: () => ({ result: { kind: "rows", rows: storeRows() }, isLoading: false }),
  useStoreDetail: () => ({ result: undefined, isLoading: false }),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { Overview } from "@/shell/Overview";
import { KPIS, ZERO_KPIS } from "./metric-claim-fixtures";

const A = "0190f000-0000-7000-8000-0000000000a1";
const B = "0190f000-0000-7000-8000-0000000000a2";
const C = "0190f000-0000-7000-8000-0000000000a3";
const NOW = "2026-10-15T22:30:00Z"; // Oct 16 in Cairo, Oct 15 in UTC
const ASOF = "2026-10-15T22:29:00Z";
const WINDOW = ["2026-10-14", "2026-10-15", "2026-10-16"];

type Kpis = typeof KPIS;

function store(ref: string, zone: string, current: string, days: Record<string, Kpis>) {
  return {
    storeRef: ref,
    storeTimezone: zone,
    currentBusinessDate: current,
    days: Object.entries(days).map(([businessDate, kpis]) => ({ businessDate, kpis })),
    rangeTotals: ZERO_KPIS,
  };
}

function everyDay(kpis: Kpis): Record<string, Kpis> {
  return Object.fromEntries(WINDOW.map((d) => [d, kpis]));
}

function summary(stores: unknown[], over: Record<string, unknown> = {}) {
  return {
    scope: "all_in_scope",
    storeRef: null,
    from: WINDOW[0],
    to: WINDOW[2],
    asOf: ASOF,
    completeness: "received_only",
    stores,
    nextCursor: null,
    scopeTotals: {
      storeCount: stores.length,
      days: WINDOW.map((businessDate) => ({ businessDate, kpis: KPIS })),
      rangeTotals: ZERO_KPIS,
    },
    ...over,
  };
}

const ok = (data: unknown) => Promise.resolve({ status: 200, data });
const answer = (data: unknown) => consoleGetSalesSummary.mockImplementation(() => ok(data));

function ctx(role = "owner", store: { id: string; name: string } | null = null) {
  return {
    context: {
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: store,
      active_role_code: role,
    },
  };
}

function renderOverview(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function panel(): Promise<HTMLElement> {
  const heading = await screen.findByRole("heading", { name: "Today's received sales" });
  return heading.closest("section") as HTMLElement;
}

async function rowOf(section: HTMLElement, name: string): Promise<HTMLElement> {
  const found = await within(section).findAllByText(name, { selector: "bdi" });
  const li = found[0].closest("li");
  if (!li) throw new Error(`no row for ${name}`);
  return li as HTMLElement;
}

describe("Overview P-6, today's received sales (RT-820)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    consoleGetSalesSummary.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    storeRows.mockReturnValue([
      { id: A, name: "Cairo Festival City", timezone: "Africa/Cairo" },
      { id: B, name: "Lisbon Chiado", timezone: "UTC" },
    ]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("mixed dates: each store at its own date, no scope total", async () => {
    const lastNight = { ...KPIS, receivedSales: { count: 5, byCurrency: [] } };
    answer(
      summary([
        store(A, "Africa/Cairo", "2026-10-16", { ...everyDay(lastNight), "2026-10-16": KPIS }),
        store(B, "UTC", "2026-10-15", { ...everyDay(lastNight), "2026-10-15": lastNight }),
      ]),
    );
    renderOverview();
    const section = await panel();
    const cairo = await rowOf(section, "Cairo Festival City");
    expect(await within(cairo).findByText("14")).toBeTruthy();
    expect(within(cairo).getByText(/1,250\.50/)).toBeTruthy();
    expect(within(cairo).getByText(/Business day/).textContent).toContain("Oct");
    const lisbon = await rowOf(section, "Lisbon Chiado");
    expect(within(lisbon).getByText("5")).toBeTruthy();
    expect(within(section).queryByText("All stores in scope")).toBeNull();
    expect(within(section).getByText(/different business days/)).toBeTruthy();
  });

  test("one shared date shows the server's scope total with no link", async () => {
    answer(
      summary([
        store(A, "Africa/Cairo", "2026-10-16", everyDay(KPIS)),
        store(B, "Asia/Dubai", "2026-10-16", everyDay(KPIS)),
      ]),
    );
    renderOverview();
    const section = await panel();
    const total = (await within(section).findByText("All stores in scope")).closest(
      "li",
    ) as HTMLElement;
    expect(within(total).queryByRole("link")).toBeNull();
    expect(within(total).getByText("14")).toBeTruthy();
    expect(within(section).queryByText(/different business days/)).toBeNull();
  });

  test("a date missing from days[] is unknown, never zero", async () => {
    answer(
      summary([
        store(A, "Africa/Cairo", "2026-10-16", { "2026-10-14": KPIS, "2026-10-15": KPIS }),
        store(B, "UTC", "2026-10-15", { "2026-10-15": ZERO_KPIS }),
      ]),
    );
    renderOverview();
    const section = await panel();
    const cairo = await rowOf(section, "Cairo Festival City");
    expect(await within(cairo).findByText("Unknown")).toBeTruthy();
    expect(within(cairo).queryByText("0")).toBeNull();
    // A real zero is a figure, not unknown.
    const lisbon = await rowOf(section, "Lisbon Chiado");
    expect(within(lisbon).getByText("0")).toBeTruthy();
    expect(within(lisbon).queryByText("Unknown")).toBeNull();
  });

  test("drill-down is per store row, with that store's store, from and to", async () => {
    answer(
      summary([
        store(A, "Africa/Cairo", "2026-10-16", everyDay(KPIS)),
        store(B, "UTC", "2026-10-15", everyDay(KPIS)),
      ]),
    );
    renderOverview();
    const section = await panel();
    const links = (await within(section).findAllByRole("link", { name: /View store sales/ })).map(
      (l) => l.getAttribute("href"),
    );
    expect(links).toEqual([
      `/sales?store=${A}&from=2026-10-16&to=2026-10-16`,
      `/sales?store=${B}&from=2026-10-15&to=2026-10-15`,
    ]);
  });

  test("an unresolved name is the machine ref in a bdi, and figures still show", async () => {
    storeRows.mockReturnValue([{ id: A, name: "Cairo Festival City", timezone: "Africa/Cairo" }]);
    answer(
      summary([
        store(A, "Africa/Cairo", "2026-10-16", everyDay(KPIS)),
        store(C, "UTC", "2026-10-15", everyDay(KPIS)),
      ]),
    );
    renderOverview();
    const section = await panel();
    const ref = await within(section).findAllByText(C, { selector: "bdi" });
    expect(ref[0].getAttribute("dir")).toBe("ltr");
    expect(within(await rowOf(section, C)).getByText("14")).toBeTruthy();
  });

  test("one page, no walk: a further page shows a link, and exactly one read", async () => {
    answer(summary([store(A, "Africa/Cairo", "2026-10-16", everyDay(KPIS))], { nextCursor: "c2" }));
    renderOverview();
    const section = await panel();
    expect(await within(section).findByText(/first page of stores/)).toBeTruthy();
    expect(within(section).getByRole("link", { name: "Open sales" }).getAttribute("href")).toBe(
      "/sales",
    );
    expect(consoleGetSalesSummary).toHaveBeenCalledTimes(1);
    expect(consoleGetSalesSummary.mock.calls[0][0]).toEqual({
      from: "2026-10-14",
      to: "2026-10-16",
      page_size: 50,
    });
    expect(within(section).queryByText("All stores in scope")).toBeNull();
  });

  test("an active store narrows the read to that store", async () => {
    activeContext.mockReturnValue(ctx("owner", { id: A, name: "Cairo Festival City" }));
    answer(
      summary([store(A, "Africa/Cairo", "2026-10-16", everyDay(KPIS))], {
        scope: "store",
        storeRef: A,
      }),
    );
    renderOverview();
    await panel();
    expect(consoleGetSalesSummary).toHaveBeenCalledWith(expect.objectContaining({ store_id: A }));
  });

  test("a refusal omits the panel", async () => {
    consoleGetSalesSummary.mockImplementation(() => Promise.resolve({ status: 404 }));
    renderOverview();
    await waitFor(() => expect(consoleGetSalesSummary).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Today's received sales" })).toBeNull(),
    );
  });

  test("a failed read is a notice with retry, not zero", async () => {
    consoleGetSalesSummary.mockImplementation(() =>
      Promise.resolve({ status: 500, error: { error: { request_id: "r1" } } }),
    );
    renderOverview();
    const section = await panel();
    expect(await within(section).findByRole("alert")).toBeTruthy();
    expect(within(section).getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(within(section).queryByText("0")).toBeNull();
  });

  test("a role that cannot read sales never reads", async () => {
    activeContext.mockReturnValue(ctx("auditor"));
    renderOverview();
    await screen.findByRole("heading", { level: 1 });
    expect(consoleGetSalesSummary).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Today's received sales" })).toBeNull();
  });

  test("Arabic renders the same panel", async () => {
    answer(summary([store(A, "Africa/Cairo", "2026-10-16", everyDay(KPIS))]));
    act(() => setLocale("ar"));
    try {
      renderOverview();
      expect(await screen.findByRole("heading", { name: "المبيعات المستلمة اليوم" })).toBeTruthy();
    } finally {
      act(() => setLocale("en"));
    }
  });
});
