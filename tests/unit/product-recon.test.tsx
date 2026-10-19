import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  MAPPING_B,
  PRODUCT_A,
  PRODUCT_B,
  REQUEST_ID,
  RESULT_A,
  RUN_A,
  backlogItem,
  failure,
  ok,
  repair,
  result,
  run,
  suggestionItem,
} from "./product-recon-fixtures";

const api = {
  listProductReconciliationBacklog: vi.fn(),
  listProductReconciliationRuns: vi.fn(),
  triggerProductReconciliationRun: vi.fn(),
  getProductReconciliationRunResults: vi.fn(),
  repairProductMapping: vi.fn(),
};
vi.mock("@/lib/product-reconciliation-queries", () => ({
  listProductReconciliationBacklog: (...a: unknown[]) => api.listProductReconciliationBacklog(...a),
  listProductReconciliationRuns: (...a: unknown[]) => api.listProductReconciliationRuns(...a),
  triggerProductReconciliationRun: (...a: unknown[]) => api.triggerProductReconciliationRun(...a),
  getProductReconciliationRunResults: (...a: unknown[]) =>
    api.getProductReconciliationRunResults(...a),
  repairProductMapping: (...a: unknown[]) => api.repairProductMapping(...a),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { createQueryClient } from "@/lib/query";
import { reportRateLimited, resetRateLimit } from "@/lib/rate-limit";
import { ProductReconciliation } from "@/product-reconciliation/ProductReconciliation";
import { RunResults } from "@/product-reconciliation/RunResults";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function ctx(role: string | null = "owner", withTenant = true) {
  return {
    context: {
      user: { id: "u1", display_name: "Amal Saleh" },
      active_tenant: withTenant ? { id: "t1", name: "Northstar Retail" } : null,
      active_store: null,
      active_role_code: role,
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
    },
    switchTenant: vi.fn(),
    switchStore: vi.fn(),
    clearStore: vi.fn(),
  };
}

function renderAt(entry: string): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/product-reconciliation" element={<ProductReconciliation />} />
          <Route path="/product-reconciliation/runs/:runId" element={<RunResults />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const region = (name: string) => screen.getByRole("region", { name });
const backlogRegion = () => region("Products without a confirmed mapping");
const runsRegion = () => region("Reconciliation runs");

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  activeContext.mockReturnValue(ctx());
  api.listProductReconciliationBacklog.mockResolvedValue(
    ok({ items: [backlogItem(), suggestionItem()], nextCursor: null }),
  );
  api.listProductReconciliationRuns.mockResolvedValue(ok({ items: [run()], nextCursor: null }));
  api.getProductReconciliationRunResults.mockResolvedValue(
    ok({ items: [result()], nextCursor: null }),
  );
});

describe("RT-727 gate mirrors the API's roles", () => {
  test.each(["store_manager", "cashier", "auditor"])(
    "%s gets NoAccess and nothing is requested",
    async (role) => {
      activeContext.mockReturnValue(ctx(role));
      renderAt("/product-reconciliation");
      expect(await screen.findByRole("heading", { name: /access/i })).toBeDefined();
      renderAt(`/product-reconciliation/runs/${RUN_A}`);
      for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
    },
  );

  test("without an active tenant the page asks for one and reads nothing", () => {
    activeContext.mockReturnValue(ctx("owner", false));
    renderAt("/product-reconciliation");
    expect(screen.getByText("Select a tenant to view product reconciliation.")).toBeDefined();
    expect(api.listProductReconciliationBacklog).not.toHaveBeenCalled();
  });
});

describe("listProductReconciliationBacklog", () => {
  test("rows show the class, the suggestion as received, and the right action", async () => {
    renderAt("/product-reconciliation");
    const unmapped = await within(backlogRegion()).findByRole("row", {
      name: new RegExp(PRODUCT_A),
    });
    expect(within(unmapped).getByText("Product not mapped")).toBeDefined();
    expect(within(unmapped).getByRole("button", { name: "Map to item" })).toBeDefined();

    const suggestion = within(backlogRegion()).getByRole("row", { name: new RegExp(PRODUCT_B) });
    expect(within(suggestion).getByText("Suggestion not confirmed")).toBeDefined();
    expect(within(suggestion).getByText("ITEM-COLA-330")).toBeDefined();
    expect(within(suggestion).getByRole("button", { name: "Confirm" })).toBeDefined();
    expect(api.listProductReconciliationBacklog).toHaveBeenCalledWith({});
  });

  test("a suggestion without its mapping version links to the item mappings screen", async () => {
    api.listProductReconciliationBacklog.mockResolvedValue(
      ok({ items: [{ ...suggestionItem(), suggestionMappingVersion: null }], nextCursor: null }),
    );
    renderAt("/product-reconciliation");
    const row = await within(backlogRegion()).findByRole("row", { name: new RegExp(PRODUCT_B) });
    expect(within(row).queryByRole("button")).toBeNull();
    const link = within(row).getByRole("link", {
      name: "Confirm this suggestion from the item mappings screen.",
    });
    expect(link.getAttribute("href")).toBe("/erp-connection/mappings");
  });

  test("an unknown class reads Unknown with the raw value, never a known label", async () => {
    api.listProductReconciliationBacklog.mockResolvedValue(
      ok({
        items: [backlogItem({ mismatchClass: "brand_new" as "unmapped_dp2_product" })],
        nextCursor: null,
      }),
    );
    renderAt("/product-reconciliation");
    const row = await within(backlogRegion()).findByRole("row", { name: new RegExp(PRODUCT_A) });
    expect(within(row).getByText("Unknown")).toBeDefined();
    expect(within(row).getByText("brand_new")).toBeDefined();
    expect(within(row).queryByRole("button")).toBeNull();
  });

  test("the class filter is sent as `class` and kept in the URL", async () => {
    renderAt("/product-reconciliation?class=suggestion_unconfirmed");
    await within(backlogRegion()).findByRole("row", { name: new RegExp(PRODUCT_A) });
    expect(api.listProductReconciliationBacklog).toHaveBeenCalledWith({
      class: "suggestion_unconfirmed",
    });
    expect((screen.getAllByLabelText("Class")[0] as HTMLSelectElement).value).toBe(
      "suggestion_unconfirmed",
    );
  });

  test("an empty backlog says every product is mapped", async () => {
    api.listProductReconciliationBacklog.mockResolvedValue(ok({ items: [], nextCursor: null }));
    renderAt("/product-reconciliation");
    expect(
      await within(backlogRegion()).findByText(
        "Every active product has a confirmed ERPNext item mapping.",
      ),
    ).toBeDefined();
  });

  test("Load more sends the server's cursor", async () => {
    api.listProductReconciliationBacklog
      .mockResolvedValueOnce(ok({ items: [backlogItem()], nextCursor: PRODUCT_A }))
      .mockResolvedValueOnce(ok({ items: [suggestionItem()], nextCursor: null }));
    renderAt("/product-reconciliation");
    fireEvent.click(await within(backlogRegion()).findByRole("button", { name: "Load more" }));
    await within(backlogRegion()).findByRole("row", { name: new RegExp(PRODUCT_B) });
    expect(api.listProductReconciliationBacklog).toHaveBeenLastCalledWith({ cursor: PRODUCT_A });
  });

  test.each([
    [401, "Your session has ended. Sign in again."],
    [403, "This section isn't available to your role."],
    [404, "This section isn't available to you."],
    [400, "The server rejected this request. Check the filter and try again."],
    [500, "Couldn't load the unmapped products."],
  ])("a %i read shows its message and the request id", async (status, message) => {
    api.listProductReconciliationBacklog.mockResolvedValue(failure(status));
    renderAt("/product-reconciliation");
    const alert = await within(backlogRegion()).findByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(alert.textContent).toContain(REQUEST_ID);
  });

  test("a 429 read says when to try again", async () => {
    api.listProductReconciliationBacklog.mockResolvedValue(failure(429, "rate_limited", 12));
    renderAt("/product-reconciliation");
    const alert = await within(backlogRegion()).findByRole("alert");
    expect(alert.textContent).toContain("Too many requests. Try again in 12s.");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeDefined();
  });
});

describe("listProductReconciliationRuns", () => {
  test("rows show trigger, status, ERPNext view, counts as received, and a results link", async () => {
    api.listProductReconciliationRuns.mockResolvedValue(
      ok({
        items: [
          run(),
          run({
            id: RESULT_A,
            status: "running",
            erpnextViewStatus: "unavailable",
            finishedAt: null,
            summary: null,
          }),
        ],
        nextCursor: null,
      }),
    );
    renderAt("/product-reconciliation");
    await within(runsRegion()).findAllByRole("link", { name: "View results" });
    const rows = within(runsRegion()).getAllByRole("row");
    const [, done, running] = rows;
    expect(within(done).getByText("On demand")).toBeDefined();
    expect(within(done).getByText("Completed")).toBeDefined();
    expect(within(done).getByText("Available")).toBeDefined();
    expect(within(done).getByText("unmapped_dp2_product")).toBeDefined();
    expect(within(done).getByRole("link", { name: "View results" }).getAttribute("href")).toBe(
      `/product-reconciliation/runs/${RUN_A}`,
    );
    expect(within(running).getByText("Running")).toBeDefined();
    expect(within(running).getByText("Unavailable")).toBeDefined();
    expect(within(running).getByText("Not finished")).toBeDefined();
    expect(within(running).getByText("No summary")).toBeDefined();
  });

  test("a failed runs read shows its own error", async () => {
    api.listProductReconciliationRuns.mockResolvedValue(failure(503));
    renderAt("/product-reconciliation");
    const alert = await within(runsRegion()).findByRole("alert");
    expect(alert.textContent).toContain("Couldn't load the reconciliation runs.");
  });
});

describe("triggerProductReconciliationRun: explicit, confirmed, never retried", () => {
  async function startRun(): Promise<void> {
    renderAt("/product-reconciliation");
    fireEvent.click(
      await within(runsRegion()).findByRole("button", { name: "Start a reconciliation run" }),
    );
    expect(api.triggerProductReconciliationRun).not.toHaveBeenCalled();
    fireEvent.click(within(runsRegion()).getByRole("button", { name: "Start run" }));
  }

  test("nothing is sent before the confirm; cancel sends nothing", async () => {
    renderAt("/product-reconciliation");
    fireEvent.click(
      await within(runsRegion()).findByRole("button", { name: "Start a reconciliation run" }),
    );
    fireEvent.click(within(runsRegion()).getByRole("button", { name: "Cancel" }));
    expect(api.triggerProductReconciliationRun).not.toHaveBeenCalled();
  });

  test("a 201 shows the started run as returned and re-reads the history", async () => {
    api.triggerProductReconciliationRun.mockResolvedValue(
      ok(run({ status: "running", erpnextViewStatus: "partial", finishedAt: null }), 201),
    );
    await startRun();
    expect(
      await within(runsRegion()).findByText("Run started. Status: Running. ERPNext data: Partial."),
    ).toBeDefined();
    expect(api.triggerProductReconciliationRun).toHaveBeenCalledTimes(1);
    expect(api.triggerProductReconciliationRun.mock.calls[0][0]).toMatch(UUID);
    await waitFor(() => expect(api.listProductReconciliationRuns).toHaveBeenCalledTimes(2));
  });

  test.each([
    [400, "validation_error", "The server rejected the request as invalid. Nothing changed."],
    [401, "x", "Your session has ended. Sign in again. Nothing changed."],
    [
      403,
      "origin_rejected",
      "The server rejected the request because it didn't come from this console. Nothing changed.",
    ],
    [
      409,
      "conflict",
      "Conflict: the mapping changed at the same time, or the request was reused. Refresh and check the state.",
    ],
    [
      500,
      "system_failure",
      "Couldn't complete the request. The outcome is unknown: refresh before trying again.",
    ],
  ])("a %i %s is shown once and not retried", async (status, code, message) => {
    api.triggerProductReconciliationRun.mockResolvedValue(failure(status, code));
    await startRun();
    const alert = await within(runsRegion()).findByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(alert.textContent).toContain(REQUEST_ID);
    expect(within(alert).queryByRole("button")).toBeNull();
    expect(api.triggerProductReconciliationRun).toHaveBeenCalledTimes(1);
  });

  test("a 429 says when to try again and is not retried", async () => {
    api.triggerProductReconciliationRun.mockResolvedValue(failure(429, "rate_limited", 30));
    await startRun();
    const alert = await within(runsRegion()).findByRole("alert");
    expect(alert.textContent).toContain(
      "Too many requests. The request wasn't carried out. Try again in 30s.",
    );
    expect(api.triggerProductReconciliationRun).toHaveBeenCalledTimes(1);
  });

  test("a thrown request is an unknown outcome, not a retry", async () => {
    api.triggerProductReconciliationRun.mockRejectedValue(new TypeError("network"));
    await startRun();
    expect((await within(runsRegion()).findByRole("alert")).textContent).toContain(
      "The outcome is unknown",
    );
    expect(api.triggerProductReconciliationRun).toHaveBeenCalledTimes(1);
  });

  test("each confirmed start mints a new Idempotency-Key", async () => {
    api.triggerProductReconciliationRun.mockResolvedValue(failure(500));
    await startRun();
    await within(runsRegion()).findByRole("alert");
    fireEvent.click(
      within(runsRegion()).getByRole("button", { name: "Start a reconciliation run" }),
    );
    fireEvent.click(within(runsRegion()).getByRole("button", { name: "Start run" }));
    await waitFor(() => expect(api.triggerProductReconciliationRun).toHaveBeenCalledTimes(2));
    const [[first], [second]] = api.triggerProductReconciliationRun.mock.calls;
    expect(first).not.toBe(second);
  });
});

describe("repairProductMapping: explicit, confirmed, never retried", () => {
  async function openRepair(ref: string): Promise<HTMLElement> {
    renderAt("/product-reconciliation");
    const row = await within(backlogRegion()).findByRole("row", { name: new RegExp(PRODUCT_A) });
    fireEvent.click(within(row).getByRole("button", { name: "Map to item" }));
    const panel = screen.getByRole("region", { name: "Map a product to an ERPNext item" });
    fireEvent.change(within(panel).getByLabelText("ERPNext item reference"), {
      target: { value: ref },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Review" }));
    return panel;
  }

  async function confirmRepair(ref = "  ITEM-WATER-1L "): Promise<HTMLElement> {
    const panel = await openRepair(ref);
    expect(api.repairProductMapping).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: "Map and confirm" }));
    return panel;
  }

  test("an empty reference is refused locally and nothing is sent", async () => {
    const panel = await openRepair("   ");
    expect(
      within(panel).getByText("Enter an item reference of 1 to 180 characters."),
    ).toBeDefined();
    expect(within(panel).queryByRole("button", { name: "Map and confirm" })).toBeNull();
    expect(api.repairProductMapping).not.toHaveBeenCalled();
  });

  test("the confirm names the product and reference; one strict request is sent", async () => {
    api.repairProductMapping.mockResolvedValue(ok(repair(), 201));
    const panel = await openRepair(" ITEM-WATER-1L ");
    const confirm = within(panel).getByRole("region", { name: "Confirm the product mapping" });
    expect(confirm.textContent).toContain(PRODUCT_A);
    expect(confirm.textContent).toContain("ITEM-WATER-1L");
    fireEvent.click(within(panel).getByRole("button", { name: "Map and confirm" }));
    await within(panel).findByText("The mapping is now confirmed and active.");
    expect(api.repairProductMapping).toHaveBeenCalledTimes(1);
    const [body, key] = api.repairProductMapping.mock.calls[0];
    expect(body).toEqual({
      repairKind: "suggest_confirm",
      tenantProductId: PRODUCT_A,
      erpnextItemRef: "ITEM-WATER-1L",
    });
    expect(key).toMatch(UUID);
    // The backlog is re-read after the server's answer.
    await waitFor(() => expect(api.listProductReconciliationBacklog).toHaveBeenCalledTimes(2));
  });

  test.each([
    ["no_op_echo", "The product already had a confirmed, active mapping. Nothing changed."],
    ["still_unmapped", "The product is still unmapped."],
    [
      "conflict",
      "The mapping changed at the same time. The product still has no confirmed mapping.",
    ],
    ["rolled_back", "The server recorded an outcome this version doesn't know."],
  ])("a recorded %s outcome is shown as reported", async (outcome, message) => {
    api.repairProductMapping.mockResolvedValue(
      ok(repair({ outcome: outcome as "mapped" }), outcome === "no_op_echo" ? 200 : 201),
    );
    const panel = await confirmRepair();
    expect(await within(panel).findByText(message)).toBeDefined();
    expect(within(panel).getByText("Repair recorded")).toBeDefined();
  });

  test.each([
    [400, "validation_error", "The server rejected the request as invalid. Nothing changed."],
    [401, "x", "Your session has ended. Sign in again. Nothing changed."],
    [
      403,
      "origin_rejected",
      "The server rejected the request because it didn't come from this console. Nothing changed.",
    ],
    [404, "not_found", "The product or result isn't available to you. Nothing changed."],
    [
      409,
      "conflict",
      "Conflict: the mapping changed at the same time, or the request was reused. Refresh and check the state.",
    ],
    [
      500,
      "system_failure",
      "Couldn't complete the request. The outcome is unknown: refresh before trying again.",
    ],
  ])("a %i %s is shown with its request id and not retried", async (status, code, message) => {
    api.repairProductMapping.mockResolvedValue(failure(status, code));
    const panel = await confirmRepair();
    const alert = await within(panel).findByRole("alert");
    expect(alert.textContent).toContain(message);
    expect(alert.textContent).toContain(REQUEST_ID);
    expect(api.repairProductMapping).toHaveBeenCalledTimes(1);
    // The operator can correct the reference and act again; nothing happens on its own.
    expect(within(panel).getByLabelText("ERPNext item reference")).toBeDefined();
  });

  test("a 429 says when to try again", async () => {
    api.repairProductMapping.mockResolvedValue(failure(429, "rate_limited", 4));
    const panel = await confirmRepair();
    expect((await within(panel).findByRole("alert")).textContent).toContain("Try again in 4s.");
    expect(api.repairProductMapping).toHaveBeenCalledTimes(1);
  });

  test("while a Retry-After runs (RT-621), Map and confirm is held and nothing is sent", async () => {
    const panel = await openRepair("ITEM-1");
    act(() => reportRateLimited(30));
    try {
      const confirm = within(panel).getByRole("region", { name: "Confirm the product mapping" });
      const button = within(confirm).getAllByRole("button")[0] as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      expect(api.repairProductMapping).not.toHaveBeenCalled();
    } finally {
      act(() => resetRateLimit());
    }
  });
});

describe("repairProductMapping confirm (RT-733): the mapping id and version as received", () => {
  async function openConfirm(): Promise<HTMLElement> {
    renderAt("/product-reconciliation");
    const row = await within(backlogRegion()).findByRole("row", { name: new RegExp(PRODUCT_B) });
    fireEvent.click(within(row).getByRole("button", { name: "Confirm" }));
    return screen.getByRole("region", { name: "Confirm the suggested mapping" });
  }

  test("the confirm step names product, item, mapping and version; one strict request", async () => {
    api.repairProductMapping.mockResolvedValue(
      ok(repair({ targetRef: PRODUCT_B, repairKind: "confirm" }), 201),
    );
    const panel = await openConfirm();
    for (const text of [PRODUCT_B, "ITEM-COLA-330", MAPPING_B, "version 3"]) {
      expect(panel.textContent).toContain(text);
    }
    expect(api.repairProductMapping).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole("button", { name: "Confirm mapping" }));
    await within(panel).findByText("The mapping is now confirmed and active.");
    expect(api.repairProductMapping).toHaveBeenCalledTimes(1);
    const [body, key] = api.repairProductMapping.mock.calls[0];
    expect(body).toEqual({
      repairKind: "confirm",
      tenantProductId: PRODUCT_B,
      mappingId: MAPPING_B,
      version: 3,
    });
    expect(key).toMatch(UUID);
    expect(within(panel).queryByRole("button", { name: "Confirm mapping" })).toBeNull();
    await waitFor(() => expect(api.listProductReconciliationBacklog).toHaveBeenCalledTimes(2));
  });

  test("a double click sends one request", async () => {
    api.repairProductMapping.mockResolvedValue(ok(repair({ repairKind: "confirm" }), 201));
    const panel = await openConfirm();
    const button = within(panel).getByRole("button", { name: "Confirm mapping" });
    fireEvent.click(button);
    fireEvent.click(button);
    await within(panel).findByText("The mapping is now confirmed and active.");
    expect(api.repairProductMapping).toHaveBeenCalledTimes(1);
  });

  test("Cancel closes the panel and sends nothing", async () => {
    const panel = await openConfirm();
    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("region", { name: "Confirm the suggested mapping" })).toBeNull();
    expect(api.repairProductMapping).not.toHaveBeenCalled();
  });

  test("confirming an already-confirmed mapping is the FR-011 no-op echo", async () => {
    api.repairProductMapping.mockResolvedValue(
      ok(repair({ repairKind: "confirm", outcome: "no_op_echo" }), 200),
    );
    const panel = await openConfirm();
    fireEvent.click(within(panel).getByRole("button", { name: "Confirm mapping" }));
    expect(
      await within(panel).findByText(
        "This mapping was already confirmed and active. Nothing changed.",
      ),
    ).toBeDefined();
    expect(within(panel).getByRole("button", { name: "Close" })).toBeDefined();
  });

  test("a stale version (409) re-reads the list, offers only Close, and is not retried", async () => {
    api.repairProductMapping.mockResolvedValue(failure(409, "conflict"));
    const panel = await openConfirm();
    fireEvent.click(within(panel).getByRole("button", { name: "Confirm mapping" }));
    const alert = await within(panel).findByRole("alert");
    expect(alert.textContent).toContain("version 3 is no longer current");
    expect(alert.textContent).toContain(REQUEST_ID);
    expect(within(panel).queryByRole("button", { name: "Confirm mapping" })).toBeNull();
    await waitFor(() => expect(api.listProductReconciliationBacklog).toHaveBeenCalledTimes(2));
    expect(api.repairProductMapping).toHaveBeenCalledTimes(1);
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Confirm the suggested mapping" })).toBeNull();
  });

  test("any other refusal is shown and the operator may confirm again, with a new key", async () => {
    api.repairProductMapping.mockResolvedValueOnce(failure(500, "system_failure"));
    api.repairProductMapping.mockResolvedValueOnce(ok(repair({ repairKind: "confirm" }), 201));
    const panel = await openConfirm();
    fireEvent.click(within(panel).getByRole("button", { name: "Confirm mapping" }));
    expect((await within(panel).findByRole("alert")).textContent).toContain("outcome is unknown");
    expect(api.repairProductMapping).toHaveBeenCalledTimes(1);
    fireEvent.click(within(panel).getByRole("button", { name: "Confirm mapping" }));
    await within(panel).findByText("The mapping is now confirmed and active.");
    const [[, first], [, second]] = api.repairProductMapping.mock.calls;
    expect(first).not.toBe(second);
  });

  test("while a Retry-After runs (RT-621), Confirm mapping is held and nothing is sent", async () => {
    const panel = await openConfirm();
    act(() => reportRateLimited(30));
    try {
      const button = within(panel).getAllByRole("button")[0] as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
      expect(api.repairProductMapping).not.toHaveBeenCalled();
    } finally {
      act(() => resetRateLimit());
    }
    const button = within(panel).getByRole("button", { name: "Confirm mapping" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("getProductReconciliationRunResults", () => {
  test("lines show class, refs, state and detail as received", async () => {
    api.getProductReconciliationRunResults.mockResolvedValue(
      ok({
        items: [
          result(),
          result({
            id: MAPPING_B,
            mismatchClass: "attribute_drift",
            erpnextItemRef: "ITEM-COLA-330",
            resultState: "accepted",
            detail: { attributes: { uom: "Nos" } },
          }),
          result({
            id: PRODUCT_B,
            mismatchClass: "unmapped_erpnext_item",
            tenantProductId: null,
            erpnextItemRef: "ITEM-ORPHAN",
          }),
        ],
        nextCursor: null,
      }),
    );
    renderAt(`/product-reconciliation/runs/${RUN_A}`);
    const results = region("Classified results");
    await within(results).findByText('{"uom":"Nos"}');
    const [, open, drift, orphan] = within(results).getAllByRole("row");
    expect(within(open).getByText("Open")).toBeDefined();
    expect(within(open).getByRole("button", { name: "Map to item" })).toBeDefined();
    expect(within(drift).getByText("Attribute drift")).toBeDefined();
    expect(within(drift).getByText("Accepted")).toBeDefined();
    expect(within(drift).getByText('{"uom":"Nos"}')).toBeDefined();
    expect(within(drift).queryByRole("button")).toBeNull();
    expect(within(orphan).getByText("ERPNext item not mapped")).toBeDefined();
    expect(within(orphan).queryByRole("button")).toBeNull();
    expect(api.getProductReconciliationRunResults).toHaveBeenCalledWith(RUN_A, {});
  });

  test("the class filter is sent as `class`", async () => {
    renderAt(`/product-reconciliation/runs/${RUN_A}?class=attribute_drift`);
    await waitFor(() =>
      expect(api.getProductReconciliationRunResults).toHaveBeenCalledWith(RUN_A, {
        class: "attribute_drift",
      }),
    );
  });

  test("a result repair carries the run and result ids", async () => {
    api.repairProductMapping.mockResolvedValue(
      ok(repair({ targetKind: "result", targetRef: RESULT_A }), 201),
    );
    renderAt(`/product-reconciliation/runs/${RUN_A}`);
    fireEvent.click(await screen.findByRole("button", { name: "Map to item" }));
    const panel = screen.getByRole("region", { name: "Map a product to an ERPNext item" });
    fireEvent.change(within(panel).getByLabelText("ERPNext item reference"), {
      target: { value: "ITEM-1" },
    });
    fireEvent.click(within(panel).getByRole("button", { name: "Review" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Map and confirm" }));
    await within(panel).findByText("The mapping is now confirmed and active.");
    expect(api.repairProductMapping.mock.calls[0][0]).toEqual({
      repairKind: "suggest_confirm",
      tenantProductId: PRODUCT_A,
      erpnextItemRef: "ITEM-1",
      runId: RUN_A,
      resultId: RESULT_A,
    });
  });

  test("an open suggestion line is confirmed, a drift line re-pointed, with the line's version", async () => {
    api.getProductReconciliationRunResults.mockResolvedValue(
      ok({
        items: [
          result({
            mismatchClass: "suggestion_unconfirmed",
            erpnextItemRef: "ITEM-COLA-330",
            mappingId: MAPPING_B,
            mappingVersion: 5,
          }),
          result({
            id: PRODUCT_B,
            mismatchClass: "attribute_drift",
            erpnextItemRef: "ITEM-COLA-330",
            mappingId: MAPPING_B,
            mappingVersion: 6,
          }),
        ],
        nextCursor: null,
      }),
    );
    api.repairProductMapping.mockResolvedValue(
      ok(repair({ targetKind: "result", repairKind: "re_point" }), 201),
    );
    renderAt(`/product-reconciliation/runs/${RUN_A}`);
    const results = region("Classified results");
    await within(results).findByRole("button", { name: "Re-point" });
    const [, suggestion, drift] = within(results).getAllByRole("row");
    expect(within(suggestion).getByRole("button", { name: "Confirm" })).toBeDefined();
    fireEvent.click(within(drift).getByRole("button", { name: "Re-point" }));
    const panel = screen.getByRole("region", { name: "Re-point the mapping" });
    expect(panel.textContent).toContain("version 6");
    fireEvent.click(within(panel).getByRole("button", { name: "Re-point and confirm" }));
    await within(panel).findByText("The mapping is now confirmed and active.");
    expect(api.repairProductMapping.mock.calls[0][0]).toEqual({
      repairKind: "re_point",
      tenantProductId: PRODUCT_A,
      mappingId: MAPPING_B,
      version: 6,
      runId: RUN_A,
      resultId: PRODUCT_B,
    });
  });

  test("a suggestion line without its version links to the item mappings screen", async () => {
    api.getProductReconciliationRunResults.mockResolvedValue(
      ok({ items: [result({ mismatchClass: "suggestion_unconfirmed" })], nextCursor: null }),
    );
    renderAt(`/product-reconciliation/runs/${RUN_A}`);
    const link = await screen.findByRole("link", {
      name: "Confirm this suggestion from the item mappings screen.",
    });
    expect(link.getAttribute("href")).toBe("/erp-connection/mappings");
  });

  test("a 404 is the non-disclosing 'run not available', with no retry", async () => {
    api.getProductReconciliationRunResults.mockResolvedValue(failure(404, "not_found"));
    renderAt(`/product-reconciliation/runs/${RUN_A}`);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("This run isn't available to you.");
    expect(within(alert).queryByRole("button")).toBeNull();
  });

  test("a malformed run id is never sent and reads not-available", async () => {
    renderAt("/product-reconciliation/runs/latest");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "This run isn't available to you.",
    );
    expect(api.getProductReconciliationRunResults).not.toHaveBeenCalled();
  });

  test.each([
    [401, "Your session has ended. Sign in again."],
    [429, "Too many requests."],
    [500, "Couldn't load the run's results."],
  ])("a %i read shows its message", async (status, message) => {
    api.getProductReconciliationRunResults.mockResolvedValue(failure(status));
    renderAt(`/product-reconciliation/runs/${RUN_A}`);
    expect((await screen.findByRole("alert")).textContent).toContain(message);
  });
});
