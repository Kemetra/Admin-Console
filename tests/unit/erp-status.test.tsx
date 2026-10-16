import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  domain,
  INSTANCE_A,
  INSTANCE_B,
  STORE_A,
  backlogItem,
  healthView,
  instance,
  run,
} from "./erp-status-fixtures";

const api = {
  tenantAdminListConnectorInstances: vi.fn(),
  listConnectorHealth: vi.fn(),
  consoleGetSyncOpsSummary: vi.fn(),
  consoleListPostingBacklog: vi.fn(),
  consoleListReconciliationRuns: vi.fn(),
};
vi.mock("@/lib/erp-status-queries", () => ({
  tenantAdminListConnectorInstances: (...a: unknown[]) =>
    api.tenantAdminListConnectorInstances(...a),
  listConnectorHealth: (...a: unknown[]) => api.listConnectorHealth(...a),
  consoleGetSyncOpsSummary: (...a: unknown[]) => api.consoleGetSyncOpsSummary(...a),
  consoleListPostingBacklog: (...a: unknown[]) => api.consoleListPostingBacklog(...a),
  consoleListReconciliationRuns: (...a: unknown[]) => api.consoleListReconciliationRuns(...a),
}));
const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listStores: (...a: unknown[]) => listStores(...a) };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { ErpStatus } from "@/erp-status/ErpStatus";
import { createQueryClient } from "@/lib/query";

function ctx(role: string | null = "owner", tenant: { id: string; name: string } | null = null) {
  const active = tenant === null ? { id: "t1", name: "Northstar Retail" } : tenant;
  return {
    context: {
      user: { id: "u1", display_name: "Amal Saleh" },
      active_tenant: role === "no-tenant" ? null : active,
      active_store: null,
      active_role_code: role === "no-tenant" ? "owner" : role,
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
    },
    switchTenant: vi.fn(),
    switchStore: vi.fn(),
    clearStore: vi.fn(),
  };
}

const ok = <T,>(data: T) => ({ status: 200, data });
const failure = (status: number, requestId = "11111111-2222-4333-8444-555555555555") => ({
  status,
  error: { error: { code: "x", message: "x", request_id: requestId } },
});

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(entry = "/erp-connection"): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/erp-connection" element={<ErpStatus />} />
          <Route path="/stock-discrepancies/*" element={<LocationProbe />} />
          <Route path="/signin" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function panel(name: RegExp): HTMLElement {
  return screen.getByRole("region", { name });
}

async function connectionRow(name: string): Promise<HTMLElement> {
  return screen.findByRole("row", { name: new RegExp(name) });
}

/** Today's Backend-Core main: no heartbeat sender, so every instance is never_seen. */
function mainToday(): void {
  api.tenantAdminListConnectorInstances.mockResolvedValue(
    ok({
      items: [
        instance({ id: INSTANCE_A, display_name: "Cairo ERP" }),
        instance({ id: INSTANCE_B, display_name: "Giza ERP", environment: "prod" }),
      ],
    }),
  );
  api.listConnectorHealth.mockResolvedValue(
    ok({
      items: [
        healthView({ connectorId: INSTANCE_A, liveness: "never_seen" }),
        healthView({ connectorId: INSTANCE_B, liveness: "never_seen" }),
      ],
    }),
  );
  api.consoleGetSyncOpsSummary.mockResolvedValue(
    ok({
      domains: [
        domain({
          domain: "posting",
          status: "ok",
          headlineCount: 0,
          detail: "No posting dead-letters",
        }),
        domain({ domain: "reconciliation", status: "attention", headlineCount: 2, detail: null }),
        domain({ domain: "connector_health", status: "not_available", headlineCount: null }),
        domain({ domain: "product_master", status: "not_available", headlineCount: null }),
      ],
    }),
  );
  api.consoleListPostingBacklog.mockResolvedValue(ok({ items: [], nextCursor: null }));
  api.consoleListReconciliationRuns.mockResolvedValue(ok({ items: [run()], nextCursor: null }));
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  listStores.mockReset();
  activeContext.mockReset();
  activeContext.mockReturnValue(ctx());
  listStores.mockResolvedValue({
    status: 200,
    data: [{ id: STORE_A, name: "Maadi", code: "MAD", is_active: true }],
  });
  mainToday();
});

