import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PRODUCT_1, PRODUCT_2, failure, page, product } from "./catalog-fixtures";

const listUnknownItems = vi.fn();
const inspectUnknownItem = vi.fn();
const linkUnknownItem = vi.fn();
vi.mock("@/lib/unknown-items-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/unknown-items-queries")>();
  return {
    ...actual,
    listUnknownItems: (...a: unknown[]) => listUnknownItems(...a),
    inspectUnknownItem: (...a: unknown[]) => inspectUnknownItem(...a),
    linkUnknownItem: (...a: unknown[]) => linkUnknownItem(...a),
  };
});
const consoleListCatalogProducts = vi.fn();
vi.mock("@/lib/catalog-queries", () => ({
  consoleListCatalogProducts: (...a: unknown[]) => consoleListCatalogProducts(...a),
}));
vi.mock("@/unknown-items/useUnknownItemScope", () => ({
  useUnknownItemScope: () => ({
    activeTenantId: "t1",
    activeTenantName: "Northstar Retail",
    activeStoreId: null,
  }),
}));

import { setLocale } from "@/i18n/locale";
import { renderList } from "./renderUnknownItemList";

/**
 * RT-767: link a pending unknown item to an existing product, chosen with the
 * shared picker. Choosing never writes: a confirm step names the product and the
 * identifier first. Every documented link failure has its own persistent
 * message, and a refusal leaves the operator where they were.
 */
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
const WATER = product({ productId: PRODUCT_1, name: "Mineral water 1.5L" });
const COLA = product({ productId: PRODUCT_2, name: "Cola 330ml", primarySku: "SKU-0043" });

const unknownPage = (...items: unknown[]) => ({
  status: 200,
  data: { items, next_cursor: null },
});
const fail = (status: number, code: string, requestId = `req-${status}`) => ({
  status,
  error: { error: { code, message: "backend english", request_id: requestId } },
});

async function openDrawer(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole("button", { name: "Open 5012345678900" }));
  const drawer = await screen.findByRole("dialog", { name: "Unknown item" });
  await waitFor(() => expect(drawer.textContent).toContain("Identifier type"));
  return drawer;
}

/** Opens the drawer, the link step, and picks the first product: ready to confirm. */
async function reachConfirm(): Promise<HTMLElement> {
  const drawer = await openDrawer();
  fireEvent.click(within(drawer).getByRole("button", { name: "Link to a product" }));
  const options = await within(drawer).findAllByRole("option");
  fireEvent.click(options[0]);
  await within(drawer).findByRole("button", { name: "Link the identifier" });
  return drawer;
}

beforeEach(() => {
  setLocale("en");
  for (const fn of [
    listUnknownItems,
    inspectUnknownItem,
    linkUnknownItem,
    consoleListCatalogProducts,
  ]) {
    fn.mockReset();
  }
  listUnknownItems.mockResolvedValue(unknownPage(PENDING));
  inspectUnknownItem.mockResolvedValue({ status: 200, data: PENDING });
  consoleListCatalogProducts.mockResolvedValue(page([WATER, COLA]));
});

describe("the link step", () => {
  test("is offered on a pending item and opens the picker for the active tenant", async () => {
    renderList();
    const drawer = await openDrawer();
    fireEvent.click(within(drawer).getByRole("button", { name: "Link to a product" }));
    expect(await within(drawer).findByRole("listbox", { name: "Active products" })).toBeDefined();
    expect(consoleListCatalogProducts).toHaveBeenCalledWith({ status: "active", limit: 25 });
    expect(linkUnknownItem).not.toHaveBeenCalled();
  });

  test("is not offered on a resolved item", async () => {
    const dismissed = {
      ...PENDING,
      resolution_status: "dismissed",
      resolution_action: "dismissed",
    };
    listUnknownItems.mockResolvedValue(unknownPage(dismissed));
    inspectUnknownItem.mockResolvedValue({ status: 200, data: dismissed });
    renderList();
    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "dismissed" } });
    fireEvent.click(await screen.findByText("5012345678900"));
    const drawer = await screen.findByRole("dialog", { name: "Unknown item" });
    await within(drawer).findByRole("button", { name: "Reopen" });
    expect(within(drawer).queryByRole("button", { name: "Link to a product" })).toBeNull();
  });

  test("Cancel returns to the actions without a request", async () => {
    renderList();
    const drawer = await openDrawer();
    fireEvent.click(within(drawer).getByRole("button", { name: "Link to a product" }));
    await within(drawer).findByRole("listbox");
    fireEvent.click(within(drawer).getByRole("button", { name: "Cancel" }));
    expect(within(drawer).getByRole("button", { name: "Link to a product" })).toBeDefined();
    expect(linkUnknownItem).not.toHaveBeenCalled();
  });

  test("choosing a product writes nothing: a confirm step names the product and the identifier", async () => {
    renderList();
    const drawer = await reachConfirm();
    expect(linkUnknownItem).not.toHaveBeenCalled();
    const group = within(drawer).getByRole("group", { name: "Confirm the link" });
    expect(group.textContent).toContain("5012345678900");
    expect(group.textContent).toContain("Mineral water 1.5L");
    // The picker that held focus has unmounted: the confirm takes it (Escape and Tab keep working).
    expect(document.activeElement).toBe(group);
  });

  test("Choose another product returns to the picker with nothing sent", async () => {
    renderList();
    const drawer = await reachConfirm();
    fireEvent.click(within(drawer).getByRole("button", { name: "Choose another product" }));
    expect(await within(drawer).findByRole("listbox")).toBeDefined();
    expect(linkUnknownItem).not.toHaveBeenCalled();
  });
});

