import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DEVICE_1,
  DEVICE_2,
  DUBAI_STORE,
  NEW_YORK_STORE,
  REVOKED_AT,
  SHIFT_OPEN,
  USER_A,
  ctx,
  detail,
  stores,
} from "./device-fixtures";
import { conflict, impact, openShift, revoked } from "./device-lifecycle-fixtures";
import { issued } from "./device-pairing-fixtures";

const consoleGetDevice = vi.fn();
const consoleGetDeviceImpact = vi.fn();
const consoleRevokeDevice = vi.fn();
const consoleIssuePairingCode = vi.fn();
vi.mock("@/lib/device-queries", () => ({
  consoleListDevices: vi.fn(),
  consoleGetDevice: (...a: unknown[]) => consoleGetDevice(...a),
  consoleGetDeviceImpact: (...a: unknown[]) => consoleGetDeviceImpact(...a),
  consoleRevokeDevice: (...a: unknown[]) => consoleRevokeDevice(...a),
  consoleRetireDevice: vi.fn(),
  consoleListPairingCodes: vi.fn(),
  consoleIssuePairingCode: (...a: unknown[]) => consoleIssuePairingCode(...a),
  consoleCancelPairingCode: vi.fn(),
}));
const readStore = vi.fn();
const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return {
    ...actual,
    readStore: (...a: unknown[]) => readStore(...a),
    listStores: (...a: unknown[]) => listStores(...a),
  };
});
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { DeviceDetail } from "@/devices/DeviceDetail";
import { createQueryClient } from "@/lib/query";

