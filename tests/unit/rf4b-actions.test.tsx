import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the data layer at the wrapper boundary (no live Backend-Core).
const listUnknownItems = vi.fn();
const inspectUnknownItem = vi.fn();
const createProductFromUnknownItem = vi.fn();
const reopenUnknownItem = vi.fn();
const bulkDismissUnknownItems = vi.fn();
vi.mock("@/lib/unknown-items-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/unknown-items-queries")>();
  return {
    ...actual,
    listUnknownItems: (...a: unknown[]) => listUnknownItems(...a),
    inspectUnknownItem: (...a: unknown[]) => inspectUnknownItem(...a),
    createProductFromUnknownItem: (...a: unknown[]) => createProductFromUnknownItem(...a),
    reopenUnknownItem: (...a: unknown[]) => reopenUnknownItem(...a),
    bulkDismissUnknownItems: (...a: unknown[]) => bulkDismissUnknownItems(...a),
  };
});

vi.mock("@/unknown-items/useUnknownItemScope", () => ({
  useUnknownItemScope: () => ({
    activeTenantId: "t1",
    activeTenantName: "Northstar Retail",
    activeStoreId: null,
  }),
}));

import { setLocale } from "@/i18n/locale";
import { BULK_DISMISS_MAX } from "@/lib/unknown-items-queries";
import { renderList } from "./renderUnknownItemList";

