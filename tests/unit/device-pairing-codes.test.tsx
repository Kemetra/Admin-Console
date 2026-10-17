import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEVICE_1, DUBAI_STORE, NEW_YORK_STORE, ctx, failure, stores } from "./device-fixtures";
import { SECRET_CODE, issued, pending } from "./device-pairing-fixtures";

const consoleListPairingCodes = vi.fn();
const consoleCancelPairingCode = vi.fn();
const consoleIssuePairingCode = vi.fn();
vi.mock("@/lib/device-queries", () => ({
  consoleListDevices: vi.fn(),
  consoleGetDevice: vi.fn(),
  consoleGetDeviceImpact: vi.fn(),
  consoleRevokeDevice: vi.fn(),
  consoleRetireDevice: vi.fn(),
  consoleListPairingCodes: (...a: unknown[]) => consoleListPairingCodes(...a),
  consoleCancelPairingCode: (...a: unknown[]) => consoleCancelPairingCode(...a),
  consoleIssuePairingCode: (...a: unknown[]) => consoleIssuePairingCode(...a),
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

import { PairingCodes } from "@/devices/PairingCodes";
import { createQueryClient } from "@/lib/query";

function renderPage(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/devices/pairing-codes"]}>
        <Routes>
          <Route path="/devices" element={<p>list</p>} />
          <Route path="/devices/pairing-codes" element={<PairingCodes />} />
          <Route path="/devices/:deviceId" element={<p>device detail</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const page = (items: unknown[], nextCursor: string | null = null) => ({
  status: 200,
  data: { items, nextCursor },
});
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("PairingCodes (RT-372 part B)", () => {
  beforeEach(() => {
    for (const fn of [
      consoleListPairingCodes,
      consoleCancelPairingCode,
      consoleIssuePairingCode,
      listStores,
      activeContext,
    ]) {
      fn.mockReset();
    }
    activeContext.mockReturnValue(ctx());
    listStores.mockResolvedValue({ status: 200, data: stores });
    consoleListPairingCodes.mockResolvedValue(page([pending()]));
  });

  test("lists the live pending codes: kind, store, replaced device, expiry; never a code", async () => {
    consoleListPairingCodes.mockResolvedValue(
      page([
        pending(),
        pending({
          pairingCodeId: "c2",
          kind: "move",
          storeId: NEW_YORK_STORE,
          terminalLabel: "Counter 3",
          replacesDeviceId: null,
        }),
        pending({
          pairingCodeId: "c3",
          kind: "pair",
          terminalLabel: "Counter 4",
          replacesDeviceId: null,
        }),
      ]),
    );
    renderPage();
    await screen.findByText("Counter 2");
    const table = screen.getByRole("table", { name: "Live pending pairing codes, newest first" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Counter 2")).toBeDefined();
    expect(within(rows[0]).getByText("Replace")).toBeDefined();
    expect(within(rows[0]).getByText("Dubai Mall")).toBeDefined();
    expect(within(rows[0]).getByRole("link", { name: DEVICE_1 }).getAttribute("href")).toBe(
      `/devices/${DEVICE_1}`,
    );
    // A move whose replaced device is outside the caller's scope reads as that, not as "none".
    expect(within(rows[1]).getByText("Move")).toBeDefined();
    expect(within(rows[1]).getByText("A device outside your access")).toBeDefined();
    expect(within(rows[2]).getByText("New pairing")).toBeDefined();
    expect(within(rows[2]).getByText("None")).toBeDefined();
    expect(document.body.textContent).not.toContain(SECRET_CODE);
    expect(consoleListPairingCodes).toHaveBeenCalledWith({ page_size: 50, cursor: undefined });
  });

  test("an empty list says so", async () => {
    consoleListPairingCodes.mockResolvedValue(page([]));
    renderPage();
    expect(await screen.findByText("No pairing codes are pending.")).toBeDefined();
  });

  test.each([
    [404, "Pairing codes are not available to you."],
    [500, "Pairing codes could not be loaded."],
    [401, "Your session has expired. Sign in again."],
  ])("a %s shows its state with the request id", async (status, message) => {
    consoleListPairingCodes.mockResolvedValue(failure(status, "req-5"));
    renderPage();
    const text = await screen.findByText(message);
    expect(text).toBeDefined();
    if (status !== 404) expect(screen.getByText("req-5")).toBeDefined();
  });

  test("Load more follows the server's cursor", async () => {
    consoleListPairingCodes
      .mockResolvedValueOnce(page([pending()], "c2"))
      .mockResolvedValueOnce(page([pending({ pairingCodeId: "c9", terminalLabel: "Counter 9" })]));
    renderPage();
    await screen.findByText("Counter 2");
    click("Load more");
    expect(await screen.findByText("Counter 9")).toBeDefined();
    expect(consoleListPairingCodes).toHaveBeenLastCalledWith({ page_size: 50, cursor: "c2" });
  });

  test("cancel asks first, then cancels exactly that code and refreshes the list", async () => {
    consoleCancelPairingCode.mockResolvedValue({
      status: 200,
      data: { outcome: "cancelled", pairingCode: pending({ status: "cancelled" }) },
    });
    renderPage();
    await screen.findByText("Counter 2");
    click("Cancel code");
    expect(screen.getByText(/Cancel the pairing code for/).textContent).toContain("Counter 2");
    expect(consoleCancelPairingCode).not.toHaveBeenCalled();
    consoleListPairingCodes.mockResolvedValue(page([]));
    fireEvent.click(
      within(screen.getByRole("group", { name: "Cancel code" })).getByRole("button", {
        name: "Cancel code",
      }),
    );
    await waitFor(() =>
      expect(consoleCancelPairingCode).toHaveBeenCalledWith(pending().pairingCodeId),
    );
    expect(await screen.findByText("The code is cancelled.")).toBeDefined();
    await waitFor(() => expect(consoleListPairingCodes).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("No pairing codes are pending.")).toBeDefined();
  });

  test("keeping the code cancels nothing", async () => {
    renderPage();
    await screen.findByText("Counter 2");
    click("Cancel code");
    click("Keep code");
    expect(consoleCancelPairingCode).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Cancel code" })).toBeNull();
  });

  test("already_cancelled is idempotent and says nothing changed", async () => {
    consoleCancelPairingCode.mockResolvedValue({
      status: 200,
      data: { outcome: "already_cancelled", pairingCode: pending({ status: "cancelled" }) },
    });
    renderPage();
    await screen.findByText("Counter 2");
    click("Cancel code");
    fireEvent.click(
      within(screen.getByRole("group", { name: "Cancel code" })).getByRole("button", {
        name: "Cancel code",
      }),
    );
    expect(
      await screen.findByText("The code was already cancelled. Nothing changed."),
    ).toBeDefined();
  });

  test.each([
    [409, "pairing_code_used", /already used, so it can't be cancelled/],
    [404, "not_found", /This code is not available to you/],
    [500, "system_failure", /could not be cancelled/],
  ])("a %s on cancel (%s) is explained", async (status, code, message) => {
    consoleCancelPairingCode.mockResolvedValue({
      status,
      error: { error: { code, message: "x", request_id: "req-c" } },
    });
    renderPage();
    await screen.findByText("Counter 2");
    click("Cancel code");
    fireEvent.click(
      within(screen.getByRole("group", { name: "Cancel code" })).getByRole("button", {
        name: "Cancel code",
      }),
    );
    expect(await screen.findByText(message)).toBeDefined();
    expect(screen.getByText("req-c")).toBeDefined();
  });

  test("a plain pairing: store, binding, no replaced device, no impact; the code is shown once", async () => {
    consoleIssuePairingCode.mockResolvedValue({
      status: 201,
      data: issued({ kind: "pair", replacesDeviceId: null, storeId: NEW_YORK_STORE }),
    });
    renderPage();
    await screen.findByText("Counter 2");
    click("Issue pairing code");
    const dialog = screen.getByRole("dialog", { name: "Issue pairing code" });
    await within(dialog).findByRole("option", { name: "Fifth Avenue" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue pairing code" }));
    expect(within(dialog).getAllByText("This field is required.")).toHaveLength(6);
    fireEvent.change(within(dialog).getByLabelText("Store"), { target: { value: NEW_YORK_STORE } });
    for (const [label, value] of Object.entries({
      "Store name on receipts": "Fifth Avenue",
      "Store address on receipts": "5th Ave",
      "Tax registration id": "TRN-1",
      "Printer vendor id (USB)": "0x04B8",
      "Printer product id (USB)": "0x0E15",
    })) {
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue pairing code" }));
    await waitFor(() => expect(consoleIssuePairingCode).toHaveBeenCalledTimes(1));
    const [body, key] = consoleIssuePairingCode.mock.calls[0];
    expect(body).toEqual({
      storeId: NEW_YORK_STORE,
      branchName: "Fifth Avenue",
      branchAddress: "5th Ave",
      taxRegistrationId: "TRN-1",
      printerVendorId: "0x04B8",
      printerProductId: "0x0E15",
    });
    expect(key).toMatch(/^[\x21-\x7E]{16,128}$/);
    expect(await within(dialog).findByText(SECRET_CODE)).toBeDefined();
    expect(within(dialog).getByText(/Shown only once/)).toBeDefined();
    expect(within(dialog).queryByText(/REPLACEMENT_BLOCKED/)).toBeNull();
    // Closing drops the secret and refreshes the pending list.
    click("Done");
    expect(screen.queryByText(SECRET_CODE)).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET_CODE);
  });

  test("an unanswered issue says the outcome is unknown and is not retried", async () => {
    consoleIssuePairingCode.mockRejectedValue(new TypeError("network"));
    renderPage();
    await screen.findByText("Counter 2");
    click("Issue pairing code");
    const dialog = screen.getByRole("dialog", { name: "Issue pairing code" });
    await within(dialog).findByRole("option", { name: "Fifth Avenue" });
    fireEvent.change(within(dialog).getByLabelText("Store"), { target: { value: DUBAI_STORE } });
    for (const [label, value] of Object.entries({
      "Store name on receipts": "Dubai Mall",
      "Store address on receipts": "Level 1",
      "Tax registration id": "TRN-1",
      "Printer vendor id (USB)": "0x04B8",
      "Printer product id (USB)": "0x0E15",
    })) {
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue pairing code" }));
    expect(
      await within(dialog).findByText(/we don't know whether a code was issued/),
    ).toBeDefined();
    expect(consoleIssuePairingCode).toHaveBeenCalledTimes(1);
  });
});

describe("PairingCodes review fixes (RT-372)", () => {
  beforeEach(() => {
    for (const fn of [
      consoleListPairingCodes,
      consoleCancelPairingCode,
      consoleIssuePairingCode,
      listStores,
      activeContext,
    ]) {
      fn.mockReset();
    }
    activeContext.mockReturnValue(ctx());
    listStores.mockResolvedValue({ status: 200, data: stores });
    consoleListPairingCodes.mockResolvedValue(
      page([pending(), pending({ pairingCodeId: "c2", terminalLabel: "Counter 4" })]),
    );
  });

  const rowOf = (label: string) => screen.getByText(label).closest("tr") as HTMLElement;

  test("the cancel confirm opens in place, under its own row, with focus on the safe choice", async () => {
    renderPage();
    await screen.findByText("Counter 4");
    const row = rowOf("Counter 4");
    fireEvent.click(within(row).getByRole("button", { name: "Cancel code" }));
    const confirm = screen.getByRole("group", { name: "Cancel code" });
    // Directly after the row it belongs to, not above the table.
    expect(row.nextElementSibling?.contains(confirm)).toBe(true);
    expect(document.activeElement).toBe(within(confirm).getByRole("button", { name: "Keep code" }));
  });

  test("closing the confirm returns focus to that row's Cancel button", async () => {
    renderPage();
    await screen.findByText("Counter 4");
    fireEvent.click(within(rowOf("Counter 4")).getByRole("button", { name: "Cancel code" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep code" }));
    expect(document.activeElement).toBe(
      within(rowOf("Counter 4")).getByRole("button", { name: "Cancel code" }),
    );
  });

  test("while a cancel is pending the other rows cannot start another", async () => {
    consoleCancelPairingCode.mockReturnValue(new Promise(() => undefined));
    renderPage();
    await screen.findByText("Counter 4");
    fireEvent.click(within(rowOf("Counter 4")).getByRole("button", { name: "Cancel code" }));
    fireEvent.click(
      within(screen.getByRole("group", { name: "Cancel code" })).getByRole("button", {
        name: "Cancel code",
      }),
    );
    const other = within(rowOf("Counter 2")).getByRole("button", { name: "Cancel code" });
    await waitFor(() => expect((other as HTMLButtonElement).disabled).toBe(true));
  });

  test.each([
    [404, "not_found"],
    [409, "pairing_code_used"],
  ])(
    "a %s on cancel refreshes the list: the code is no longer what the page thinks",
    async (status, code) => {
      consoleCancelPairingCode.mockResolvedValue({
        status,
        error: { error: { code, message: "x", request_id: "r" } },
      });
      renderPage();
      await screen.findByText("Counter 4");
      fireEvent.click(within(rowOf("Counter 4")).getByRole("button", { name: "Cancel code" }));
      fireEvent.click(
        within(screen.getByRole("group", { name: "Cancel code" })).getByRole("button", {
          name: "Cancel code",
        }),
      );
      await waitFor(() => expect(consoleListPairingCodes).toHaveBeenCalledTimes(2));
    },
  );

  test("a rejected list request (400) offers no Retry; a server failure does", async () => {
    consoleListPairingCodes.mockResolvedValueOnce(failure(400));
    renderPage();
    await screen.findByText("Pairing codes could not be loaded.");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  test("expiry times are LTR runs inside either direction's row", async () => {
    renderPage();
    await screen.findByText("Counter 4");
    for (const time of rowOf("Counter 4").querySelectorAll("time")) {
      expect(time.closest("bdi")?.getAttribute("dir")).toBe("ltr");
    }
  });

  test("a refused plain pairing (404) names the store, not a device", async () => {
    consoleIssuePairingCode.mockResolvedValue({
      status: 404,
      error: { error: { code: "not_found", message: "x", request_id: "r" } },
    });
    renderPage();
    await screen.findByText("Counter 4");
    fireEvent.click(screen.getByRole("button", { name: "Issue pairing code" }));
    const dialog = screen.getByRole("dialog", { name: "Issue pairing code" });
    await within(dialog).findByRole("option", { name: "Fifth Avenue" });
    fireEvent.change(within(dialog).getByLabelText("Store"), { target: { value: DUBAI_STORE } });
    for (const [label, value] of Object.entries({
      "Store name on receipts": "Dubai Mall",
      "Store address on receipts": "Level 1",
      "Tax registration id": "TRN-1",
      "Printer vendor id (USB)": "0x04B8",
      "Printer product id (USB)": "0x0E15",
    })) {
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Issue pairing code" }));
    expect(await within(dialog).findByText("The store is not available to you.")).toBeDefined();
  });
});