function renderDetail(id = DEVICE_1): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/devices/${id}`]}>
        <Routes>
          <Route path="/devices" element={<p>list</p>} />
          <Route path="/devices/pairing-codes" element={<p>codes page</p>} />
          <Route path="/devices/:deviceId" element={<DeviceDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const dialog = () => screen.getByRole("dialog");

const BINDING = {
  "Store name on receipts": "Dubai Mall",
  "Store address on receipts": "Level 1, Downtown",
  "Tax registration id": "TRN-100200300",
  "Printer vendor id (USB)": "0x04B8",
  "Printer product id (USB)": "0x0E15",
};

function fillBinding(overrides: Record<string, string> = {}): void {
  for (const [label, value] of Object.entries({ ...BINDING, ...overrides })) {
    fireEvent.change(within(dialog()).getByLabelText(label), { target: { value } });
  }
}

async function openAction(name: string, id = DEVICE_1, title = "Till 1"): Promise<void> {
  renderDetail(id);
  await screen.findByRole("heading", { level: 1, name: title });
  click(name);
}

function reset(): void {
  for (const fn of [
    consoleGetDevice,
    consoleGetDeviceImpact,
    consoleRevokeDevice,
    consoleIssuePairingCode,
    readStore,
    listStores,
    activeContext,
  ]) {
    fn.mockReset();
  }
  activeContext.mockReturnValue(ctx());
  readStore.mockResolvedValue({ status: 200, data: stores[0] });
  listStores.mockResolvedValue({ status: 200, data: stores });
  consoleGetDevice.mockResolvedValue({ status: 200, data: detail() });
}

const revokedDetail = detail({
  deviceId: DEVICE_2,
  label: "Till 2",
  trustState: "revoked",
  revokedAt: REVOKED_AT,
  revokedByUserId: USER_A,
  revokeReason: "stolen",
  custodyExceptionShiftId: SHIFT_OPEN,
});

describe("Replace and Move (RT-372 part B)", () => {
  beforeEach(reset);

  test("an active device offers Revoke, Replace, Move and Retire; a revoked one can still be replaced, moved or retired", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1, name: "Till 1" });
    const bar = screen.getByRole("group", { name: "Device lifecycle actions" });
    expect(
      within(bar)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Revoke", "Replace", "Move to another store", "Retire"]);
  });

  test("a revoked device with a custody exception is not offered Revoke", async () => {
    consoleGetDevice.mockResolvedValue({ status: 200, data: revokedDetail });
    renderDetail(DEVICE_2);
    await screen.findByRole("heading", { level: 1, name: "Till 2" });
    const bar = screen.getByRole("group", { name: "Device lifecycle actions" });
    expect(
      within(bar)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(["Replace", "Move to another store", "Retire"]);
  });

  test("Replace collects the five binding fields (decision C1); nothing is asked of the server until they are valid", async () => {
    await openAction("Replace");
    click("Review impact");
    const required = within(dialog()).getAllByText("This field is required.");
    expect(required).toHaveLength(5);
    expect(consoleGetDeviceImpact).not.toHaveBeenCalled();
    fillBinding({ "Printer vendor id (USB)": "04B8" });
    click("Review impact");
    expect(within(dialog()).getByText("Use 0x followed by four hex digits.")).toBeDefined();
    expect(consoleGetDeviceImpact).not.toHaveBeenCalled();
  });

  test("Replace: the impact is the server's, the code is issued in the same store with replacesDeviceId, a fresh key, and shown once", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "replace", revokeReason: "replaced" }),
    });
    consoleIssuePairingCode.mockResolvedValue({ status: 201, data: issued() });
    await openAction("Replace");
    expect(within(dialog()).queryByLabelText("Target store")).toBeNull();
    fillBinding();
    fireEvent.change(within(dialog()).getByLabelText("New terminal's label (optional)"), {
      target: { value: "Counter 2" },
    });
    fireEvent.change(within(dialog()).getByLabelText("Valid for, in minutes (optional)"), {
      target: { value: "30" },
    });
    click("Review impact");
    expect(await within(dialog()).findByText("Allowed by the server.")).toBeDefined();
    expect(consoleGetDeviceImpact).toHaveBeenCalledWith(DEVICE_1, "replace", undefined);

    click("Issue pairing code");
    await waitFor(() => expect(consoleIssuePairingCode).toHaveBeenCalledTimes(1));
    const [body, key] = consoleIssuePairingCode.mock.calls[0];
    expect(body).toEqual({
      storeId: DUBAI_STORE,
      replacesDeviceId: DEVICE_1,
      terminalLabel: "Counter 2",
      ttlMinutes: 30,
      branchName: "Dubai Mall",
      branchAddress: "Level 1, Downtown",
      taxRegistrationId: "TRN-100200300",
      printerVendorId: "0x04B8",
      printerProductId: "0x0E15",
    });
    expect(key).toMatch(/^[\x21-\x7E]{16,128}$/);

    // The code is shown once, with its TTL; the REPLACEMENT_BLOCKED help is a note on it.
    const panel = await within(dialog()).findByText("FAKE-TEST-CODE-0000");
    expect(panel.closest("[dir=ltr]")).not.toBeNull();
    expect(within(dialog()).getByText(/Shown only once/)).toBeDefined();
    expect(within(dialog()).getByText(/Valid for 30 minutes, until/)).toBeDefined();
    expect(within(dialog()).getByText(/REPLACEMENT_BLOCKED/)).toBeDefined();
    // Nothing on the panel navigates away: leaving would destroy a code not yet typed in.
    expect(within(dialog()).queryByRole("link")).toBeNull();
  });

  test("the code is dropped when the drawer closes: it is never kept, stored or put in the title", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "replace", revokeReason: "replaced" }),
    });
    consoleIssuePairingCode.mockResolvedValue({ status: 201, data: issued() });
    await openAction("Replace");
    fillBinding();
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Issue pairing code");
    await within(dialog()).findByText("FAKE-TEST-CODE-0000");
    expect(document.title).not.toContain("FAKE");
    expect(JSON.stringify({ ...localStorage })).not.toContain("FAKE");
    expect(JSON.stringify({ ...sessionStorage })).not.toContain("FAKE");
    click("Done");
    expect(screen.queryByText("FAKE-TEST-CODE-0000")).toBeNull();
    click("Replace");
    expect(screen.queryByText("FAKE-TEST-CODE-0000")).toBeNull();
  });

  test("Move: the target store excludes the device's own store, and the code is issued for it", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "move", revokeReason: "moved" }),
    });
    consoleIssuePairingCode.mockResolvedValue({
      status: 201,
      data: issued({ kind: "move", storeId: NEW_YORK_STORE }),
    });
    await openAction("Move to another store");
    const target = within(dialog()).getByLabelText("Target store") as HTMLSelectElement;
    await within(target).findByRole("option", { name: "Fifth Avenue" });
    const options = within(target)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(options).toEqual(["Choose a store", "Fifth Avenue"]);
    click("Review impact");
    expect(within(dialog()).getAllByText("This field is required.")).toHaveLength(6);
    fireEvent.change(target, { target: { value: NEW_YORK_STORE } });
    fillBinding();
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    expect(consoleGetDeviceImpact).toHaveBeenCalledWith(DEVICE_1, "move", undefined);
    click("Issue pairing code");
    await waitFor(() => expect(consoleIssuePairingCode).toHaveBeenCalled());
    expect(consoleIssuePairingCode.mock.calls[0][0]).toMatchObject({
      storeId: NEW_YORK_STORE,
      replacesDeviceId: DEVICE_1,
    });
  });

  test("blocked unresolved_cash_session on replace: nothing to issue, no override", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        action: "replace",
        revokeReason: "replaced",
        verdict: "blocked",
        blockCode: "unresolved_cash_session",
        openShift: openShift(),
      }),
    });
    await openAction("Replace");
    fillBinding();
    click("Review impact");
    expect(
      await within(dialog()).findByText(/Close the shift on the till and let it sync/),
    ).toBeDefined();
    expect(within(dialog()).queryByRole("button", { name: "Issue pairing code" })).toBeNull();
    expect(consoleIssuePairingCode).not.toHaveBeenCalled();
  });

  test("a revoked device with a custody exception can be replaced: allowed, and the exception stays on the old device", async () => {
    consoleGetDevice.mockResolvedValue({ status: 200, data: revokedDetail });
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        deviceId: DEVICE_2,
        action: "replace",
        revokeReason: "replaced",
        trustState: "revoked",
        openShift: openShift(),
        custodyExceptionShiftId: SHIFT_OPEN,
        cascade: null,
      }),
    });
    await openAction("Replace", DEVICE_2, "Till 2");
    fillBinding();
    click("Review impact");
    expect(await within(dialog()).findByText("Allowed by the server.")).toBeDefined();
    expect(within(dialog()).getByRole("button", { name: "Issue pairing code" })).toBeDefined();
  });

  test("store-scope refusal (404 on the issue) reads as unavailable and keeps nothing", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "move", revokeReason: "moved" }),
    });
    consoleIssuePairingCode.mockResolvedValue({
      status: 404,
      error: { error: { code: "not_found", message: "x", request_id: "req-404" } },
    });
    await openAction("Move to another store");
    await within(dialog()).findByRole("option", { name: "Fifth Avenue" });
    fireEvent.change(within(dialog()).getByLabelText("Target store"), {
      target: { value: NEW_YORK_STORE },
    });
    fillBinding();
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Issue pairing code");
    expect(
      await within(dialog()).findByText("The device or store is not available to you."),
    ).toBeDefined();
    expect(within(dialog()).getByText("req-404")).toBeDefined();
  });

  test.each([
    ["replacement_already_pending", /A live pairing code already replaces this device/],
    ["device_already_replaced", /This device has already been replaced/],
    ["idempotency_key_conflict", /can't be repeated with the same key/],
  ])("409 %s has its own message and the issue is not retried", async (code, message) => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "replace", revokeReason: "replaced" }),
    });
    consoleIssuePairingCode.mockResolvedValue(conflict(code));
    await openAction("Replace");
    fillBinding();
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Issue pairing code");
    expect(await within(dialog()).findByText(message)).toBeDefined();
    expect(consoleIssuePairingCode).toHaveBeenCalledTimes(1);
  });

  test("a 409 unresolved_cash_session carries the fresh preview, which replaces the old one", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "replace", revokeReason: "replaced" }),
    });
    consoleIssuePairingCode.mockResolvedValue(
      conflict(
        "unresolved_cash_session",
        impact({
          action: "replace",
          revokeReason: "replaced",
          verdict: "blocked",
          blockCode: "unresolved_cash_session",
          openShift: openShift(),
        }),
      ),
    );
    await openAction("Replace");
    fillBinding();
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Issue pairing code");
    expect(
      await within(dialog()).findByText(/The situation changed since the preview/),
    ).toBeDefined();
    expect(within(dialog()).queryByRole("button", { name: "Issue pairing code" })).toBeNull();
  });

  test("nothing closes the drawer while the issue is in flight: the answer would be lost", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "replace", revokeReason: "replaced" }),
    });
    const pendingAnswer: { resolve: (value: unknown) => void } = { resolve: () => undefined };
    consoleIssuePairingCode.mockReturnValue(
      new Promise((resolve) => {
        pendingAnswer.resolve = resolve;
      }),
    );
    await openAction("Replace");
    fillBinding();
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Issue pairing code");
    await waitFor(() => expect(consoleIssuePairingCode).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(dialog(), { key: "Escape" });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeNull();
    pendingAnswer.resolve({ status: 201, data: issued() });
    expect(await within(dialog()).findByText("FAKE-TEST-CODE-0000")).toBeDefined();
  });

  test("a second click before the first answer issues nothing more", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "replace", revokeReason: "replaced" }),
    });
    consoleIssuePairingCode.mockReturnValue(new Promise(() => undefined));
    await openAction("Replace");
    fillBinding();
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    const confirm = within(dialog()).getByRole("button", { name: "Issue pairing code" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.submit(confirm.closest("form") as HTMLFormElement);
    await waitFor(() => expect(consoleIssuePairingCode).toHaveBeenCalledTimes(1));
    expect(consoleIssuePairingCode).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      "a 425 (in progress)",
      { status: 425, error: { error: "idempotency_in_progress", retryAfterSec: 3 } },
      /Don't retry now/,
    ],
    [
      "a gateway error (502)",
      { status: 502, error: { error: { code: "bad_gateway", message: "x" } } },
      /we don't know whether a code was issued/,
    ],
    ["a lost response", new TypeError("network"), /we don't know whether a code was issued/],
  ])("%s is never retried: it points at the pending list", async (_name, answer, message) => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "replace", revokeReason: "replaced" }),
    });
    if (answer instanceof Error) consoleIssuePairingCode.mockRejectedValue(answer);
    else consoleIssuePairingCode.mockResolvedValue(answer);
    await openAction("Replace");
    fillBinding();
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Issue pairing code");
    expect(await within(dialog()).findByText(message)).toBeDefined();
    expect(
      within(dialog()).getByRole("link", { name: "View pending pairing codes" }),
    ).toBeDefined();
    expect(consoleIssuePairingCode).toHaveBeenCalledTimes(1);
  });

  test("after a security revoke, Replace is offered directly and opens the replace flow", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        verdict: "allowed_with_custody_exception",
        revokeReason: "stolen",
        openShift: openShift(),
      }),
    });
    consoleRevokeDevice.mockResolvedValue(revoked({ revokeReason: "stolen" }));
    renderDetail();
    await screen.findByRole("heading", { level: 1, name: "Till 1" });
    click("Revoke");
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Stolen" }));
    click("Review impact");
    await within(dialog()).findByText(/stays on this device as an unresolved exception/);
    click("Revoke device");
    expect(await within(dialog()).findByText("The device is revoked.")).toBeDefined();
    expect(within(dialog()).getByText("Next step: pair a replacement terminal.")).toBeDefined();
    click("Replace this device");
    expect(await screen.findByRole("dialog", { name: "Replace device" })).toBeDefined();
  });

  test("the issue form is direction-safe: free text is dir=auto and the address can span lines", async () => {
    await openAction("Replace");
    for (const label of [
      "Store name on receipts",
      "Store address on receipts",
      "New terminal's label (optional)",
    ]) {
      expect(within(dialog()).getByLabelText(label).getAttribute("dir")).toBe("auto");
    }
    expect(within(dialog()).getByLabelText("Store address on receipts").tagName).toBe("TEXTAREA");
  });

  test("the issued code's times are LTR runs", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "replace", revokeReason: "replaced" }),
    });
    consoleIssuePairingCode.mockResolvedValue({ status: 201, data: issued() });
    await openAction("Replace");
    fillBinding();
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Issue pairing code");
    await within(dialog()).findByText("FAKE-TEST-CODE-0000");
    const times = dialog().querySelectorAll("time");
    expect(times.length).toBeGreaterThan(0);
    for (const time of times) expect(time.closest("bdi")?.getAttribute("dir")).toBe("ltr");
  });

  test("a revoke for an administrative reason does not push a replacement", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ revokeReason: "admin_error" }),
    });
    consoleRevokeDevice.mockResolvedValue(revoked({ revokeReason: "admin_error" }));
    renderDetail();
    await screen.findByRole("heading", { level: 1, name: "Till 1" });
    click("Revoke");
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Admin error" }));
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Revoke device");
    await within(dialog()).findByText("The device is revoked.");
    expect(within(dialog()).queryByRole("button", { name: "Replace this device" })).toBeNull();
  });
});