const PENDING = {
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
const PENDING_2 = { ...PENDING, id: "u2", identifier_value: "5012345678917" };
const DISMISSED = {
  ...PENDING,
  id: "u3",
  identifier_value: "6221234567890",
  resolution_status: "dismissed",
  resolution_action: "dismissed",
  resolved_at: "2026-06-11T10:00:00Z",
  resolved_by: "a1",
};

const page = (...items: unknown[]) => ({ status: 200, data: { items, next_cursor: null } });
const fail = (status: number, code: string, requestId = `req-${status}`) => ({
  status,
  error: { error: { code, message: "backend english", request_id: requestId } },
});

// RT-771: the pending queue is in selection mode, so a row opens through its
// explicit «Open» control; a status without selection still opens on the row.
async function openDrawer(value: string, pending = true): Promise<HTMLElement> {
  fireEvent.click(
    pending
      ? await screen.findByRole("button", { name: `Open ${value}` })
      : await screen.findByText(value),
  );
  const drawer = await screen.findByRole("dialog", { name: "Unknown item" });
  await waitFor(() => expect(drawer.textContent).toContain("Identifier type"));
  return drawer;
}

beforeEach(() => {
  setLocale("en");
  for (const fn of [
    listUnknownItems,
    inspectUnknownItem,
    createProductFromUnknownItem,
    reopenUnknownItem,
    bulkDismissUnknownItems,
  ]) {
    fn.mockReset();
  }
});

describe("create product from an unknown item", () => {
  async function openForm(): Promise<HTMLElement> {
    listUnknownItems.mockResolvedValue(page(PENDING));
    inspectUnknownItem.mockResolvedValue({ status: 200, data: PENDING });
    renderList();
    const drawer = await openDrawer("5012345678900");
    fireEvent.click(within(drawer).getByRole("button", { name: "Create product" }));
    return drawer;
  }

  function fill(drawer: HTMLElement): void {
    fireEvent.change(within(drawer).getByLabelText("Product name"), {
      target: { value: "  Sparkling water 1L " },
    });
    fireEvent.change(within(drawer).getByLabelText("Tax category"), {
      target: { value: "VAT14" },
    });
  }

  function submit(drawer: HTMLElement): void {
    fireEvent.click(within(drawer).getByRole("button", { name: "Create the product" }));
  }

  test("success: sends trimmed name + tax category, closes and reports on the queue", async () => {
    createProductFromUnknownItem.mockResolvedValue({
      status: 201,
      data: { ...PENDING, resolution_status: "resolved", resolution_action: "created" },
    });
    const drawer = await openForm();
    fill(drawer);
    const listCalls = listUnknownItems.mock.calls.length;
    submit(drawer);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(createProductFromUnknownItem).toHaveBeenCalledWith("u1", {
      name: "Sparkling water 1L",
      tax_category: "VAT14",
    });
    expect(await screen.findByText(/Product created/)).toBeDefined();
    await waitFor(() => expect(listUnknownItems.mock.calls.length).toBeGreaterThan(listCalls));
  });

  test("both inputs are announced as required", async () => {
    const drawer = await openForm();
    expect(within(drawer).getByLabelText("Product name").getAttribute("aria-required")).toBe(
      "true",
    );
    expect(within(drawer).getByLabelText("Tax category").getAttribute("aria-required")).toBe(
      "true",
    );
  });

  test("empty fields are caught before any request", async () => {
    const drawer = await openForm();
    submit(drawer);
    expect(await within(drawer).findByText("Enter a product name.")).toBeDefined();
    expect(within(drawer).getByText("Enter a tax category.")).toBeDefined();
    expect(createProductFromUnknownItem).not.toHaveBeenCalled();
  });

  test.each([
    [fail(400, "validation_error"), /could not be created with these details/],
    [fail(403, "forbidden"), /do not have permission/],
    [fail(404, "not_found"), /This item is not available/],
    [fail(409, "alias_conflict"), /already linked to another product/],
    [fail(409, "already_reconciled"), /already been resolved/],
    [fail(409, "target_unavailable"), /no longer available/],
    [fail(429, "rate_limited"), /Too many requests/],
  ])("error %# renders its copy, keeps the input, and is not retried", async (res, copy) => {
    createProductFromUnknownItem.mockResolvedValue(res);
    const drawer = await openForm();
    fill(drawer);
    submit(drawer);
    expect(await within(drawer).findByText(copy)).toBeDefined();
    expect(within(drawer).queryByText(/backend english/)).toBeNull();
    // the drawer stays open with what the operator typed
    expect((within(drawer).getByLabelText("Product name") as HTMLInputElement).value).toBe(
      "  Sparkling water 1L ",
    );
    expect((within(drawer).getByLabelText("Tax category") as HTMLInputElement).value).toBe("VAT14");
    expect(createProductFromUnknownItem).toHaveBeenCalledTimes(1);
  });

  test("alias_conflict never discloses the conflicting product", async () => {
    createProductFromUnknownItem.mockResolvedValue({
      status: 409,
      error: {
        error: {
          code: "alias_conflict",
          message: "bound to product Secret Cola (p-999)",
          request_id: "req-409",
        },
      },
    });
    const drawer = await openForm();
    fill(drawer);
    submit(drawer);
    await within(drawer).findByText(/already linked to another product/);
    expect(drawer.textContent).not.toMatch(/Secret Cola|p-999/);
    expect(drawer.textContent).toContain("req-409");
  });

  test("a dropped request shows a generic error and keeps the input", async () => {
    createProductFromUnknownItem.mockRejectedValue(new TypeError("network"));
    const drawer = await openForm();
    fill(drawer);
    submit(drawer);
    expect(await within(drawer).findByText(/Something went wrong/)).toBeDefined();
    expect((within(drawer).getByLabelText("Tax category") as HTMLInputElement).value).toBe("VAT14");
  });

  test("Arabic: the form reads Arabic copy", async () => {
    setLocale("ar");
    listUnknownItems.mockResolvedValue(page(PENDING));
    inspectUnknownItem.mockResolvedValue({ status: 200, data: PENDING });
    createProductFromUnknownItem.mockResolvedValue(fail(409, "alias_conflict"));
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: "فتح 5012345678900" }));
    const drawer = await screen.findByRole("dialog", { name: "صنف غير معروف" });
    fireEvent.click(await within(drawer).findByRole("button", { name: "إنشاء صنف" }));
    fireEvent.change(within(drawer).getByLabelText("اسم الصنف"), { target: { value: "مياه" } });
    fireEvent.change(within(drawer).getByLabelText("فئة الضريبة"), { target: { value: "VAT14" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "إنشاء الصنف" }));
    expect(await within(drawer).findByText(/مرتبط بالفعل بصنف آخر/)).toBeDefined();
  });

  test("no link affordance and no product-id field (link is deferred)", async () => {
    const drawer = await openForm();
    expect(within(drawer).queryByRole("button", { name: /link/i })).toBeNull();
    expect(within(drawer).queryByLabelText(/product id/i)).toBeNull();
    expect(within(drawer).getAllByRole("textbox")).toHaveLength(2);
  });
});

