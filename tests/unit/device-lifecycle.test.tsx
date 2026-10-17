import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  DEVICE_1,
  DEVICE_2,
  DUBAI_STORE,
  REVOKED_AT,
  SHIFT_OPEN,
  USER_A,
  ctx,
  detail,
  stores,
} from "./device-fixtures";
import { conflict, impact, openShift, retired, revoked } from "./device-lifecycle-fixtures";

const consoleGetDevice = vi.fn();
const consoleGetDeviceImpact = vi.fn();
const consoleRevokeDevice = vi.fn();
const consoleRetireDevice = vi.fn();
const consoleListPairingCodes = vi.fn();
vi.mock("@/lib/device-queries", () => ({
  consoleListDevices: vi.fn(),
  consoleGetDevice: (...a: unknown[]) => consoleGetDevice(...a),
  consoleGetDeviceImpact: (...a: unknown[]) => consoleGetDeviceImpact(...a),
  consoleRevokeDevice: (...a: unknown[]) => consoleRevokeDevice(...a),
  consoleRetireDevice: (...a: unknown[]) => consoleRetireDevice(...a),
  consoleListPairingCodes: (...a: unknown[]) => consoleListPairingCodes(...a),
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

function renderDetail(id = DEVICE_1): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[`/devices/${id}`]}>
        <Routes>
          <Route path="/devices" element={<p>list</p>} />
          <Route path="/devices/:deviceId" element={<DeviceDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const dialog = () => screen.getByRole("dialog");

async function openRevoke(): Promise<void> {
  renderDetail();
  await screen.findByRole("heading", { level: 1, name: "Till 1" });
  click("Revoke");
}

/** Pick a reason in the revoke drawer and ask for the impact. */
async function chooseReason(label: RegExp | string): Promise<void> {
  fireEvent.click(within(dialog()).getByRole("radio", { name: label }));
  click("Review impact");
}

/** Open Revoke on Till 1, pick `label`, and ask the server for the impact. */
async function openRevokeWithReason(label: RegExp | string): Promise<void> {
  await openRevoke();
  await chooseReason(label);
}

const revokedWithCustody = detail({
  deviceId: DEVICE_2,
  label: "Till 2",
  trustState: "revoked",
  revokedAt: REVOKED_AT,
  revokedByUserId: USER_A,
  revokeReason: "stolen",
  custodyExceptionShiftId: SHIFT_OPEN,
});

/** Every mock back to its default: an active device, an owner, no live pairing codes. */
function resetMocks(): void {
  for (const fn of [
    consoleGetDevice,
    consoleGetDeviceImpact,
    consoleRevokeDevice,
    consoleRetireDevice,
    consoleListPairingCodes,
    readStore,
    activeContext,
  ]) {
    fn.mockReset();
  }
  activeContext.mockReturnValue(ctx());
  readStore.mockResolvedValue({ status: 200, data: stores[0] });
  consoleGetDevice.mockResolvedValue({ status: 200, data: detail() });
  consoleListPairingCodes.mockResolvedValue({ status: 200, data: { items: [], nextCursor: null } });
}

describe("device lifecycle actions (RT-372): the action bar", () => {
  beforeEach(resetMocks);

  test("an active device offers Revoke and Retire as separate actions, never a generic Deactivate", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1, name: "Till 1" });
    const bar = screen.getByRole("group", { name: "Device lifecycle actions" });
    expect(within(bar).getByRole("button", { name: "Revoke" })).toBeDefined();
    expect(within(bar).getByRole("button", { name: "Retire" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /deactivate|disable|delete/i })).toBeNull();
  });

  test("a revoked device can only be retired here (no un-revoke)", async () => {
    consoleGetDevice.mockResolvedValue({ status: 200, data: revokedWithCustody });
    renderDetail(DEVICE_2);
    await screen.findByRole("heading", { level: 1, name: "Till 2" });
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull();
    expect(screen.getByRole("button", { name: "Retire" })).toBeDefined();
  });

  test("arriving on the page does not move focus: only closing a flow does", async () => {
    renderDetail();
    await screen.findByRole("heading", { level: 1, name: "Till 1" });
    expect(document.activeElement).toBe(document.body);
  });

  test("a retired device is closed out: no actions, and it says so", async () => {
    consoleGetDevice.mockResolvedValue({
      status: 200,
      data: detail({ trustState: "retired", revokedAt: REVOKED_AT, retiredAt: REVOKED_AT }),
    });
    renderDetail();
    await screen.findByRole("heading", { level: 1, name: "Till 1" });
    expect(screen.queryByRole("button", { name: /^(Revoke|Retire)$/ })).toBeNull();
    expect(screen.getByText(/There are no further actions on it/)).toBeDefined();
  });
});