describe("linking", () => {
  test("success sends the item id and the chosen product id once, closes, and reports on the queue", async () => {
    linkUnknownItem.mockResolvedValue({
      status: 200,
      data: { ...PENDING, resolution_status: "resolved", resolution_action: "linked" },
    });
    renderList();
    const drawer = await reachConfirm();
    const listCalls = listUnknownItems.mock.calls.length;
    fireEvent.click(within(drawer).getByRole("button", { name: "Link the identifier" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(linkUnknownItem).toHaveBeenCalledTimes(1);
    expect(linkUnknownItem).toHaveBeenCalledWith("u1", PRODUCT_1);
    expect(await screen.findByText(/Identifier linked to the product/)).toBeDefined();
    await waitFor(() => expect(listUnknownItems.mock.calls.length).toBeGreaterThan(listCalls));
  });

  test("a second click while the request is in flight sends nothing more", async () => {
    linkUnknownItem.mockReturnValue(new Promise(() => undefined));
    renderList();
    const drawer = await reachConfirm();
    const button = within(drawer).getByRole("button", { name: "Link the identifier" });
    fireEvent.click(button);
    await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));
    fireEvent.click(button);
    expect(linkUnknownItem).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      "400 validation_error",
      fail(400, "validation_error"),
      /could not be linked with this product/,
    ],
    ["403 forbidden", fail(403, "forbidden"), /do not have permission/],
    ["403 origin_rejected", fail(403, "origin_rejected"), /refused a change from this page/],
    ["429", fail(429, "rate_limited"), /Too many requests/],
    ["500", fail(500, "internal"), /try again|went wrong|server/i],
  ])(
    "%s: a persistent message with the request id, the confirm stays",
    async (_n, response, text) => {
      linkUnknownItem.mockResolvedValue(response);
      renderList();
      const drawer = await reachConfirm();
      fireEvent.click(within(drawer).getByRole("button", { name: "Link the identifier" }));
      const alert = await within(drawer).findByRole("alert");
      expect(alert.textContent).toMatch(text);
      expect(alert.textContent).toContain(`req-${response.status}`);
      expect(within(drawer).getByRole("button", { name: "Link the identifier" })).toBeDefined();
      expect(screen.getByRole("dialog")).toBeDefined();
    },
  );

  test("404 is the non-disclosing not-found: no request id, nothing about why", async () => {
    linkUnknownItem.mockResolvedValue(fail(404, "not_found"));
    renderList();
    const drawer = await reachConfirm();
    fireEvent.click(within(drawer).getByRole("button", { name: "Link the identifier" }));
    const alert = await within(drawer).findByRole("alert");
    expect(alert.textContent).toMatch(/This item is not available/);
    expect(alert.textContent).not.toContain("backend english");
    expect(within(drawer).getByRole("button", { name: "Link the identifier" })).toBeDefined();
  });

  test("a request that never completes reads as the generic failure and keeps the confirm", async () => {
    linkUnknownItem.mockRejectedValue(new Error("network"));
    renderList();
    const drawer = await reachConfirm();
    fireEvent.click(within(drawer).getByRole("button", { name: "Link the identifier" }));
    expect(await within(drawer).findByRole("alert")).toBeDefined();
    expect(within(drawer).getByRole("button", { name: "Link the identifier" })).toBeDefined();
  });

  test("alias_conflict is non-disclosing: it names neither the chosen nor any other product", async () => {
    linkUnknownItem.mockResolvedValue(fail(409, "alias_conflict"));
    renderList();
    const drawer = await reachConfirm();
    fireEvent.click(within(drawer).getByRole("button", { name: "Link the identifier" }));
    const alert = await within(drawer).findByRole("alert");
    expect(alert.textContent).toMatch(/already linked to another product/);
    expect(alert.textContent).not.toContain("Mineral water");
    expect(alert.textContent).not.toContain("backend english");
    expect(alert.textContent).toContain("req-409");
  });

  test("target_unavailable keeps the picker open, reads the products again, and clears the choice", async () => {
    linkUnknownItem.mockResolvedValue(fail(409, "target_unavailable"));
    renderList();
    const drawer = await reachConfirm();
    const reads = consoleListCatalogProducts.mock.calls.length;
    fireEvent.click(within(drawer).getByRole("button", { name: "Link the identifier" }));
    const alert = await within(drawer).findByRole("alert");
    expect(alert.textContent).toMatch(/no longer available/);
    const box = await within(drawer).findByRole("listbox", { name: "Active products" });
    expect(within(box).queryAllByRole("option", { selected: true })).toHaveLength(0);
    await waitFor(() =>
      expect(consoleListCatalogProducts.mock.calls.length).toBeGreaterThan(reads),
    );
    expect(screen.getByRole("dialog")).toBeDefined();
  });

  test("choosing another product after a refusal clears the old message", async () => {
    linkUnknownItem.mockResolvedValueOnce(fail(409, "target_unavailable"));
    renderList();
    const drawer = await reachConfirm();
    fireEvent.click(within(drawer).getByRole("button", { name: "Link the identifier" }));
    await within(drawer).findByRole("alert");
    fireEvent.click((await within(drawer).findAllByRole("option"))[1]);
    await within(drawer).findByRole("button", { name: "Link the identifier" });
    expect(within(drawer).queryByRole("alert")).toBeNull();
    expect(within(drawer).getByRole("group", { name: "Confirm the link" }).textContent).toContain(
      "Cola 330ml",
    );
  });

  test("already_reconciled reads the queue and the item again and says it was resolved elsewhere", async () => {
    linkUnknownItem.mockResolvedValue(fail(409, "already_reconciled"));
    renderList();
    const drawer = await reachConfirm();
    const listCalls = listUnknownItems.mock.calls.length;
    const inspectCalls = inspectUnknownItem.mock.calls.length;
    fireEvent.click(within(drawer).getByRole("button", { name: "Link the identifier" }));
    const alert = await within(drawer).findByRole("alert");
    expect(alert.textContent).toMatch(/resolved by someone else/);
    expect(within(drawer).queryByRole("group", { name: "Confirm the link" })).toBeNull();
    await waitFor(() => expect(listUnknownItems.mock.calls.length).toBeGreaterThan(listCalls));
    await waitFor(() => expect(inspectUnknownItem.mock.calls.length).toBeGreaterThan(inspectCalls));
    expect(linkUnknownItem).toHaveBeenCalledTimes(1);
  });
});

describe("picker failures inside the link step", () => {
  test("a catalog error shows in the step, with a retry, and no link is sent", async () => {
    consoleListCatalogProducts.mockResolvedValue(failure(500, "req-cat"));
    renderList();
    const drawer = await openDrawer();
    fireEvent.click(within(drawer).getByRole("button", { name: "Link to a product" }));
    const alert = await within(drawer).findByRole("alert");
    expect(alert.textContent).toContain("req-cat");
    expect(within(drawer).getByRole("button", { name: "Try again" })).toBeDefined();
    expect(linkUnknownItem).not.toHaveBeenCalled();
  });
});

describe("Arabic", () => {
  test("the link step and its confirm render in Arabic", async () => {
    setLocale("ar");
    renderList();
    fireEvent.click(await screen.findByRole("button", { name: /فتح 5012345678900/ }));
    const drawer = await screen.findByRole("dialog");
    fireEvent.click(await within(drawer).findByRole("button", { name: "ربط بصنف" }));
    const options = await within(drawer).findAllByRole("option");
    fireEvent.click(options[0]);
    expect(await within(drawer).findByRole("button", { name: "ربط المعرّف" })).toBeDefined();
  });
});
