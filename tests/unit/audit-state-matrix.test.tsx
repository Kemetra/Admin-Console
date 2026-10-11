import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const listAuditEvents = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, listAuditEvents: (...a: unknown[]) => listAuditEvents(...a) };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { AuditSearch } from "@/audit/AuditSearch";
import { createQueryClient } from "@/lib/query";

function renderSearch(): void {
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
      <AuditSearch />
    </Tree>,
  );
}

const withTenant = {
  context: { active_tenant: { id: "t1", name: "Northstar Retail" }, active_store: null },
};

function apply(): void {
  fireEvent.click(screen.getByRole("button", { name: /apply/i }));
}

function event(action: string) {
  return {
    id: "e1",
    occurred_at: "2026-06-01T09:30:00Z",
    action,
    actor_label: "Amal Saleh",
    request_id: "11111111-1111-1111-1111-111111111111",
    metadata: { note: "x" },
  };
}

/**
 * Audit state matrix (T013, VG-1, FR-006-008). Distinct, reachable renders:
 * pre-query (no search run), loading, rows, empty-after-filter, 403, generic.
 */
describe("AuditSearch state matrix", () => {
  beforeEach(() => {
    listAuditEvents.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(withTenant);
  });

  test("pre-query: prompt shown, listAuditEvents NOT called until Apply", () => {
    renderSearch();
    expect(screen.getByText(/search audit activity/i)).toBeDefined();
    expect(listAuditEvents).not.toHaveBeenCalled();
  });

  test("rows: Apply -> table renders the events", async () => {
    listAuditEvents.mockResolvedValue({
      status: 200,
      data: { items: [event("shift.forced_close")], next_cursor: null },
    });
    renderSearch();
    apply();
    expect(await screen.findByText("shift.forced_close")).toBeDefined();
    expect(screen.getByText("Amal Saleh")).toBeDefined();
  });

  test("empty-after-filter: Apply -> 0 items -> distinct empty (with Clear), not pre-query", async () => {
    listAuditEvents.mockResolvedValue({ status: 200, data: { items: [], next_cursor: null } });
    renderSearch();
    apply();
    expect(await screen.findByText(/no audit events match/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /clear filters/i })).toBeDefined();
    // distinct from pre-query
    expect(screen.queryByText(/search audit activity/i)).toBeNull();
  });

  test("403: Apply -> permission banner with request_id", async () => {
    listAuditEvents.mockResolvedValue({ status: 403, error: { error: { request_id: "req-403" } } });
    renderSearch();
    apply();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/permission/i)).toBeDefined();
    expect(screen.getByText(/req-403/)).toBeDefined();
  });

  test("generic non-2xx: Apply -> generic failure banner", async () => {
    listAuditEvents.mockResolvedValue({ status: 503, error: { error: { request_id: "req-503" } } });
    renderSearch();
    apply();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/audit search failed/i)).toBeDefined();
  });

  test("RT-269: page 2 fails -> page-1 rows stay, inline continuation error with Retry", async () => {
    let page2Calls = 0;
    listAuditEvents.mockImplementation(async (q?: { cursor?: string }) => {
      if (q?.cursor === "CUR1") {
        page2Calls += 1;
        return page2Calls === 1
          ? { status: 503, error: { error: { request_id: "req-p2" } } }
          : {
              status: 200,
              data: { items: [{ ...event("price.changed"), id: "e2" }], next_cursor: null },
            };
      }
      return { status: 200, data: { items: [event("shift.forced_close")], next_cursor: "CUR1" } };
    });
    renderSearch();
    apply();
    expect(await screen.findByText("shift.forced_close")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    const alert = await screen.findByRole("alert");
    // Names the failed continuation, not the whole search.
    expect(alert.textContent).toMatch(/could not load more audit events/i);
    expect(alert.textContent).toMatch(/req-p2/);
    expect(screen.queryByText(/audit search failed/i)).toBeNull();
    // Page-1 rows stay on screen.
    expect(screen.getByText("shift.forced_close")).toBeDefined();
    expect(screen.getByText(/showing 1/i)).toBeDefined();
    // The retry replaces "Load more" while the continuation is failed.
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(await screen.findByText("price.changed")).toBeDefined();
    expect(screen.getAllByText("shift.forced_close")).toHaveLength(1);
    expect(screen.getByText(/showing 2/i)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("no active tenant: scope prompt, no query", () => {
    activeContext.mockReturnValue({ context: { active_tenant: null, active_store: null } });
    renderSearch();
    expect(screen.getByText(/select a tenant/i)).toBeDefined();
    expect(listAuditEvents).not.toHaveBeenCalled();
  });

  test("S6: a scope switch resets the surface back to pre-query (filters + results)", async () => {
    listAuditEvents.mockResolvedValue({
      status: 200,
      data: { items: [event("auth.signin")], next_cursor: null },
    });
    activeContext.mockReturnValue(withTenant);
    const qc = createQueryClient();
    function Tree({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={qc}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      );
    }
    const { rerender } = render(
      <Tree>
        <AuditSearch />
      </Tree>,
    );
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(await screen.findByText("auth.signin")).toBeDefined();

    // Switch tenant: the provider now reports a different active tenant.
    activeContext.mockReturnValue({
      context: { active_tenant: { id: "t2", name: "Helios Markets" }, active_store: null },
    });
    rerender(
      <Tree>
        <AuditSearch />
      </Tree>,
    );

    // Reset to pre-query: prior rows gone, prompt back (filters cleared too).
    expect(await screen.findByText(/search audit activity for helios/i)).toBeDefined();
    expect(screen.queryByText("auth.signin")).toBeNull();
  });
});