describe("reopen a dismissed item", () => {
  async function openDismissed(): Promise<HTMLElement> {
    listUnknownItems.mockResolvedValue(page(DISMISSED));
    inspectUnknownItem.mockResolvedValue({ status: 200, data: DISMISSED });
    renderList();
    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "dismissed" } });
    await waitFor(() =>
      expect(listUnknownItems.mock.calls.at(-1)?.[0]).toMatchObject({ status: "dismissed" }),
    );
    return openDrawer("6221234567890", false);
  }

  test("a pending item offers no reopen; a dismissed one offers no create/dismiss", async () => {
    const drawer = await openDismissed();
    expect(within(drawer).getByRole("button", { name: "Reopen" })).toBeDefined();
    expect(within(drawer).queryByRole("button", { name: "Create product" })).toBeNull();
    expect(within(drawer).queryByRole("button", { name: "Dismiss" })).toBeNull();
  });

  test("success: reopens with an Idempotency-Key, closes and reports", async () => {
    reopenUnknownItem.mockResolvedValue({
      status: 201,
      data: { ...DISMISSED, id: "u4", resolution_status: "pending", resolution_action: null },
    });
    const drawer = await openDismissed();
    fireEvent.click(within(drawer).getByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(reopenUnknownItem).toHaveBeenCalledWith(
      "u3",
      expect.stringMatching(/^[\x21-\x7E]{16,128}$/),
    );
    expect(await screen.findByText(/Item reopened/)).toBeDefined();
  });

  test.each([
    [fail(403, "forbidden"), /tenant-wide authority/],
    [fail(404, "not_found"), /This item is not available/],
    [fail(409, "already_reconciled"), /only a dismissed item can be reopened/],
    [fail(409, "idempotency_key_conflict"), /conflicted with an earlier attempt/],
    [fail(425, "idempotency_in_progress"), /still being processed/],
    [fail(429, "rate_limited"), /Too many requests/],
  ])("error %# renders its copy once, with no automatic retry", async (res, copy) => {
    reopenUnknownItem.mockResolvedValue(res);
    const drawer = await openDismissed();
    fireEvent.click(within(drawer).getByRole("button", { name: "Reopen" }));
    expect(await within(drawer).findByText(copy)).toBeDefined();
    expect(reopenUnknownItem).toHaveBeenCalledTimes(1);
  });

  test("a manual retry after 425 replays the same key; after a 409 key conflict a new one", async () => {
    reopenUnknownItem
      .mockResolvedValueOnce(fail(425, "idempotency_in_progress"))
      .mockResolvedValueOnce(fail(409, "idempotency_key_conflict"))
      .mockResolvedValueOnce(fail(403, "forbidden"));
    const drawer = await openDismissed();
    const reopen = () => fireEvent.click(within(drawer).getByRole("button", { name: "Reopen" }));
    reopen();
    await within(drawer).findByText(/still being processed/);
    reopen();
    await within(drawer).findByText(/conflicted with an earlier attempt/);
    reopen();
    await within(drawer).findByText(/tenant-wide authority/);
    const keys = reopenUnknownItem.mock.calls.map((c) => c[1]);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[1]);
  });
});

/** The checked row checkboxes (not the page-level one). */
function selectedCount(): number {
  return screen
    .queryAllByRole("checkbox", { checked: true })
    .filter((c) => !c.getAttribute("aria-label")?.startsWith("Select all")).length;
}