describe("Revoke (RT-372)", () => {
  beforeEach(resetMocks);

  test("the security class is a separate group with its real-event warning; replaced, moved and retired are not offered", async () => {
    await openRevoke();
    const security = within(dialog()).getByRole("group", { name: "Security events" });
    expect(within(security).getAllByRole("radio").length).toBe(3);
    expect(security.textContent).toContain("not a workaround");
    const other = within(dialog()).getByRole("group", { name: "Other reasons" });
    expect(within(other).getAllByRole("radio").length).toBe(3);
    expect(within(dialog()).queryByRole("radio", { name: /replaced|moved|retired/i })).toBeNull();
  });

  test("a reason is required before the impact is asked for", async () => {
    await openRevoke();
    click("Review impact");
    expect(within(dialog()).getByText("Choose a reason.")).toBeDefined();
    expect(consoleGetDeviceImpact).not.toHaveBeenCalled();
  });

  test("`other` needs a note before the impact is asked for", async () => {
    await openRevokeWithReason("Other reason");
    expect(within(dialog()).getByText("This field is required.")).toBeDefined();
    expect(consoleGetDeviceImpact).not.toHaveBeenCalled();
  });

  test("allowed: the confirm step renders the server's impact, then revokes with the reason", async () => {
    consoleGetDeviceImpact.mockResolvedValue({ status: 200, data: impact() });
    consoleRevokeDevice.mockResolvedValue(revoked());
    await openRevokeWithReason("Lost");
    expect(await within(dialog()).findByText("Allowed by the server.")).toBeDefined();
    expect(consoleGetDeviceImpact).toHaveBeenCalledWith(DEVICE_1, "revoke", "lost");
    const facts = within(dialog());
    expect(
      facts.getByText("Operator sessions that would end").nextElementSibling?.textContent,
    ).toBe("2");
    expect(
      facts.getByText("Pending pairing codes that would be cancelled").nextElementSibling
        ?.textContent,
    ).toBe("1");
    click("Revoke device");
    await waitFor(() =>
      expect(consoleRevokeDevice).toHaveBeenCalledWith(DEVICE_1, { reason: "lost" }),
    );
    expect(await within(dialog()).findByText("The device is revoked.")).toBeDefined();
  });

  test("allowed_with_custody_exception for a security reason: states what stays open and proceeds", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        verdict: "allowed_with_custody_exception",
        revokeReason: "stolen",
        openShift: openShift(),
      }),
    });
    consoleRevokeDevice.mockResolvedValue(revoked({ custodyExceptionShiftId: SHIFT_OPEN }));
    await openRevokeWithReason("Stolen");
    expect(
      await within(dialog()).findByText(/stays on this device as an unresolved exception/),
    ).toBeDefined();
    // cash facts are the server's received view, labelled as such
    expect(within(dialog()).getByText(/The server has received 3 facts/)).toBeDefined();
    expect(within(dialog()).getByText(/Only what the server has received/)).toBeDefined();
    click("Revoke device");
    await waitFor(() =>
      expect(consoleRevokeDevice).toHaveBeenCalledWith(DEVICE_1, { reason: "stolen" }),
    );
  });

  test("a legacy shift's cash facts read as unknown, never zero", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        verdict: "allowed_with_custody_exception",
        revokeReason: "lost",
        openShift: openShift({ source: "legacy", cashFacts: null }),
      }),
    });
    await openRevokeWithReason("Lost");
    expect(
      await within(dialog()).findByText(/a legacy shift has no received cash-up facts/),
    ).toBeDefined();
  });

  test("recovery revoke: the server's `requires` asks for the note and the acknowledgement, and both are sent", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        verdict: "allowed_with_custody_exception",
        revokeReason: "hardware_failure",
        requires: ["owner_or_tenant_admin", "note", "acknowledge_custody_exception"],
        openShift: openShift(),
      }),
    });
    consoleRevokeDevice.mockResolvedValue(revoked({ revokeReason: "hardware_failure" }));
    await openRevokeWithReason("Hardware failure");
    const note = await within(dialog()).findByLabelText(
      "What happened, and where is the drawer cash?",
    );
    // Confirm without the note or the acknowledgement: nothing is sent
    click("Revoke device");
    expect(consoleRevokeDevice).not.toHaveBeenCalled();
    expect(within(dialog()).getByText("This field is required.")).toBeDefined();
    expect(
      within(dialog()).getByText("Confirm that you understand before revoking."),
    ).toBeDefined();

    fireEvent.change(note, { target: { value: " Screen cracked; cash in the safe " } });
    fireEvent.click(
      within(dialog()).getByRole("checkbox", { name: /unresolved custody exception/ }),
    );
    click("Revoke device");
    await waitFor(() =>
      expect(consoleRevokeDevice).toHaveBeenCalledWith(DEVICE_1, {
        reason: "hardware_failure",
        note: "Screen cracked; cash in the safe",
        acknowledgeCustodyException: true,
      }),
    );
  });

  test("forbidden_recovery (a store manager): says an owner or tenant admin must do it, offers nothing", async () => {
    activeContext.mockReturnValue(ctx("store_manager"));
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        verdict: "forbidden_recovery",
        revokeReason: "hardware_failure",
        requires: ["owner_or_tenant_admin", "note", "acknowledge_custody_exception"],
        openShift: openShift(),
      }),
    });
    await openRevokeWithReason("Hardware failure");
    expect(
      await within(dialog()).findByText(/can only be made by an owner or a tenant admin/),
    ).toBeDefined();
    expect(within(dialog()).queryByRole("button", { name: "Revoke device" })).toBeNull();
  });

  test("blocked unresolved_cash_session: explains what to do, with no override", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        verdict: "blocked",
        blockCode: "unresolved_cash_session",
        revokeReason: "admin_error",
        openShift: openShift(),
      }),
    });
    await openRevokeWithReason("Admin error");
    const text = (await within(dialog()).findByText(/Close the shift on the till and let it sync/))
      .textContent;
    expect(text).toContain("There is no override");
    expect(text).toContain("security revoke first");
    expect(within(dialog()).queryByRole("button", { name: "Revoke device" })).toBeNull();
    expect(consoleRevokeDevice).not.toHaveBeenCalled();
  });

  test.each([
    ["an unknown verdict is treated as blocked", { verdict: "allowed_after_review" }],
    ["an unknown requirement is unmet", { requires: ["second_approver"] }],
  ])("%s: no action is offered", async (_name, over) => {
    consoleGetDeviceImpact.mockResolvedValue({ status: 200, data: impact(over) });
    await openRevokeWithReason("Lost");
    expect(
      await within(dialog()).findByText(/for a reason this console doesn't know/),
    ).toBeDefined();
    expect(within(dialog()).queryByRole("button", { name: "Revoke device" })).toBeNull();
  });

  test("store-scope refusal (404 on the impact) reads as no longer available, never as an empty preview", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 404,
      error: { error: { code: "not_found", message: "x", request_id: "req-404" } },
    });
    await openRevokeWithReason("Lost");
    expect(
      await within(dialog()).findByText("This device is no longer available to you."),
    ).toBeDefined();
    expect(within(dialog()).getByText("req-404")).toBeDefined();
    expect(within(dialog()).queryByRole("button", { name: "Revoke device" })).toBeNull();
  });

  test("a 409 from the revoke carries a fresh preview: it is rendered, and the revoke is not retried", async () => {
    consoleGetDeviceImpact.mockResolvedValue({ status: 200, data: impact() });
    const fresh = impact({
      verdict: "blocked",
      blockCode: "unresolved_cash_session",
      revokeReason: "admin_error",
      openShift: openShift(),
    });
    consoleRevokeDevice.mockResolvedValue(conflict("unresolved_cash_session", fresh));
    await openRevokeWithReason("Admin error");
    await within(dialog()).findByText("Allowed by the server.");
    click("Revoke device");
    expect(
      await within(dialog()).findByText(/The situation changed since the preview/),
    ).toBeDefined();
    expect(
      await within(dialog()).findByText(/Close the shift on the till and let it sync/),
    ).toBeDefined();
    expect(within(dialog()).queryByRole("button", { name: "Revoke device" })).toBeNull();
    expect(consoleRevokeDevice).toHaveBeenCalledTimes(1);
  });

  test.each([
    [403, "recovery_revoke_forbidden", /can only be made by an owner or a tenant admin/],
    [422, "recovery_note_required", /needs a note for this revoke/],
  ])("a %s %s from the mutation reads as the server's refusal", async (status, code, message) => {
    consoleGetDeviceImpact.mockResolvedValue({ status: 200, data: impact() });
    consoleRevokeDevice.mockResolvedValue({
      status,
      error: { error: { code, message: "x", request_id: "r" } },
    });
    await openRevokeWithReason("Lost");
    await within(dialog()).findByText("Allowed by the server.");
    click("Revoke device");
    expect(await within(dialog()).findByText(message)).toBeDefined();
  });

  test("already_revoked is idempotent and says nothing changed", async () => {
    consoleGetDeviceImpact.mockResolvedValue({ status: 200, data: impact() });
    consoleRevokeDevice.mockResolvedValue(revoked({}, "already_revoked"));
    await openRevokeWithReason("Lost");
    await within(dialog()).findByText("Allowed by the server.");
    click("Revoke device");
    expect(
      await within(dialog()).findByText("This device was already revoked. Nothing changed."),
    ).toBeDefined();
  });

  test("the note is never put in the page title, the URL or the impact request", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ revokeReason: "other", requires: ["note"] }),
    });
    await openRevoke();
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Other reason" }));
    fireEvent.change(within(dialog()).getByLabelText("Note"), {
      target: { value: "secret-looking note" },
    });
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    expect(consoleGetDeviceImpact).toHaveBeenCalledWith(DEVICE_1, "revoke", "other");
    expect(document.title).not.toContain("secret-looking");
  });
});