describe("role gate (A-6)", () => {
  test.each(["store_manager", "cashier", null])(
    "%s gets NoAccess and no ERP status request is made",
    async (role) => {
      activeContext.mockReturnValue(ctx(role));
      renderPage();
      expect(await screen.findByRole("heading", { name: /no assigned access/i })).toBeDefined();
      await new Promise((r) => setTimeout(r, 20));
      for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
      expect(listStores).not.toHaveBeenCalled();
    },
  );

  test("no active tenant: the scope prompt, and nothing is requested", async () => {
    activeContext.mockReturnValue(ctx("no-tenant"));
    renderPage();
    expect(await screen.findByText(/select a tenant/i)).toBeDefined();
    for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
  });
});

describe("connection panel (A-1, A-2, A-3)", () => {
  test("today's main: every instance reads no signal, with no error and nothing healthy", async () => {
    renderPage();
    const cairo = await connectionRow("Cairo ERP");
    const giza = await connectionRow("Giza ERP");
    for (const row of [cairo, giza]) {
      expect(within(row).getByText("No signal")).toBeDefined();
      expect(within(row).getByText("Never")).toBeDefined();
    }
    const connection = panel(/connector connection/i);
    expect(within(connection).queryByText("Connected")).toBeNull();
    expect(within(connection).queryByRole("alert")).toBeNull();
    expect(within(connection).getByText(/neither healthy nor an error/i)).toBeDefined();
    // The hollow dot marks "no signal".
    expect(cairo.querySelector(".erp-dot--hollow")).not.toBeNull();
  });

  test.each([
    ["healthy", "Connected"],
    ["stale", "Delayed"],
    ["disabled", "Disabled"],
    ["never_seen", "No signal"],
  ] as const)("liveness %s renders %s", async (liveness, label) => {
    api.tenantAdminListConnectorInstances.mockResolvedValue(
      ok({ items: [instance({ display_name: "Cairo ERP" })] }),
    );
    api.listConnectorHealth.mockResolvedValue(
      ok({
        items: [
          healthView({
            liveness,
            lastSeenAt: liveness === "never_seen" ? null : "2026-10-16T09:00:00Z",
            secondsSinceLastSeen: liveness === "never_seen" ? null : 437,
          }),
        ],
      }),
    );
    renderPage();
    const row = await connectionRow("Cairo ERP");
    expect(within(row).getByText(label)).toBeDefined();
    if (liveness === "stale") expect(within(row).getByText("7 minutes ago")).toBeDefined();
  });

  test("an instance with no C2 row reads no signal", async () => {
    api.listConnectorHealth.mockResolvedValue(ok({ items: [] }));
    renderPage();
    expect(within(await connectionRow("Cairo ERP")).getByText("No signal")).toBeDefined();
  });

  test("a failed C2 read: every instance at no signal, said plainly, never healthy", async () => {
    api.listConnectorHealth.mockResolvedValue(failure(500));
    renderPage();
    const row = await connectionRow("Cairo ERP");
    expect(within(row).getByText("No signal")).toBeDefined();
    expect(screen.getByText(/couldn't read the connection status/i)).toBeDefined();
    expect(within(panel(/connector connection/i)).queryByText("Connected")).toBeNull();
  });

  test("self-reported fields are labelled, with the report time; null is not reported", async () => {
    api.tenantAdminListConnectorInstances.mockResolvedValue(
      ok({
        items: [
          instance({ id: INSTANCE_A, display_name: "Cairo ERP" }),
          instance({ id: INSTANCE_B, display_name: "Giza ERP" }),
        ],
      }),
    );
    api.listConnectorHealth.mockResolvedValue(
      ok({
        items: [
          healthView({
            connectorId: INSTANCE_A,
            liveness: "healthy",
            lastSeenAt: "2026-10-16T09:00:00Z",
            secondsSinceLastSeen: 30,
            connectorVersion: "2.4.1",
            erpnextReachable: false,
            reportedFieldsAt: "2026-10-16T09:00:00Z",
          }),
          healthView({ connectorId: INSTANCE_B }),
        ],
      }),
    );
    renderPage();
    const cairo = await connectionRow("Cairo ERP");
    expect(
      screen.getByRole("columnheader", { name: "Version (reported by the connector)" }),
    ).toBeDefined();
    expect(
      screen.getByRole("columnheader", { name: "ERPNext reachable (reported by the connector)" }),
    ).toBeDefined();
    expect(within(cairo).getByText("2.4.1")).toBeDefined();
    expect(within(cairo).getByText("Not reachable")).toBeDefined();
    const reported = (_: string, el: Element | null) =>
      el?.tagName === "SMALL" && (el.textContent ?? "").startsWith("Reported ");
    expect(within(cairo).getAllByText(reported)).toHaveLength(2);
    const giza = await connectionRow("Giza ERP");
    expect(within(giza).getAllByText("Not reported")).toHaveLength(2);
  });

  test("no registered instance: the empty state", async () => {
    api.tenantAdminListConnectorInstances.mockResolvedValue(ok({ items: [] }));
    api.listConnectorHealth.mockResolvedValue(ok({ items: [] }));
    renderPage();
    expect(await screen.findByText(/no erpnext connector is registered/i)).toBeDefined();
  });

  test("a failed C1 read: an error banner with the request id and a retry", async () => {
    api.tenantAdminListConnectorInstances.mockResolvedValueOnce(failure(500, "req-c1"));
    renderPage();
    const connection = panel(/connector connection/i);
    const alert = await within(connection).findByRole("alert");
    expect(alert.textContent).toContain("Couldn't load the connector instances.");
    expect(alert.textContent).toContain("req-c1");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await connectionRow("Cairo ERP")).toBeDefined();
  });
});

describe("connection truth regressions (review H1, M2, M4)", () => {
  test("a failed C2 re-read drops an earlier healthy verdict to no signal", async () => {
    api.tenantAdminListConnectorInstances.mockResolvedValue(
      ok({ items: [instance({ display_name: "Cairo ERP" })] }),
    );
    api.listConnectorHealth.mockResolvedValueOnce(
      ok({
        items: [
          healthView({
            liveness: "healthy",
            lastSeenAt: "2026-10-16T09:00:00Z",
            secondsSinceLastSeen: 30,
          }),
        ],
      }),
    );
    renderPage();
    expect(within(await connectionRow("Cairo ERP")).getByText("Connected")).toBeDefined();
    api.listConnectorHealth.mockResolvedValue(failure(500));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() =>
      expect(
        within(screen.getByRole("row", { name: /Cairo ERP/ })).getByText("No signal"),
      ).toBeDefined(),
    );
    const connection = panel(/connector connection/i);
    expect(within(connection).queryByText("Connected")).toBeNull();
    expect(within(connection).getByText(/couldn't read the connection status/i)).toBeDefined();
  });

  test("with no C2 row nothing is asserted about the instance, and no cause is invented", async () => {
    api.listConnectorHealth.mockResolvedValue(ok({ items: [] }));
    renderPage();
    const row = await connectionRow("Cairo ERP");
    expect(within(row).getByText("No signal")).toBeDefined();
    expect(within(row).getAllByText("Unknown")).toHaveLength(3);
    expect(within(row).queryByText("Never")).toBeNull();
    expect(within(row).queryByText("Not reported")).toBeNull();
    expect(screen.queryByText(/hasn't sent a heartbeat/i)).toBeNull();
  });

  test("while C2 is still loading the panel is a skeleton, never no-signal rows", async () => {
    api.listConnectorHealth.mockReturnValue(new Promise(() => {}));
    renderPage();
    const connection = panel(/connector connection/i);
    await waitFor(() =>
      expect(within(connection).getByRole("table").getAttribute("aria-busy")).toBe("true"),
    );
    expect(within(connection).queryByText("No signal")).toBeNull();
  });
});

describe("sync summary (A-4)", () => {
  test("each domain is its own tile; connector_health stays not available", async () => {
    // A healthy instance in the panel does not lift the summary's not_available.
    api.listConnectorHealth.mockResolvedValue(
      ok({ items: [healthView({ connectorId: INSTANCE_A, liveness: "healthy" })] }),
    );
    renderPage();
    const summary = panel(/sync summary/i);
    const tiles = await within(summary).findAllByRole("listitem");
    expect(tiles).toHaveLength(4);
    const tile = (name: string) => tiles.find((t) => t.textContent?.includes(name)) as HTMLElement;
    expect(within(tile("ERPNext posting")).getByText("Nothing needs attention")).toBeDefined();
    expect(within(tile("ERPNext posting")).getByText("No posting dead-letters")).toBeDefined();
    expect(within(tile("Reconciliation")).getByText("Needs attention")).toBeDefined();
    expect(within(tile("Reconciliation")).getByText("Count: 2")).toBeDefined();
    expect(within(tile("Connector health")).getByText("Not available yet")).toBeDefined();
    expect(within(tile("Connector health")).queryByText(/Count/)).toBeNull();
    expect(within(tile("Product master")).getByText("Not available yet")).toBeDefined();
  });
});

describe("posting backlog (A-5)", () => {
  test("empty: no dead-lettered postings, with the read time", async () => {
    renderPage();
    const backlog = panel(/permanently rejected postings/i);
    expect(await within(backlog).findByText("No permanently rejected postings.")).toBeDefined();
    expect(within(backlog).getByText(/^Last read:/)).toBeDefined();
  });

  test("rows show the class, or not recorded; no reason text and no repair action", async () => {
    api.consoleListPostingBacklog.mockResolvedValue(
      ok({
        items: [
          backlogItem({ externalId: "SALE-1", rejectionClass: "validation" }),
          backlogItem({
            postingStatusId: "0190f000-0000-7000-8000-0000000000c2",
            externalId: "SALE-2",
            kind: "reversal",
            rejectionClass: null,
          }),
        ],
        nextCursor: null,
      }),
    );
    renderPage();
    const first = await screen.findByRole("row", { name: /SALE-1/ });
    expect(within(first).getByText("validation")).toBeDefined();
    expect(within(first).getByText("Sale posting")).toBeDefined();
    const second = screen.getByRole("row", { name: /SALE-2/ });
    expect(within(second).getByText("Not recorded")).toBeDefined();
    expect(within(second).getByText("Reversal")).toBeDefined();
    const backlog = panel(/permanently rejected postings/i);
    expect(within(backlog).queryByRole("button", { name: /repair|retry|resend/i })).toBeNull();
  });

  test("cursor paging; a failed continuation keeps the loaded rows", async () => {
    api.consoleListPostingBacklog.mockImplementation((q: { cursor?: string }) => {
      if (!q.cursor) return Promise.resolve(ok({ items: [backlogItem()], nextCursor: "50" }));
      return Promise.resolve(failure(500));
    });
    renderPage();
    await screen.findByRole("row", { name: /SALE-0001/ });
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText(/showing the last successful read/i)).toBeDefined();
    expect(screen.getByRole("row", { name: /SALE-0001/ })).toBeDefined();
    expect(api.consoleListPostingBacklog).toHaveBeenLastCalledWith({ cursor: "50" });
  });
});

describe("reconciliation runs", () => {
  test("trigger, status, timing and counts; the store links to Stock discrepancies", async () => {
    api.consoleListReconciliationRuns.mockResolvedValue(
      ok({
        items: [
          run({ mismatchSummary: { qty_drift: 3, negative_on_hand: 2 } }),
          run({
            runId: "0190f000-0000-7000-8000-0000000000d2",
            status: "running",
            trigger: "on_demand",
            finishedAt: null,
            mismatchSummary: null,
          }),
        ],
        nextCursor: null,
      }),
    );
    renderPage();
    const runs = panel(/reconciliation history/i);
    const rows = await within(runs).findAllByRole("row", { name: /Maadi/ });
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Completed")).toBeDefined();
    expect(within(rows[0]).getByText("Schedule")).toBeDefined();
    expect(rows[0].textContent).toContain("negative_on_hand: 2");
    expect(rows[0].textContent).toContain("qty_drift: 3");
    expect(within(rows[1]).getByText("Running")).toBeDefined();
    expect(within(rows[1]).getByText("Not finished")).toBeDefined();
    expect(within(rows[1]).getByText("None recorded")).toBeDefined();
    expect(within(runs).getByRole("link", { name: "Stock discrepancies" })).toBeDefined();
    fireEvent.click(within(rows[0]).getByRole("link", { name: "Maadi" }));
    expect((await screen.findByTestId("location")).textContent).toBe(
      `/stock-discrepancies/${STORE_A}`,
    );
  });
});

describe("store filter (§4.5, A-6)", () => {
  test("narrows the three C3 reads; the connection stays tenant-wide", async () => {
    renderPage();
    const select = (await screen.findByLabelText("Store")) as HTMLSelectElement;
    await waitFor(() =>
      expect(within(select).getByRole("option", { name: "Maadi" })).toBeDefined(),
    );
    fireEvent.change(select, { target: { value: STORE_A } });
    await waitFor(() =>
      expect(api.consoleGetSyncOpsSummary).toHaveBeenLastCalledWith({ store_id: STORE_A }),
    );
    expect(api.consoleListPostingBacklog).toHaveBeenLastCalledWith({ store_id: STORE_A });
    expect(api.consoleListReconciliationRuns).toHaveBeenLastCalledWith({ store_id: STORE_A });
    expect(api.tenantAdminListConnectorInstances).toHaveBeenCalledTimes(1);
    expect(api.listConnectorHealth).toHaveBeenCalledTimes(1);
  });

  test("an out-of-scope store is the non-disclosing 404: not available, no leak", async () => {
    const other = "0190f000-0000-7000-8000-0000000000ff";
    api.consoleGetSyncOpsSummary.mockResolvedValue(failure(404));
    api.consoleListPostingBacklog.mockResolvedValue(failure(404));
    api.consoleListReconciliationRuns.mockResolvedValue(failure(404));
    renderPage(`/erp-connection?store=${other}`);
    const summary = panel(/sync summary/i);
    expect((await within(summary).findByRole("alert")).textContent).toContain(
      "This store isn't available to you.",
    );
    expect(api.consoleGetSyncOpsSummary).toHaveBeenCalledWith({ store_id: other });
  });
});

describe("malformed store filter", () => {
  test("is never sent: the C3 panels read not-found and the connection still loads", async () => {
    renderPage("/erp-connection?store=not-a-store");
    expect(await connectionRow("Cairo ERP")).toBeDefined();
    const summary = panel(/sync summary/i);
    expect(within(summary).getByRole("alert").textContent).toContain(
      "This store isn't available to you.",
    );
    expect(api.consoleGetSyncOpsSummary).not.toHaveBeenCalled();
    expect(api.consoleListPostingBacklog).not.toHaveBeenCalled();
    expect(api.consoleListReconciliationRuns).not.toHaveBeenCalled();
  });

  test("Refresh still sends nothing for the malformed filter (review M1)", async () => {
    renderPage("/erp-connection?store=not-a-store");
    await connectionRow("Cairo ERP");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(api.tenantAdminListConnectorInstances).toHaveBeenCalledTimes(2));
    expect(api.consoleGetSyncOpsSummary).not.toHaveBeenCalled();
    expect(api.consoleListPostingBacklog).not.toHaveBeenCalled();
    expect(api.consoleListReconciliationRuns).not.toHaveBeenCalled();
  });
});

describe("stale state (A-8)", () => {
  test("a failed re-read keeps the earlier data and says it is from the last read", async () => {
    renderPage();
    await connectionRow("Cairo ERP");
    api.tenantAdminListConnectorInstances.mockResolvedValue(failure(500));
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    const connection = panel(/connector connection/i);
    expect(await within(connection).findByText(/showing the last successful read/i)).toBeDefined();
    expect(within(connection).getByRole("row", { name: /Cairo ERP/ })).toBeDefined();
    expect(within(connection).getByText(/^Last read:/)).toBeDefined();
  });
});