describe("bulk dismiss", () => {
  async function selectBoth(): Promise<void> {
    listUnknownItems.mockResolvedValue(page(PENDING, PENDING_2));
    renderList();
    fireEvent.click(await screen.findByLabelText("Select 5012345678900"));
    fireEvent.click(screen.getByLabelText("Select 5012345678917"));
    expect(screen.getByText("2 selected on this page")).toBeDefined();
  }

  function confirm(): void {
    fireEvent.click(screen.getByRole("button", { name: "Dismiss selected" }));
    const region = screen.getByRole("region", {
      name: "Confirm: Dismiss selected",
    });
    expect(region.textContent).toContain("2 items");
    fireEvent.click(within(region).getByRole("button", { name: "Dismiss selected" }));
  }

  test("ticking a row selects it without opening the drawer", async () => {
    await selectBoth();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(inspectUnknownItem).not.toHaveBeenCalled();
  });

  test("success: per-outcome counts, the selection clears and the queue refreshes", async () => {
    bulkDismissUnknownItems.mockResolvedValue({
      status: 200,
      data: {
        outcomes: [
          { id: "u1", outcome: "dismissed", details: null },
          { id: "u2", outcome: "already_reconciled", details: { prior_state: "resolved" } },
        ],
      },
    });
    await selectBoth();
    const listCalls = listUnknownItems.mock.calls.length;
    confirm();
    expect(await screen.findByText("1 item dismissed.")).toBeDefined();
    expect(screen.getByText(/1 item was already resolved/)).toBeDefined();
    expect(bulkDismissUnknownItems).toHaveBeenCalledWith(
      ["u1", "u2"],
      expect.stringMatching(/^[\x21-\x7E]{16,128}$/),
    );
    expect(selectedCount()).toBe(0);
    await waitFor(() => expect(listUnknownItems.mock.calls.length).toBeGreaterThan(listCalls));
  });

  test("the body is the sorted id set, so a manual retry replays the same body under its key", async () => {
    bulkDismissUnknownItems
      .mockResolvedValueOnce(fail(503, "unavailable"))
      .mockResolvedValueOnce({ status: 200, data: { outcomes: [] } });
    listUnknownItems.mockResolvedValue(page(PENDING_2, PENDING));
    renderList();
    // tick in the reverse of the id order
    fireEvent.click(await screen.findByLabelText("Select 5012345678917"));
    fireEvent.click(screen.getByLabelText("Select 5012345678900"));
    confirm();
    await screen.findByText(/Something went wrong/);
    confirm();
    await waitFor(() => expect(bulkDismissUnknownItems).toHaveBeenCalledTimes(2));
    const [first, second] = bulkDismissUnknownItems.mock.calls;
    expect(first[0]).toEqual(["u1", "u2"]);
    expect(second[0]).toEqual(["u1", "u2"]);
    expect(second[1]).toBe(first[1]);
  });

  test("a not_found outcome is counted without naming the item", async () => {
    bulkDismissUnknownItems.mockResolvedValue({
      status: 200,
      data: {
        outcomes: [
          { id: "u1", outcome: "not_found" },
          { id: "u2", outcome: "not_found" },
        ],
      },
    });
    await selectBoth();
    confirm();
    expect(await screen.findByText(/2 items are no longer available/)).toBeDefined();
  });

  test.each([
    [fail(400, "validation"), /whole request was rejected and nothing was dismissed.*200/],
    [fail(403, "forbidden"), /do not have permission/],
    [fail(409, "idempotency_key_conflict"), /conflicted with an earlier attempt/],
    [fail(425, "idempotency_in_progress"), /still being processed/],
    [fail(429, "rate_limited"), /Too many requests/],
  ])("error %# renders its copy, keeps the selection, and is not retried", async (res, copy) => {
    bulkDismissUnknownItems.mockResolvedValue(res);
    await selectBoth();
    confirm();
    expect(await screen.findByText(copy)).toBeDefined();
    expect(screen.getByText("2 selected on this page")).toBeDefined();
    expect(bulkDismissUnknownItems).toHaveBeenCalledTimes(1);
  });

  test("select-all covers the page and toggles it back off", async () => {
    listUnknownItems.mockResolvedValue(page(PENDING, PENDING_2));
    renderList();
    const all = await screen.findByLabelText("Select all rows on this page");
    fireEvent.click(all);
    expect(screen.getByText("2 selected on this page")).toBeDefined();
    expect(selectedCount()).toBe(2);
    fireEvent.click(all);
    expect(selectedCount()).toBe(0);
  });

  test("a partial selection marks the page checkbox mixed", async () => {
    listUnknownItems.mockResolvedValue(page(PENDING, PENDING_2));
    renderList();
    fireEvent.click(await screen.findByLabelText("Select 5012345678900"));
    const all = screen.getByLabelText("Select all rows on this page") as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    expect(all.checked).toBe(false);
  });

  test.each([
    ["sort", "Sort", "age_asc"],
    ["group by", "Group by", "store"],
    ["source system", "Source system", "erp"],
  ])("changing the %s empties the selection", async (_name, label, value) => {
    listUnknownItems.mockResolvedValue(page(PENDING, PENDING_2));
    renderList();
    fireEvent.click(await screen.findByLabelText("Select all rows on this page"));
    expect(selectedCount()).toBe(2);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    await waitFor(() => expect(selectedCount()).toBe(0));
  });

  test("changing the status empties the selection, and coming back does not restore it", async () => {
    listUnknownItems.mockResolvedValue(page(PENDING, PENDING_2));
    renderList();
    fireEvent.click(await screen.findByLabelText("Select all rows on this page"));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "dismissed" } });
    await waitFor(() => expect(screen.queryAllByRole("checkbox")).toHaveLength(0));
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "pending" } });
    await screen.findByLabelText("Select 5012345678900");
    expect(selectedCount()).toBe(0);
  });

  test("the row never opens on a checkbox or cell click; the open control opens it", async () => {
    listUnknownItems.mockResolvedValue(page(PENDING));
    inspectUnknownItem.mockResolvedValue({ status: 200, data: PENDING });
    renderList();
    const box = await screen.findByLabelText("Select 5012345678900");
    fireEvent.click(box);
    fireEvent.click(box.closest("td") as HTMLElement);
    fireEvent.click(screen.getByText("5012345678900"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(inspectUnknownItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open 5012345678900" }));
    expect(await screen.findByRole("dialog", { name: "Unknown item" })).toBeDefined();
  });

  test("more than 200 selected blocks the dismiss and says why", async () => {
    const many = Array.from({ length: BULK_DISMISS_MAX + 1 }, (_, i) => ({
      ...PENDING,
      id: `m${i}`,
      identifier_value: `990${i}`,
    }));
    listUnknownItems.mockResolvedValue(page(...many));
    renderList();
    fireEvent.click(await screen.findByLabelText("Select all rows on this page"));
    expect(screen.getByText(/at most 200 items/)).toBeDefined();
    expect(
      (screen.getByRole("button", { name: "Dismiss selected" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(bulkDismissUnknownItems).not.toHaveBeenCalled();
  });

  test("the confirm step does not survive a scope change", async () => {
    listUnknownItems.mockResolvedValue(page(PENDING, PENDING_2));
    renderList();
    fireEvent.click(await screen.findByLabelText("Select all rows on this page"));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss selected" }));
    expect(screen.getByRole("region", { name: "Confirm: Dismiss selected" })).toBeDefined();
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "age_asc" } });
    // Closed by the scope change itself, before any re-selection could reset it.
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Confirm: Dismiss selected" })).toBeNull(),
    );
    fireEvent.click(await screen.findByLabelText("Select all rows on this page"));
    expect(selectedCount()).toBe(2);
    expect(screen.queryByRole("region", { name: "Confirm: Dismiss selected" })).toBeNull();
  });

  test("the bar is offered on the pending queue only", async () => {
    listUnknownItems.mockResolvedValue(page(DISMISSED));
    renderList();
    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "dismissed" } });
    await screen.findByText("6221234567890");
    expect(screen.queryByRole("button", { name: "Dismiss selected" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