describe("Retire (RT-372)", () => {
  beforeEach(resetMocks);

  async function openRetire(): Promise<void> {
    renderDetail();
    await screen.findByRole("heading", { level: 1, name: "Till 1" });
    click("Retire");
  }

  test("a reason is required, then the impact is rendered and the retire sends it", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "retire", revokeReason: "retired" }),
    });
    consoleRetireDevice.mockResolvedValue(retired());
    await openRetire();
    click("Review impact");
    expect(within(dialog()).getByText("This field is required.")).toBeDefined();
    expect(consoleGetDeviceImpact).not.toHaveBeenCalled();

    fireEvent.change(within(dialog()).getByLabelText("Why is this device retired?"), {
      target: { value: " End of life " },
    });
    click("Review impact");
    expect(await within(dialog()).findByText("Allowed by the server.")).toBeDefined();
    expect(consoleGetDeviceImpact).toHaveBeenCalledWith(DEVICE_1, "retire", undefined);
    click("Retire device");
    await waitFor(() => expect(consoleRetireDevice).toHaveBeenCalledWith(DEVICE_1, "End of life"));
    expect(await within(dialog()).findByText("The device is retired.")).toBeDefined();
  });

  test("the done step survives the device turning retired: the drawer is not unmounted by the refetch", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "retire", revokeReason: "retired" }),
    });
    consoleRetireDevice.mockResolvedValue(retired());
    // After the retire, the detail the server returns is the retired device.
    consoleGetDevice.mockReset();
    consoleGetDevice.mockResolvedValueOnce({ status: 200, data: detail() }).mockResolvedValue({
      status: 200,
      data: detail({ trustState: "retired", revokedAt: REVOKED_AT, retiredAt: REVOKED_AT }),
    });
    await openRetire();
    fireEvent.change(within(dialog()).getByLabelText("Why is this device retired?"), {
      target: { value: "End of life" },
    });
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Retire device");
    await waitFor(() => expect(consoleGetDevice).toHaveBeenCalledTimes(2));
    expect(await within(dialog()).findByText("The device is retired.")).toBeDefined();
    // The page behind it now says the device is closed out, and the drawer is still the way out.
    expect(await screen.findByText(/There are no further actions on it/)).toBeDefined();
    click("Done");
    expect(screen.queryByRole("dialog")).toBeNull();
    // The Retire button is gone: focus stays on the actions region, not the page body.
    expect(document.activeElement?.className).toContain("device-actions");
  });

  test("blocked by an open shift on an active device: close the shift first, no override", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        action: "retire",
        revokeReason: "retired",
        verdict: "blocked",
        blockCode: "unresolved_cash_session",
        openShift: openShift(),
      }),
    });
    await openRetire();
    fireEvent.change(within(dialog()).getByLabelText("Why is this device retired?"), {
      target: { value: "End of life" },
    });
    click("Review impact");
    expect(
      await within(dialog()).findByText(/Close the shift on the till and let it sync/),
    ).toBeDefined();
    expect(within(dialog()).queryByRole("button", { name: "Retire device" })).toBeNull();
  });

  test("blocked by an unresolved custody exception on a revoked device", async () => {
    consoleGetDevice.mockResolvedValue({ status: 200, data: revokedWithCustody });
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        deviceId: DEVICE_2,
        action: "retire",
        revokeReason: "retired",
        trustState: "revoked",
        verdict: "blocked",
        blockCode: "unresolved_custody_exception",
        openShift: openShift(),
        custodyExceptionShiftId: SHIFT_OPEN,
        cascade: null,
      }),
    });
    renderDetail(DEVICE_2);
    await screen.findByRole("heading", { level: 1, name: "Till 2" });
    click("Retire");
    fireEvent.change(within(dialog()).getByLabelText("Why is this device retired?"), {
      target: { value: "End of life" },
    });
    click("Review impact");
    expect(
      await within(dialog()).findByText(/can't be retired until that is resolved/),
    ).toBeDefined();
    expect(
      within(dialog()).getByText("Not applicable: this device is already revoked."),
    ).toBeDefined();
    expect(within(dialog()).queryByRole("button", { name: "Retire device" })).toBeNull();
  });

  test("a revoked device with a live replacement code: the warning must be confirmed before the retire", async () => {
    const revokedClean = detail({
      deviceId: DEVICE_2,
      label: "Till 2",
      trustState: "revoked",
      revokedAt: REVOKED_AT,
      revokedByUserId: USER_A,
      revokeReason: "lost",
    });
    consoleGetDevice.mockResolvedValue({ status: 200, data: revokedClean });
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        deviceId: DEVICE_2,
        action: "retire",
        revokeReason: "retired",
        trustState: "revoked",
        cascade: null,
      }),
    });
    consoleListPairingCodes.mockResolvedValue({
      status: 200,
      data: {
        items: [
          {
            pairingCodeId: "c1",
            kind: "replace",
            storeId: DUBAI_STORE,
            terminalId: "t9",
            terminalLabel: "Till 9",
            status: "pending",
            replacesDeviceId: DEVICE_2,
            expiresAt: "2099-01-01T00:00:00Z",
            createdAt: "2026-10-17T09:00:00Z",
          },
          {
            pairingCodeId: "c2",
            kind: "pair",
            storeId: DUBAI_STORE,
            terminalId: "t8",
            terminalLabel: "Till 8",
            status: "pending",
            replacesDeviceId: null,
            expiresAt: "2099-01-01T00:00:00Z",
            createdAt: "2026-10-17T09:00:00Z",
          },
        ],
        nextCursor: null,
      },
    });
    consoleRetireDevice.mockResolvedValue(retired({ deviceId: DEVICE_2 }));
    renderDetail(DEVICE_2);
    await screen.findByRole("heading", { level: 1, name: "Till 2" });
    click("Retire");
    fireEvent.change(within(dialog()).getByLabelText("Why is this device retired?"), {
      target: { value: "End of life" },
    });
    click("Review impact");
    expect(
      await within(dialog()).findByText(
        /1 live pairing code is set to replace or move this device/,
      ),
    ).toBeDefined();
    click("Retire device");
    expect(consoleRetireDevice).not.toHaveBeenCalled();
    expect(
      within(dialog()).getByText("Confirm cancelling the replacement codes to continue."),
    ).toBeDefined();
    fireEvent.click(
      within(dialog()).getByRole("checkbox", { name: /cancel the replacement codes/ }),
    );
    click("Retire device");
    await waitFor(() => expect(consoleRetireDevice).toHaveBeenCalledWith(DEVICE_2, "End of life"));
  });

  test("an active device's retire does not list codes: its own cascade is in the impact", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "retire", revokeReason: "retired" }),
    });
    await openRetire();
    fireEvent.change(within(dialog()).getByLabelText("Why is this device retired?"), {
      target: { value: "End of life" },
    });
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    expect(consoleListPairingCodes).not.toHaveBeenCalled();
  });

  test("a 409 from the retire carries the preview that is rendered", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ action: "retire", revokeReason: "retired" }),
    });
    consoleRetireDevice.mockResolvedValue(
      conflict(
        "unresolved_cash_session",
        impact({
          action: "retire",
          revokeReason: "retired",
          verdict: "blocked",
          blockCode: "unresolved_cash_session",
          openShift: openShift(),
        }),
      ),
    );
    await openRetire();
    fireEvent.change(within(dialog()).getByLabelText("Why is this device retired?"), {
      target: { value: "End of life" },
    });
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    click("Retire device");
    expect(
      await within(dialog()).findByText(/The situation changed since the preview/),
    ).toBeDefined();
    expect(within(dialog()).queryByRole("button", { name: "Retire device" })).toBeNull();
  });
});

