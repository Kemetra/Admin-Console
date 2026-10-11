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
import { setLocale } from "@/i18n/locale";
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

  test("RT-399: the time column is exact UTC evidence, labelled UTC, LTR-isolated", async () => {
    listAuditEvents.mockResolvedValue({
      status: 200,
      data: { items: [event("shift.forced_close")], next_cursor: null },
    });
    renderSearch();
    apply();
    expect(await screen.findByText("shift.forced_close")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Time (UTC)" })).toBeDefined();
    // Same output as before the localization: the exact instant, T -> space, Z -> UTC.
    const time = screen.getByText("2026-06-01 09:30:00 UTC");
    expect(time.tagName).toBe("BDI");
    expect(time.getAttribute("dir")).toBe("ltr");
    // The action code is machine data: verbatim and LTR-isolated.
    expect(screen.getByText("shift.forced_close").closest("bdi")?.getAttribute("dir")).toBe("ltr");
  });

  test("RT-399: Arabic renders the surface in Arabic (heading, filters, table, pager)", async () => {
    setLocale("ar");
    listAuditEvents.mockResolvedValue({
      status: 200,
      data: { items: [event("shift.forced_close")], next_cursor: null },
    });
    renderSearch();
    expect(screen.getByRole("heading", { name: "سجل التدقيق" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Audit" })).toBeNull();
    const prompt = screen.getByText(/ابحث في نشاط التدقيق/);
    expect(prompt.textContent).toBe("ابحث في نشاط التدقيق للمؤسسة Northstar Retail.");
    expect(screen.getByLabelText("الإجراء")).toBeDefined();
    expect(screen.getByLabelText("المستخدم")).toBeDefined();
    expect(screen.queryByRole("button", { name: /apply/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    expect(await screen.findByText("shift.forced_close")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "الوقت (UTC)" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "الإجراء" })).toBeDefined();
    expect(screen.queryByRole("columnheader", { name: /^time/i })).toBeNull();
    // Evidence time is locale-independent: identical in Arabic.
    expect(screen.getByText("2026-06-01 09:30:00 UTC")).toBeDefined();
    // Noun-first counter, Western digits.
    expect(screen.getByText("المحمّل: 1")).toBeDefined();
    expect(screen.queryByText(/showing/i)).toBeNull();
  });

  test("RT-399: Arabic error and empty copy", async () => {
    setLocale("ar");
    listAuditEvents.mockResolvedValue({ status: 200, data: { items: [], next_cursor: null } });
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    expect(await screen.findByText("لا توجد أحداث تدقيق تطابق عوامل التصفية هذه.")).toBeDefined();
    expect(screen.getByRole("button", { name: "مسح عوامل التصفية" })).toBeDefined();
    expect(screen.queryByText(/no audit events/i)).toBeNull();
  });

  test("RT-399: Arabic 403 banner keeps the request reference", async () => {
    setLocale("ar");
    listAuditEvents.mockResolvedValue({ status: 403, error: { error: { request_id: "req-403" } } });
    renderSearch();
    fireEvent.click(screen.getByRole("button", { name: "تطبيق" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText("ليست لديك صلاحية لعرض سجل التدقيق في هذا النطاق.")).toBeDefined();
    expect(screen.getByRole("alert").textContent).toMatch(/req-403/);
    expect(screen.queryByText(/permission/i)).toBeNull();
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

  test("RT-399: no active tenant in Arabic: Arabic scope prompt", () => {
    setLocale("ar");
    activeContext.mockReturnValue({ context: { active_tenant: null, active_store: null } });
    renderSearch();
    expect(screen.getByRole("heading", { name: "سجل التدقيق" })).toBeDefined();
    expect(screen.getByText(/^اختر مؤسسة للبحث في نشاط التدقيق/)).toBeDefined();
    expect(screen.queryByText(/select a tenant/i)).toBeNull();
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
    // The tenant name is its own <bdi> inside the sentence, so match the whole text.
    await waitFor(() =>
      expect(screen.getByText(/search audit activity/i).textContent).toBe(
        "Search audit activity for Helios Markets.",
      ),
    );
    expect(screen.queryByText("auth.signin")).toBeNull();
  });
});
