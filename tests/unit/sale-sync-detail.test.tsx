import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  CORRELATION,
  REQUEST_ID,
  SALE,
  ctx,
  deadLetter,
  failure,
  ok,
  syncStatus,
  timeline,
} from "./sale-sync-fixtures";

const api = {
  consoleGetSaleSyncStatus: vi.fn(),
  consoleGetSaleAuditTimeline: vi.fn(),
  consoleListNeedsRepair: vi.fn(),
  consoleRepairSaleSync: vi.fn(),
};
vi.mock("@/lib/sale-sync-ops-queries", () => ({
  consoleGetSaleSyncStatus: (...a: unknown[]) => api.consoleGetSaleSyncStatus(...a),
  consoleGetSaleAuditTimeline: (...a: unknown[]) => api.consoleGetSaleAuditTimeline(...a),
  consoleListNeedsRepair: (...a: unknown[]) => api.consoleListNeedsRepair(...a),
  consoleRepairSaleSync: (...a: unknown[]) => api.consoleRepairSaleSync(...a),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { SaleSyncSections } from "@/sale-sync/SaleSyncSections";

function renderSections(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <SaleSyncSections saleRef={SALE} timeZone="Africa/Cairo" />
    </QueryClientProvider>,
  );
}

const statusRegion = () => screen.getByRole("region", { name: "Sale sync with the server" });
const timelineRegion = () => screen.getByRole("region", { name: "Sync timeline" });

function field(scope: HTMLElement, label: string): HTMLElement {
  const term = within(scope).getByText(label, { selector: "dt" });
  return term.nextElementSibling as HTMLElement;
}

async function statusLoaded(): Promise<HTMLElement> {
  await within(statusRegion()).findByText("Sync status", { selector: "dt" });
  return statusRegion();
}

describe("SaleSyncSections (RT-726)", () => {
  beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx("owner"));
    api.consoleGetSaleSyncStatus.mockResolvedValue(ok(syncStatus()));
    api.consoleGetSaleAuditTimeline.mockResolvedValue(ok(timeline()));
  });

  // --- Role gating ----------------------------------------------------------------

  test.each(["store_manager", "store_staff", "cashier", "auditor"])(
    "%s sees no sync sections and nothing is requested",
    (role) => {
      activeContext.mockReturnValue(ctx(role));
      renderSections();
      expect(screen.queryByRole("region")).toBeNull();
      expect(api.consoleGetSaleSyncStatus).not.toHaveBeenCalled();
      expect(api.consoleGetSaleAuditTimeline).not.toHaveBeenCalled();
    },
  );

  test("tenant_admin reads both sections for this sale", async () => {
    activeContext.mockReturnValue(ctx("tenant_admin"));
    renderSections();
    await statusLoaded();
    expect(api.consoleGetSaleSyncStatus).toHaveBeenCalledWith(SALE);
    expect(api.consoleGetSaleAuditTimeline).toHaveBeenCalledWith(SALE);
  });

  // --- consoleGetSaleSyncStatus --------------------------------------------------------

  test("synced is shown with copy that it is not ERPNext posting (RT-642)", async () => {
    api.consoleGetSaleSyncStatus.mockResolvedValue(
      ok(
        syncStatus({ syncStatus: "synced", deadLetter: null, processedAt: "2026-10-07T10:31:00Z" }),
      ),
    );
    renderSections();
    const region = await statusLoaded();
    expect(field(region, "Sync status").textContent).toBe("Synced");
    expect(
      within(region).getByText(/does not mean it is posted to ERPNext; the posting/),
    ).toBeDefined();
    expect(
      within(region).getByText(/no open quarantined sync item.*does not mean it is posted/i),
    ).toBeDefined();
    expect(within(region).queryByText(/^Posted/)).toBeNull();
    expect(within(region).queryByRole("button", { name: "Request repair" })).toBeNull();
  });

  test("an unknown status reads as unknown, never as posted or not posted", async () => {
    api.consoleGetSaleSyncStatus.mockResolvedValue(
      ok(syncStatus({ syncStatus: "archived" as never, deadLetter: null })),
    );
    renderSections();
    const region = await statusLoaded();
    expect(field(region, "Sync status").textContent).toBe("Unknown sync status");
    expect(within(region).getByText(/neither posted nor not posted/)).toBeDefined();
  });

  test("captured with no processing time says so", async () => {
    api.consoleGetSaleSyncStatus.mockResolvedValue(
      ok(syncStatus({ syncStatus: "captured", deadLetter: null })),
    );
    renderSections();
    const region = await statusLoaded();
    expect(field(region, "Processed").textContent).toBe("Not processed yet");
    expect(field(region, "Source reference").textContent).toBe("POS-CAI-0042");
    expect(field(region, "Source reference").querySelector("bdi")?.getAttribute("dir")).toBe("ltr");
  });

  test("the open quarantined item is shown with its redacted reason code", async () => {
    renderSections();
    const region = await statusLoaded();
    expect(field(region, "Sync status").textContent).toBe("Needs repair");
    expect(field(region, "Classification").textContent).toBe("Needs repair");
    expect(field(region, "Reason code").textContent).toBe("validation_error");
    expect(field(region, "Attempts").textContent).toBe("3");
    expect(field(region, "Resolved").textContent).toBe("Open");
  });

  test.each([
    [401, "Your session has ended. Sign in again."],
    [403, "This section is not available to your role."],
    [404, "The sync status of this sale is not available to you."],
    [400, "The server rejected this request."],
  ])("a %i on the status read is its own state, with no retry", async (status, message) => {
    api.consoleGetSaleSyncStatus.mockResolvedValue(failure(status));
    renderSections();
    const alert = await within(statusRegion()).findByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(alert.textContent).toContain(REQUEST_ID);
    expect(within(alert).queryByRole("button")).toBeNull();
  });

  test("a 429 says to wait the server's seconds and offers Retry", async () => {
    api.consoleGetSaleSyncStatus.mockResolvedValue(failure(429, "rate_limited", 20));
    renderSections();
    const alert = await within(statusRegion()).findByRole("alert");
    expect(alert.textContent).toContain("Retry in 20 seconds.");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeDefined();
  });

  test("a 500 offers Retry, which reads the status again", async () => {
    api.consoleGetSaleSyncStatus
      .mockResolvedValueOnce(failure(500))
      .mockResolvedValueOnce(ok(syncStatus()));
    renderSections();
    const alert = await within(statusRegion()).findByRole("alert");
    expect(alert.textContent).toContain("The sync status could not be loaded.");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await statusLoaded();
    expect(api.consoleGetSaleSyncStatus).toHaveBeenCalledTimes(2);
  });

  // --- consoleGetSaleAuditTimeline -------------------------------------------------------

  test("the timeline lists the server's events in its order, with labels and ids", async () => {
    api.consoleGetSaleAuditTimeline.mockResolvedValue(
      ok(
        timeline([
          { at: "2026-10-07T10:30:04Z", event: "sale.captured", correlationId: null },
          { at: "2026-10-07T10:31:00Z", event: "sync.needs_repair", correlationId: CORRELATION },
          { at: "2026-10-07T10:40:00Z", event: "ledger.rebuilt", correlationId: null },
        ]),
      ),
    );
    renderSections();
    const table = await within(timelineRegion()).findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((r) => within(r).getAllByRole("rowheader")[0].textContent)).toEqual([
      "Server received the sale",
      "Sync quarantined, needs repair",
      "Unknown event ledger.rebuilt",
    ]);
    expect(rows[0].textContent).toContain("Not recorded");
    expect(rows[1].textContent).toContain(CORRELATION);
  });

  test("an empty timeline says so", async () => {
    api.consoleGetSaleAuditTimeline.mockResolvedValue(ok(timeline([])));
    renderSections();
    expect(
      await within(timelineRegion()).findByText("No sync events are recorded for this sale."),
    ).toBeDefined();
  });

  test.each([
    [401, "Your session has ended. Sign in again."],
    [403, "This section is not available to your role."],
    [404, "The sync timeline of this sale is not available to you."],
    [429, "Too many requests in a short time. Wait a moment, then retry."],
    [500, "The sync timeline could not be loaded."],
  ])("a %i on the timeline read is its own state", async (status, message) => {
    api.consoleGetSaleAuditTimeline.mockResolvedValue(failure(status));
    renderSections();
    const alert = await within(timelineRegion()).findByRole("alert");
    expect(alert.textContent).toContain(message);
  });

  // --- consoleRepairSaleSync ------------------------------------------------------------------

  async function openConfirm(): Promise<HTMLElement> {
    const region = await statusLoaded();
    fireEvent.click(within(region).getByRole("button", { name: "Request repair" }));
    return within(region).getByRole("region", { name: "Confirm the repair request" });
  }

  test("repair is not offered unless the server says NEEDS_REPAIR with an open item", async () => {
    api.consoleGetSaleSyncStatus.mockResolvedValue(
      ok(
        syncStatus({
          syncStatus: "failed-retryable",
          deadLetter: deadLetter({ classification: "retryable" }),
        }),
      ),
    );
    renderSections();
    const region = await statusLoaded();
    expect(within(region).queryByRole("button", { name: "Request repair" })).toBeNull();
  });

  test("opening and cancelling the confirmation sends nothing", async () => {
    renderSections();
    const confirm = await openConfirm();
    expect(confirm.textContent).toContain("POS-CAI-0042");
    expect(document.activeElement?.textContent).toContain("Confirm repair");
    fireEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(api.consoleRepairSaleSync).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement?.textContent).toBe("Request repair"));
  });

  test("a confirmed repair is sent once and shows the server's new status", async () => {
    api.consoleRepairSaleSync.mockResolvedValue(
      ok(syncStatus({ syncStatus: "failed-retryable", deadLetter: null })),
    );
    renderSections();
    const confirm = await openConfirm();
    const button = within(confirm).getByRole("button", { name: "Confirm repair" });
    fireEvent.click(button);
    fireEvent.click(button);
    const alert = await within(statusRegion()).findByText(/The server accepted the repair/);
    expect(alert.textContent).toContain("Sync status is now: Sync retrying.");
    expect(alert.textContent).toContain("This step does not post the sale to ERPNext.");
    expect(api.consoleRepairSaleSync).toHaveBeenCalledTimes(1);
    const [ref, key] = api.consoleRepairSaleSync.mock.calls[0];
    expect(ref).toBe(SALE);
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    // The server's status replaces the old one; repair is no longer offered.
    expect(field(statusRegion(), "Sync status").textContent).toBe("Sync retrying");
    expect(within(statusRegion()).queryByRole("button", { name: "Request repair" })).toBeNull();
    // The control that had focus is gone: focus lands on the outcome, not the page.
    await waitFor(() =>
      expect(document.activeElement?.textContent).toContain("accepted the repair"),
    );
  });

  test("409 repair_conflict changes nothing, refreshes the status, and is not retried", async () => {
    api.consoleRepairSaleSync.mockResolvedValue(failure(409, "repair_conflict"));
    renderSections();
    const confirm = await openConfirm();
    fireEvent.click(within(confirm).getByRole("button", { name: "Confirm repair" }));
    const alert = await within(statusRegion()).findByText(/not in a repairable state now/);
    expect(alert.closest("[role=alert]")?.textContent).toContain(REQUEST_ID);
    await waitFor(() => expect(api.consoleGetSaleSyncStatus).toHaveBeenCalledTimes(2));
    expect(api.consoleRepairSaleSync).toHaveBeenCalledTimes(1);
  });

  test.each([
    [400, "validation_error", "The server rejected the request. Nothing changed."],
    [401, "unauthenticated", "Your session has ended. Sign in again."],
    [403, "forbidden", "Your role cannot request a repair. Nothing changed."],
    [403, "origin_rejected", "The server refused where this request came from"],
    [404, "not_found", "This sale was not found or is not available to you. Nothing changed."],
    [409, "idempotency_key_conflict", "does not match an earlier request with the same key"],
    [429, "rate_limited", "Too many requests in a short time. The repair was not applied."],
  ])("repair %i %s shows the server's refusal", async (status, code, message) => {
    api.consoleRepairSaleSync.mockResolvedValue(failure(status, code));
    renderSections();
    const confirm = await openConfirm();
    fireEvent.click(within(confirm).getByRole("button", { name: "Confirm repair" }));
    expect(await within(statusRegion()).findByText(message, { exact: false })).toBeDefined();
    expect(api.consoleRepairSaleSync).toHaveBeenCalledTimes(1);
  });

  test("an unconfirmed 5xx is never auto-retried; a new confirmation replays the same key", async () => {
    api.consoleRepairSaleSync
      .mockResolvedValueOnce(failure(503))
      .mockResolvedValueOnce(ok(syncStatus({ syncStatus: "failed-retryable", deadLetter: null })));
    renderSections();
    let confirm = await openConfirm();
    fireEvent.click(within(confirm).getByRole("button", { name: "Confirm repair" }));
    expect(
      await within(statusRegion()).findByText(/did not confirm the result and may have acted/),
    ).toBeDefined();
    // No retry happens on its own.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(api.consoleRepairSaleSync).toHaveBeenCalledTimes(1);

    confirm = await openConfirm();
    fireEvent.click(within(confirm).getByRole("button", { name: "Confirm repair" }));
    await within(statusRegion()).findByText(/The server accepted the repair/);
    const keys = api.consoleRepairSaleSync.mock.calls.map((call) => call[1]);
    expect(keys[1]).toBe(keys[0]);
  });

  test("a network failure is unconfirmed, not an error", async () => {
    api.consoleRepairSaleSync.mockRejectedValue(new TypeError("Failed to fetch"));
    renderSections();
    const confirm = await openConfirm();
    fireEvent.click(within(confirm).getByRole("button", { name: "Confirm repair" }));
    expect(
      await within(statusRegion()).findByText(/did not confirm the result and may have acted/),
    ).toBeDefined();
  });

  test("an answered refusal ends the key: the next confirmation sends a new one", async () => {
    api.consoleRepairSaleSync
      .mockResolvedValueOnce(failure(409, "idempotency_key_conflict"))
      .mockResolvedValueOnce(failure(409, "repair_conflict"));
    renderSections();
    let confirm = await openConfirm();
    fireEvent.click(within(confirm).getByRole("button", { name: "Confirm repair" }));
    await within(statusRegion()).findByText(/same key/);
    confirm = await openConfirm();
    fireEvent.click(within(confirm).getByRole("button", { name: "Confirm repair" }));
    await within(statusRegion()).findByText(/not in a repairable state now/);
    const keys = api.consoleRepairSaleSync.mock.calls.map((call) => call[1]);
    expect(keys[1]).not.toBe(keys[0]);
  });
});
