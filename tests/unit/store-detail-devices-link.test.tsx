import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const readStore = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, readStore: (...a: unknown[]) => readStore(...a) };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { StoreDetail } from "@/stores/StoreDetail";

const STORE = "0190f000-0000-7000-8000-0000000000a1";

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderDetail(role: string): void {
  activeContext.mockReturnValue({
    context: {
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: null,
      active_role_code: role,
    },
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/stores/${STORE}`]}>
        <Routes>
          <Route path="/stores/:storeId" element={<StoreDetail />} />
          <Route path="/devices" element={<p>devices</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * RT-371: Store Detail deep-links to the device registry filtered to that
 * store. Like «Edit store» it is shown for every role (no role pre-hide on an
 * RF-2 surface, OQ-3 / VG-5): the device API's 404 is the authority, rendered
 * by the registry as "this store's devices are not available to you"
 * (device-list.test.tsx). The link sets a filter in the URL; it never switches
 * the active store.
 */
describe("Store Detail → Devices deep link (RT-371)", () => {
  beforeEach(() => {
    readStore.mockReset();
    activeContext.mockReset();
    readStore.mockResolvedValue({
      status: 200,
      data: { id: STORE, code: "DXB", name: "Dubai Mall", is_active: true, timezone: "Asia/Dubai" },
    });
  });

  test.each(["owner", "tenant_admin", "store_manager", "store_staff"])(
    "%s gets the link, filtered to this store",
    async (role) => {
      renderDetail(role);
      const link = await screen.findByRole("link", { name: "Devices in this store" });
      expect(link.getAttribute("href")).toBe(`/devices?store=${STORE}`);
      // The edit action is unchanged beside it.
      expect(screen.getByRole("link", { name: "Edit store" })).toBeDefined();
      fireEvent.click(link);
      expect(screen.getByTestId("location").textContent).toBe(`/devices?store=${STORE}`);
    },
  );
});