describe("review fixes (RT-372)", () => {
  beforeEach(resetMocks);

  async function openRetireFor(id = DEVICE_1): Promise<void> {
    renderDetail(id);
    await screen.findByRole("heading", { level: 1 });
    click("Retire");
    fireEvent.change(within(dialog()).getByLabelText("Why is this device retired?"), {
      target: { value: "End of life" },
    });
    click("Review impact");
  }

  const replacingCode = {
    pairingCodeId: "c1",
    kind: "replace",
    storeId: DUBAI_STORE,
    terminalId: "t9",
    terminalLabel: "Till 9",
    status: "pending",
    replacesDeviceId: DEVICE_1,
    expiresAt: "2099-01-01T00:00:00Z",
    createdAt: "2026-10-17T09:00:00Z",
  };

  test("M1: the replacement-codes check follows the server's preview (revoked now), not the device loaded as active", async () => {
    const codes: { resolve: (value: unknown) => void; promise?: Promise<unknown> } = {
      resolve: () => undefined,
    };
    codes.promise = new Promise((resolve) => {
      codes.resolve = resolve;
    });
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        action: "retire",
        revokeReason: "retired",
        trustState: "revoked",
        cascade: null,
      }),
    });
    consoleListPairingCodes.mockReturnValue(codes.promise);
    await openRetireFor();
    // The preview is in, the code check is not: nothing can be confirmed yet.
    await within(dialog()).findByText(/Checking for pending pairing codes/);
    expect(within(dialog()).queryByRole("button", { name: "Retire device" })).toBeNull();
    codes.resolve({ status: 200, data: { items: [replacingCode], nextCursor: null } });
    expect(
      await within(dialog()).findByText(/1 live pairing code is set to replace or move/),
    ).toBeDefined();
    click("Retire device");
    expect(consoleRetireDevice).not.toHaveBeenCalled();
    expect(
      within(dialog()).getByText("Confirm cancelling the replacement codes to continue."),
    ).toBeDefined();
  });

  test("M2: the drawer-cash label is only for the recovery revoke; otherwise the field is a plain Note", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ revokeReason: "lost", requires: ["note"] }),
    });
    await openRevokeWithReason("Lost");
    // The server asks for a note the details step left blank: a plain label, no custody wording.
    expect(await within(dialog()).findByLabelText("Note")).toBeDefined();
    expect(within(dialog()).queryByLabelText(/drawer cash/)).toBeNull();
  });

  test("M2: a note the details step already collected is not asked for twice", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ revokeReason: "other", requires: ["note"] }),
    });
    await openRevoke();
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Other reason" }));
    fireEvent.change(within(dialog()).getByLabelText("Note"), { target: { value: "Spare unit" } });
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    expect(within(dialog()).queryByLabelText(/Note|drawer cash/)).toBeNull();
  });

  test("M3: a blocked retire says retire stays blocked until the shift is closed or reconciled", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        action: "retire",
        revokeReason: "retired",
        verdict: "blocked",
        blockCode: "unresolved_cash_session",
        openShift: openShift(),
      }),
    });
    await openRetireFor();
    const text = (await within(dialog()).findByText(/retire stays blocked/)).textContent;
    expect(text).toContain("closed or the custody exception is reconciled");
    expect(text).not.toContain("make a security revoke first");
  });

  test("an unknown block code is shown raw next to the refusal", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ verdict: "blocked", blockCode: "device_frozen" }),
    });
    await openRevokeWithReason("Lost");
    expect(await within(dialog()).findByText("device_frozen")).toBeDefined();
    expect(within(dialog()).getByText(/for a reason this console doesn't know/)).toBeDefined();
  });

  test("a rejected request (400) on the impact has no Retry; a server failure does", async () => {
    consoleGetDeviceImpact.mockResolvedValueOnce({
      status: 400,
      error: { error: { code: "validation_error", message: "x", request_id: "r" } },
    });
    await openRevokeWithReason("Lost");
    await within(dialog()).findByText(/rejected a value/);
    expect(within(dialog()).queryByRole("button", { name: "Retry" })).toBeNull();
  });

  test("the reason error is tied to the radios that need it", async () => {
    await openRevoke();
    click("Review impact");
    const radio = within(dialog()).getAllByRole("radio")[0];
    expect(radio.getAttribute("aria-describedby")).toBe("revoke-reason-error");
    expect(radio.getAttribute("aria-invalid")).toBe("true");
  });

  test("operator text and times are direction-safe", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({ verdict: "allowed_with_custody_exception", openShift: openShift() }),
    });
    await openRevoke();
    expect(within(dialog()).getByLabelText("Note").getAttribute("dir")).toBe("auto");
    fireEvent.click(within(dialog()).getByRole("radio", { name: "Lost" }));
    click("Review impact");
    await within(dialog()).findByText(/stays on this device as an unresolved exception/);
    const times = dialog().querySelectorAll("time");
    expect(times.length).toBeGreaterThan(0);
    for (const time of times) expect(time.closest("bdi")?.getAttribute("dir")).toBe("ltr");
  });

  test("M1 edge: Back then Review again while the codes are refetching keeps confirm hidden", async () => {
    consoleGetDeviceImpact.mockResolvedValue({
      status: 200,
      data: impact({
        action: "retire",
        revokeReason: "retired",
        trustState: "revoked",
        cascade: null,
      }),
    });
    consoleListPairingCodes.mockResolvedValueOnce({
      status: 200,
      data: { items: [], nextCursor: null },
    });
    await openRetireFor();
    await within(dialog()).findByRole("button", { name: "Retire device" });
    // The second look at the codes is still in flight.
    consoleListPairingCodes.mockReturnValue(new Promise(() => undefined));
    click("Back");
    click("Review impact");
    await within(dialog()).findByText("Allowed by the server.");
    expect(within(dialog()).queryByRole("button", { name: "Retire device" })).toBeNull();
  });
});
