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
  RETIRED_AT,
  REVOKED_AT,
  SEEN_AT,
  SHIFT_OPEN,
  USER_A,
  USER_B,
  ctx,
  detail,
  failure,
  stores,
} from "./device-fixtures";

const consoleGetDevice = vi.fn();
vi.mock("@/lib/device-queries", () => ({
  consoleListDevices: vi.fn(),
  consoleGetDevice: (...a: unknown[]) => consoleGetDevice(...a),
}));
const readStore = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, readStore: (...a: unknown[]) => readStore(...a) };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { DeviceDetail } from "@/devices/DeviceDetail";
import { createQueryClient } from "@/lib/query";

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

type Entry = string | { pathname: string; search?: string; state?: unknown };

function renderDetail(entry: Entry = `/devices/${DEVICE_1}`): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/devices" element={<p>list</p>} />
          <Route path="/devices/:deviceId" element={<DeviceDetail />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A field row's value by its label. */
function field(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  return term.nextElementSibling as HTMLElement;
}

const revokedDetail = detail({
  deviceId: DEVICE_2,
  label: "Till 2",
  trustState: "revoked",
  revokedAt: REVOKED_AT,
  revokedByUserId: USER_A,
  revokeReason: "hardware_failure",
  revokeNote: "Screen cracked; drawer cash in the office safe.",
  custodyExceptionShiftId: SHIFT_OPEN,
  replacedByDeviceId: DEVICE_3,
});

describe("DeviceDetail (RT-371)", () => {
  beforeEach(() => {
    consoleGetDevice.mockReset();
    readStore.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx());
    readStore.mockResolvedValue({ status: 200, data: stores[0] });
    consoleGetDevice.mockResolvedValue({ status: 200, data: detail() });
  });

  test("Overview: identity, store, label, trust state, expiry and last seen with its source", async () => {
    consoleGetDevice.mockResolvedValue({
      status: 200,
      data: detail({ lastSeenAt: SEEN_AT, lastSeenSource: "activity", expiresAt: EXPIRES_PAST }),
    });
    renderDetail();
    expect(await screen.findByRole("heading", { level: 1, name: "Till 1" })).toBeDefined();
    expect(field("Device ID").textContent).toBe(DEVICE_1);
    expect(field("Store").textContent).toBe("Dubai Mall");
    expect(field("Trust state").textContent).toBe("Active");
    expect(field("Credential expires").textContent).toContain("Expiry passed (not enforced yet)");
    expect(field("Last seen").textContent).toContain("Last authenticated request from the device");
    expect(screen.getByText(/does not mean the device is healthy/)).toBeDefined();
    expect(screen.getByText(/Asia\/Dubai/)).toBeDefined();
    expect(consoleGetDevice).toHaveBeenCalledWith(DEVICE_1);
  });

  test("Overview: last seen not recorded is Unknown, in the danger role", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1, name: "Till 1" });
    const unknown = within(field("Last seen")).getByText("Unknown");
    expect(unknown.className).toContain("device-flag--danger");
  });

  test("the custody exception is stated above the tabs, with the shift id, and nothing to act on", async () => {
    consoleGetDevice.mockResolvedValue({ status: 200, data: revokedDetail });
    renderDetail(`/devices/${DEVICE_2}`);
    expect(await screen.findByText("Open custody exception")).toBeDefined();
    expect(screen.getByText(SHIFT_OPEN)).toBeDefined();
    expect(screen.getByText(/stays open on this device until it is closed/)).toBeDefined();
    expect(
      screen.queryByRole("button", { name: /revoke|retire|replace|move|resolve/i }),
    ).toBeNull();
  });

  test("the revoke note is not on the Overview tab", async () => {
    consoleGetDevice.mockResolvedValue({ status: 200, data: revokedDetail });
    renderDetail(`/devices/${DEVICE_2}`);
    await screen.findByRole("heading", { level: 1, name: "Till 2" });
    expect(screen.queryByText(/Screen cracked/)).toBeNull();
  });

  test("History: paired then revoked, with actor, reason and note; the replacement link", async () => {
    consoleGetDevice.mockResolvedValue({ status: 200, data: revokedDetail });
    renderDetail(`/devices/${DEVICE_2}?tab=history`);
    const panel = await screen.findByRole("tabpanel", { name: "History" });
    const events = within(panel)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(events).toEqual(["Paired", "Revoked"]);
    expect(within(panel).getByText(USER_A)).toBeDefined();
    expect(within(panel).getByText("Hardware failure")).toBeDefined();
    expect(
      within(panel).getByText("Screen cracked; drawer cash in the office safe."),
    ).toBeDefined();
    expect(within(panel).getByRole("link", { name: DEVICE_3 }).getAttribute("href")).toBe(
      `/devices/${DEVICE_3}`,
    );
    // "Replaces" is null: none, or out of scope, said honestly.
    expect(
      within(panel).getByText(/None, or the device is in a store outside your access/),
    ).toBeDefined();
  });

  test("History: a pre-RT-365 revoke has no actor and no reason, shown as not recorded", async () => {
    consoleGetDevice.mockResolvedValue({
      status: 200,
      data: detail({ trustState: "revoked", revokedAt: REVOKED_AT }),
    });
    renderDetail(`/devices/${DEVICE_1}?tab=history`);
    const panel = await screen.findByRole("tabpanel", { name: "History" });
    expect(within(panel).getByText("Not recorded")).toBeDefined();
    expect(within(panel).getByText("No reason recorded")).toBeDefined();
  });

  test("History: a retired device lists the retire event with its actor and reason", async () => {
    consoleGetDevice.mockResolvedValue({
      status: 200,
      data: detail({
        trustState: "retired",
        revokedAt: REVOKED_AT,
        revokedByUserId: USER_A,
        revokeReason: "retired",
        retiredAt: RETIRED_AT,
        retiredByUserId: USER_B,
        retireReason: "End of lease",
      }),
    });
    renderDetail(`/devices/${DEVICE_1}?tab=history`);
    const panel = await screen.findByRole("tabpanel", { name: "History" });
    const events = within(panel)
      .getAllByRole("heading", { level: 3 })
      .map((h) => h.textContent);
    expect(events).toEqual(["Paired", "Revoked", "Retired"]);
    expect(within(panel).getByText(USER_B)).toBeDefined();
    expect(within(panel).getByText("End of lease")).toBeDefined();
  });

  test("History: an active device says it has not been revoked", async () => {
    renderDetail(`/devices/${DEVICE_1}?tab=history`);
    expect(await screen.findByText("This device has not been revoked.")).toBeDefined();
  });

  test("tabs: click and arrow keys switch, the URL follows, and Back keeps the list's filters", async () => {
    renderDetail({ pathname: `/devices/${DEVICE_1}`, state: { list: "?state=active" } });
    const overview = await screen.findByRole("tab", { name: "Overview" });
    expect(overview.getAttribute("aria-selected")).toBe("true");
    // Every aria-controls names a panel that exists (only the selected one renders).
    expect(overview.getAttribute("aria-controls")).toBe("device-panel-overview");
    expect(document.getElementById("device-panel-overview")).not.toBeNull();
    expect(screen.getByRole("tab", { name: "History" }).hasAttribute("aria-controls")).toBe(false);

    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(`/devices/${DEVICE_1}?tab=history`),
    );
    const history = screen.getByRole("tab", { name: "History" });
    expect(history.getAttribute("aria-selected")).toBe("true");
    expect(history.tabIndex).toBe(0);

    fireEvent.keyDown(history, { key: "ArrowLeft" });
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(`/devices/${DEVICE_1}`),
    );
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Overview" }));

    // The navigation state survived both tab changes: Back restores the filters.
    expect(screen.getByRole("link", { name: /Back to devices/ }).getAttribute("href")).toBe(
      "/devices?state=active",
    );
  });

  test("an unlabelled device is titled as such", async () => {
    consoleGetDevice.mockResolvedValue({ status: 200, data: detail({ label: null }) });
    renderDetail();
    expect(
      await screen.findByRole("heading", { level: 1, name: "Unlabelled device" }),
    ).toBeDefined();
  });

  test("a malformed id is not-found without a request", async () => {
    renderDetail("/devices/till-1");
    expect(await screen.findByText("This device is not available.")).toBeDefined();
    expect(consoleGetDevice).not.toHaveBeenCalled();
  });

  test("the uniform 404 reads as not available", async () => {
    consoleGetDevice.mockResolvedValue(failure(404));
    renderDetail();
    expect(await screen.findByText("This device is not available.")).toBeDefined();
  });

  test("a 500 shows the banner with the request id and a retry", async () => {
    consoleGetDevice.mockResolvedValueOnce(failure(500, "req-9"));
    renderDetail();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This device could not be loaded.");
    expect(alert.textContent).toContain("req-9");
    consoleGetDevice.mockResolvedValueOnce({ status: 200, data: detail() });
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Till 1" })).toBeDefined();
  });

  test("times wait for the store's zone; an unreadable store falls back, labelled", async () => {
    readStore.mockResolvedValue(failure(404));
    renderDetail();
    expect(await screen.findByRole("heading", { level: 1, name: "Till 1" })).toBeDefined();
    expect(field("Store").textContent).toBe("Unknown store");
    expect(screen.getByText("UTC")).toBeDefined();
    expect(readStore).toHaveBeenCalledWith(DUBAI_STORE);
  });
});
