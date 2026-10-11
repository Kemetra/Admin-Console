import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the RF-4a data layer at the wrapper boundary (no live DP2).
const listUnknownItems = vi.fn();
const inspectUnknownItem = vi.fn();
vi.mock("@/lib/unknown-items-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/unknown-items-queries")>();
  return {
    ...actual,
    listUnknownItems: (...a: unknown[]) => listUnknownItems(...a),
    inspectUnknownItem: (...a: unknown[]) => inspectUnknownItem(...a),
  };
});

// Pin a stable active scope so the surface renders without the full provider.
vi.mock("@/unknown-items/useUnknownItemScope", () => ({
  useUnknownItemScope: () => ({
    activeTenantId: "t1",
    activeTenantName: "Northstar Retail",
    activeStoreId: null,
  }),
}));

import { formatDateTime } from "@/i18n";
import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { UnknownItemList } from "@/unknown-items/UnknownItemList";

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
      <UnknownItemList />
    </Tree>,
  );
}

const ITEM = {
  id: "u1",
  tenant_id: "t1",
  store_id: "s1",
  identifier_type: "barcode",
  identifier_value: "5012345678900",
  source_system: null,
  resolution_status: "pending",
  resolution_action: null,
  resolved_at: null,
  resolved_by: null,
  encountered_at: "2026-06-10T10:00:00Z",
};

/**
 * RF-4a list state matrix (T011, VG-1). Renders the backend-scoped page with no
 * client filter; zero rows is a successful empty state; 403 forbidden renders
 * via the persistent banner; changing a control re-keys + re-fetches the queue.
 */
describe("UnknownItemList state matrix", () => {
  beforeEach(() => {
    listUnknownItems.mockReset();
    inspectUnknownItem.mockReset();
  });

  test("loading -> shows a loading affordance", async () => {
    listUnknownItems.mockReturnValue(new Promise(() => {}));
    renderList();
    expect(await screen.findByText(/loading unknown items/i)).toBeDefined();
  });

  test("success -> renders the backend-scoped rows as a table", async () => {
    listUnknownItems.mockResolvedValue({ status: 200, data: { items: [ITEM], next_cursor: null } });
    renderList();
    expect(await screen.findByText("5012345678900")).toBeDefined();
    // RT-399: the identifier type is a localized label, never the raw enum code.
    expect(screen.getByText("Barcode")).toBeDefined();
    expect(screen.queryByText("barcode")).toBeNull();
    // encountered_at is an operational time; the exact ISO stays on <time>.
    const encountered = screen.getByText(formatDateTime(ITEM.encountered_at));
    expect(encountered.textContent).toBe("Jun 10, 2026, 10:00 UTC");
    expect(encountered.getAttribute("dateTime")).toBe(ITEM.encountered_at);
  });

  test("row -> inspect drawer with localized labels and enum values", async () => {
    listUnknownItems.mockResolvedValue({ status: 200, data: { items: [ITEM], next_cursor: null } });
    inspectUnknownItem.mockResolvedValue({ status: 200, data: ITEM });
    renderList();
    fireEvent.click(await screen.findByText("5012345678900"));
    const drawer = await screen.findByRole("dialog", { name: "Unknown item" });
    await waitFor(() => expect(drawer.textContent).toContain("Identifier type"));
    expect(drawer.textContent).toContain("Barcode");
    expect(drawer.textContent).toContain("Pending");
    expect(drawer.textContent).not.toMatch(/\bpending\b|\bbarcode\b/);
    expect(drawer.querySelector(`time[datetime="${ITEM.encountered_at}"]`)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeDefined();
  });

  test("Arabic: the queue and drawer render Arabic copy", async () => {
    setLocale("ar");
    listUnknownItems.mockResolvedValue({ status: 200, data: { items: [ITEM], next_cursor: null } });
    inspectUnknownItem.mockResolvedValue({ status: 200, data: ITEM });
    renderList();
    expect(await screen.findByText("5012345678900")).toBeDefined();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("أصناف غير معروفة");
    expect(screen.getByRole("columnheader", { name: "المعرّف" })).toBeDefined();
    expect(screen.getByText("باركود")).toBeDefined();
    expect(screen.getByLabelText("الترتيب")).toBeDefined();
    expect(screen.getByText(formatDateTime(ITEM.encountered_at, { locale: "ar" }))).toBeDefined();

    fireEvent.click(screen.getByText("5012345678900"));
    const drawer = await screen.findByRole("dialog", { name: "صنف غير معروف" });
    await waitFor(() => expect(drawer.textContent).toContain("نوع المعرّف"));
    expect(drawer.textContent).toContain("بانتظار المراجعة");
    expect(screen.getByRole("button", { name: "استبعاد" })).toBeDefined();
    expect(document.body.textContent ?? "").not.toMatch(
      /Unknown items|Identifier|Dismiss|Pending|Barcode|Sort/,
    );
  });

  test("Arabic: an empty queue reads the Arabic empty state", async () => {
    setLocale("ar");
    listUnknownItems.mockResolvedValue({ status: 200, data: { items: [], next_cursor: null } });
    renderList();
    expect(await screen.findByText("لا توجد أصناف غير معروفة للمراجعة.")).toBeDefined();
  });

  test("empty -> successful zero-row state", async () => {
    listUnknownItems.mockResolvedValue({ status: 200, data: { items: [], next_cursor: null } });
    renderList();
    expect(await screen.findByText(/no unknown items to review/i)).toBeDefined();
  });

  test("403 forbidden -> persistent banner with request_id (007 8th category)", async () => {
    listUnknownItems.mockResolvedValue({
      status: 403,
      error: { error: { code: "forbidden", request_id: "req-403" } },
    });
    renderList();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(/permission/i)).toBeDefined();
    expect(screen.getByText(/req-403/)).toBeDefined();
  });

  test("changing the sort control re-fetches the queue", async () => {
    listUnknownItems.mockResolvedValue({ status: 200, data: { items: [ITEM], next_cursor: null } });
    renderList();
    await screen.findByText("5012345678900");
    const calls = listUnknownItems.mock.calls.length;
    fireEvent.change(screen.getByLabelText(/sort/i), { target: { value: "age_asc" } });
    await waitFor(() => expect(listUnknownItems.mock.calls.length).toBeGreaterThan(calls));
    // the new call carries the changed sort param
    const last = listUnknownItems.mock.calls.at(-1)?.[0] as { sort?: string } | undefined;
    expect(last?.sort).toBe("age_asc");
  });
});
