import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DEVICE_1,
  DEVICE_2,
  DEVICE_3,
  DUBAI_STORE,
  EXPIRES_PAST,
  NEW_YORK_STORE,
  OTHER_STORE,
  SEEN_AT,
  ctx,
  custodySummary,
  failure,
  page,
  stores,
  summary,
} from "./device-fixtures";

const consoleListDevices = vi.fn();
const consoleGetDevice = vi.fn();
vi.mock("@/lib/device-queries", () => ({
  consoleListDevices: (...a: unknown[]) => consoleListDevices(...a),
  consoleGetDevice: (...a: unknown[]) => consoleGetDevice(...a),
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

import { DeviceList } from "@/devices/DeviceList";
import { createQueryClient } from "@/lib/query";

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  const state = JSON.stringify(location.state ?? null);
  return (
    <output data-testid="location" data-state={state}>
      {`${location.pathname}${location.search}`}
    </output>
  );
}

function renderList(entry = "/devices"): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/devices" element={<DeviceList />} />
          <Route path="/devices/:deviceId" element={<p>detail</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The loaded table: the loading skeleton is also a table, marked busy. */
async function tableReady(): Promise<HTMLElement> {
  await waitFor(() => {
    expect(screen.getByRole("table").getAttribute("aria-busy")).not.toBe("true");
  });
  return screen.getByRole("table");
}

function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table).getAllByRole("row").slice(1);
}

function lastQuery(): Record<string, unknown> {
  return consoleListDevices.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

describe("DeviceList (RT-371)", () => {
  beforeEach(() => {
    consoleListDevices.mockReset();
    consoleGetDevice.mockReset();
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    listStores.mockResolvedValue({ status: 200, data: stores });
    consoleListDevices.mockResolvedValue(page([summary()]));
  });

  test("no active tenant: scope prompt and no request is issued", async () => {
    activeContext.mockReturnValue(ctx("owner", null));
    renderList();
    expect(await screen.findByText("Select a tenant to view devices.")).toBeDefined();
    expect(consoleListDevices).not.toHaveBeenCalled();
  });

  test("loading shows the table skeleton with the real headers", async () => {
    consoleListDevices.mockReturnValue(new Promise(() => {}));
    renderList();
    const table = await screen.findByRole("table");
    expect(table.getAttribute("aria-busy")).toBe("true");
    expect(within(table).getByRole("columnheader", { name: "Trust state" })).toBeDefined();
    expect(screen.getByText("Loading devices…")).toBeDefined();
  });

  test("rows wait for the store roster: never UTC or 'Unknown store' by accident", async () => {
    let settle: (value: unknown) => void = () => {};
    listStores.mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    renderList();
    await waitFor(() => expect(consoleListDevices).toHaveBeenCalled());
    expect(screen.getByRole("table").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("Till 1")).toBeNull();
    expect(screen.queryByText("Unknown store")).toBeNull();

    settle({ status: 200, data: stores });
    const rows = bodyRows(await tableReady());
    expect(within(rows[0]).getByText("Dubai Mall")).toBeDefined();
  });

  test("a failed roster read still shows the rows, with the store labelled unknown", async () => {
    listStores.mockResolvedValue(failure(500));
    renderList();
    const rows = bodyRows(await tableReady());
    expect(within(rows[0]).getByText("Till 1")).toBeDefined();
    expect(within(rows[0]).getByText("Unknown store")).toBeDefined();
  });

  test("rows render in the server's order, exactly as received (no re-sort)", async () => {
    consoleListDevices.mockResolvedValue(
      page([
        custodySummary(),
        summary({ deviceId: DEVICE_1, label: "Till 1", expiresAt: EXPIRES_PAST }),
        summary({
          deviceId: DEVICE_3,
          label: null,
          storeId: NEW_YORK_STORE,
          trustState: "retired",
          revokedAt: "2026-10-01T00:00:00Z",
          retiredAt: "2026-10-02T00:00:00Z",
        }),
      ]),
    );
    renderList();
    const rows = bodyRows(await tableReady());
    expect(rows).toHaveLength(3);
    // Custody exception first: revoked, flagged, in the danger tone.
    expect(within(rows[0]).getByText("Till 2")).toBeDefined();
    expect(within(rows[0]).getByText("Revoked").className).toContain("device-trust--danger");
    expect(within(rows[0]).getByText("Custody exception: open shift")).toBeDefined();
    // An active device past its (unenforced) expiry: flagged, still "Active", neutral.
    expect(within(rows[1]).getByText("Expiry passed (not enforced yet)")).toBeDefined();
    expect(within(rows[1]).getByText("Active").className).toBe("badge");
    // An unlabelled retired device keeps its id as machine data.
    expect(within(rows[2]).getByText("No label")).toBeDefined();
    expect(within(rows[2]).getByText(DEVICE_3)).toBeDefined();
    expect(within(rows[2]).getByText("Fifth Avenue")).toBeDefined();
    expect(within(rows[2]).getByText("Retired")).toBeDefined();
  });

  test("last seen: Unknown in the danger role when not recorded, never 'healthy'", async () => {
    consoleListDevices.mockResolvedValue(
      page([
        summary(),
        summary({ deviceId: DEVICE_3, lastSeenAt: SEEN_AT, lastSeenSource: "heartbeat" }),
      ]),
    );
    renderList();
    const rows = bodyRows(await tableReady());
    expect(within(rows[0]).getByText("Unknown").className).toContain("device-flag--danger");
    // A source the console does not know keeps the time and says so.
    expect(within(rows[1]).getByText("Unknown source")).toBeDefined();
    expect(screen.queryByText(/healthy/i)).toBeNull();
  });

  test("last seen from activity is labelled with its source in the list too", async () => {
    consoleListDevices.mockResolvedValue(
      page([summary({ lastSeenAt: SEEN_AT, lastSeenSource: "activity" })]),
    );
    renderList();
    const rows = bodyRows(await tableReady());
    expect(within(rows[0]).getByText("Last authenticated request from the device")).toBeDefined();
  });

  test("a device with nothing recorded reads 'No recorded exception', not 'all clear'", async () => {
    renderList();
    const rows = bodyRows(await tableReady());
    expect(within(rows[0]).getByText("No recorded exception")).toBeDefined();
  });

  test("a rejected filter (400) offers Clear filters, not a retry of the same request", async () => {
    consoleListDevices.mockResolvedValueOnce(failure(400, "req-4"));
    renderList("/devices?store=not-a-uuid");
    const alert = await screen.findByRole("alert");
    expect(within(alert).queryByRole("button", { name: "Retry" })).toBeNull();
    fireEvent.click(within(alert).getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/devices"));
    await waitFor(() => expect(lastQuery()).toEqual({ page_size: 50, cursor: undefined }));
  });

  test("the first request asks only for a page; the order note explains stale", async () => {
    renderList();
    await tableReady();
    expect(lastQuery()).toEqual({ page_size: 50, cursor: undefined });
    expect(screen.getByText(/can't be ordered by last seen yet/)).toBeDefined();
  });

  test("filters: Apply sends store and trust state to the server and writes the URL", async () => {
    renderList();
    await tableReady();
    fireEvent.change(screen.getByLabelText("Store"), { target: { value: NEW_YORK_STORE } });
    fireEvent.change(screen.getByLabelText("Trust state"), { target: { value: "revoked" } });
    consoleListDevices.mockResolvedValue(page([custodySummary({ storeId: NEW_YORK_STORE })]));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(lastQuery()).toEqual({
        page_size: 50,
        store_id: NEW_YORK_STORE,
        trust_state: "revoked",
        cursor: undefined,
      }),
    );
    expect(screen.getByTestId("location").textContent).toBe(
      `/devices?store=${NEW_YORK_STORE}&state=revoked`,
    );
  });

  test("filters: Clear resets the URL and asks for every device again", async () => {
    renderList(`/devices?store=${DUBAI_STORE}&state=active`);
    await tableReady();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(lastQuery()).toEqual({ page_size: 50, cursor: undefined }));
    expect(screen.getByTestId("location").textContent).toBe("/devices");
    expect((screen.getByLabelText("Store") as HTMLSelectElement).value).toBe("");
  });

  test("deep link: the store filter from the URL is sent and shown selected", async () => {
    renderList(`/devices?store=${DUBAI_STORE}`);
    await tableReady();
    expect(consoleListDevices.mock.calls[0][0]).toMatchObject({ store_id: DUBAI_STORE });
    await waitFor(() =>
      expect((screen.getByLabelText("Store") as HTMLSelectElement).value).toBe(DUBAI_STORE),
    );
  });

  test("deep link to a store outside the scope: the server's 404 reads as that store unavailable", async () => {
    consoleListDevices.mockResolvedValue(failure(404));
    renderList(`/devices?store=${OTHER_STORE}`);
    expect(await screen.findByText("This store's devices are not available to you.")).toBeDefined();
    expect(screen.queryByText("No devices are paired.")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    // The unlisted store stays selected and is named as such, not swapped for "All stores".
    const select = screen.getByLabelText("Store") as HTMLSelectElement;
    expect(select.value).toBe(OTHER_STORE);
    expect(within(select).getByText("A store not in your list")).toBeDefined();
  });

  test("a 404 without a store filter reads as unavailable, not as an empty fleet", async () => {
    consoleListDevices.mockResolvedValue(failure(404));
    renderList();
    expect(await screen.findByText("Devices are not available to you.")).toBeDefined();
    expect(screen.queryByText("No devices are paired.")).toBeNull();
  });

  test("dataset-empty and filtered-empty are different states", async () => {
    consoleListDevices.mockResolvedValue(page([]));
    renderList();
    expect(await screen.findByText("No devices are paired.")).toBeDefined();
  });

  test("filtered-empty says so", async () => {
    consoleListDevices.mockResolvedValue(page([]));
    renderList("/devices?state=retired");
    expect(await screen.findByText("No devices match these filters.")).toBeDefined();
  });

  test.each([
    [400, "The server rejected these filters. Check the values and try again."],
    [500, "Devices could not be loaded."],
    [401, "Your session has expired. Sign in again."],
  ])("a %s with no rows shows its banner with the request id", async (status, message) => {
    consoleListDevices.mockResolvedValue(failure(status, "req-77"));
    renderList();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(alert.textContent).toContain("req-77");
  });

  test("a failed continuation keeps the loaded rows and retries the next page", async () => {
    consoleListDevices
      .mockResolvedValueOnce(page([custodySummary()], "c2"))
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValueOnce(page([summary({ deviceId: DEVICE_3, label: "Till 3" })]));
    renderList();
    await tableReady();
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText(/The rest of the rows could not be loaded/)).toBeDefined();
    expect(screen.getByText("Till 2")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Till 3")).toBeDefined();
    expect(consoleListDevices.mock.calls[2][0]).toMatchObject({ cursor: "c2" });
    expect(screen.getByText("Loaded: 2")).toBeDefined();
  });

  test("a row opens the device and carries the list's filters for Back", async () => {
    renderList("/devices?state=active");
    const rows = bodyRows(await tableReady());
    fireEvent.click(rows[0]);
    const location = screen.getByTestId("location");
    await waitFor(() => expect(location.textContent).toBe(`/devices/${DEVICE_1}`));
    expect(JSON.parse(location.dataset.state ?? "null")).toEqual({ list: "?state=active" });
  });

  test("a store manager sees exactly the rows the server scoped, nothing added", async () => {
    activeContext.mockReturnValue({
      context: {
        active_tenant: { id: "t1", name: "Northstar Retail" },
        active_store: { id: DUBAI_STORE },
        active_role_code: "store_manager",
      },
    });
    renderList();
    await tableReady();
    expect(consoleListDevices).toHaveBeenCalledTimes(1);
    // The store manager gets exactly the rows the server scoped: nothing is added or dropped.
    expect(screen.getByText("Till 1")).toBeDefined();
    expect(screen.queryByText(DEVICE_2)).toBeNull();
  });
});
