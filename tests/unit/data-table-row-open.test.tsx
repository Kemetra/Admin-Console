import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

/**
 * RT-756 (UX-10 "Selection ≠ Navigation", "Rows Hold Data. Controls Hold
 * Actions"). With `selection` on, the row stops being a click target and a tab
 * stop; an explicit open control in its own cell, named for the row, opens it.
 * Without `selection` nothing changes, so existing consumers need no edits.
 */

interface Row {
  id: string;
  name: string;
}
const rows: Row[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
];
const columns: DataTableColumn<Row>[] = [{ key: "name", header: "Name", cell: (r) => r.name }];

function renderTable(options: { selection: boolean; onOpen?: (r: Row) => void }) {
  return render(
    <DataTable
      caption="Items"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      onRowActivate={options.onOpen ?? (() => {})}
      selection={
        options.selection
          ? {
              selectedKeys: new Set<string>(),
              onSelectionChange: () => {},
              rowLabel: (r) => r.name,
            }
          : undefined
      }
    />,
  );
}

function rowOf(name: string): HTMLElement {
  return screen.getByRole("cell", { name }).closest("tr") as HTMLElement;
}

/** The elements Tab would stop on, in document order (jsdom has no Tab key). */
function tabStops(): HTMLElement[] {
  const all = Array.from(
    document.querySelectorAll<HTMLElement>("table [tabindex], table button, table input"),
  );
  return all.filter((el) => el.tabIndex >= 0);
}

describe("DataTable without selection (unchanged)", () => {
  test("the row is the click target and a tab stop, and there is no open control", () => {
    const onOpen = vi.fn();
    renderTable({ selection: false, onOpen });
    const tr = rowOf("Alpha");
    expect(tr.tabIndex).toBe(0);
    fireEvent.click(tr);
    expect(onOpen).toHaveBeenLastCalledWith(rows[0]);
    fireEvent.keyDown(tr, { key: "Enter" });
    fireEvent.keyDown(tr, { key: " " });
    expect(onOpen).toHaveBeenCalledTimes(3);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  test("the tab stops are exactly the rows", () => {
    renderTable({ selection: false });
    expect(tabStops()).toEqual([rowOf("Alpha"), rowOf("Beta")]);
  });
});

describe("DataTable with selection", () => {
  test("the row is neither a click target nor a tab stop", () => {
    const onOpen = vi.fn();
    renderTable({ selection: true, onOpen });
    const tr = rowOf("Alpha");
    expect(tr.hasAttribute("tabindex")).toBe(false);
    fireEvent.click(tr);
    fireEvent.click(screen.getByRole("cell", { name: "Alpha" }));
    fireEvent.keyDown(tr, { key: "Enter" });
    fireEvent.keyDown(tr, { key: " " });
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("each row has an open button named for the row", () => {
    renderTable({ selection: true });
    for (const r of rows) {
      const button = within(rowOf(r.name)).getByRole("button", { name: `Open ${r.name}` });
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("type")).toBe("button");
    }
  });

  test("the accessible name keeps the visible label (WCAG 2.5.3 label in name)", () => {
    renderTable({ selection: true });
    const button = within(rowOf("Alpha")).getByRole("button", { name: "Open Alpha" });
    expect(button.textContent).toBe("Open");
    expect(button.getAttribute("aria-label")?.startsWith(button.textContent ?? "")).toBe(true);
  });

  test("the open button opens that row only", () => {
    const onOpen = vi.fn();
    renderTable({ selection: true, onOpen });
    fireEvent.click(within(rowOf("Beta")).getByRole("button", { name: "Open Beta" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(rows[1]);
  });

  test("Enter or Space on the checkbox never opens the row", () => {
    const onOpen = vi.fn();
    renderTable({ selection: true, onOpen });
    const box = screen.getByRole("checkbox", { name: "Select Alpha" });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.keyDown(box, { key: " " });
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a click on the open cell outside the button does not open the row", () => {
    const onOpen = vi.fn();
    renderTable({ selection: true, onOpen });
    const cell = within(rowOf("Alpha")).getByRole("button", { name: "Open Alpha" }).closest("td");
    fireEvent.click(cell as HTMLElement);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("keyboard order per row is the checkbox, then the open control", () => {
    renderTable({ selection: true });
    expect(tabStops().map((el) => el.getAttribute("aria-label"))).toEqual([
      "Select all rows on this page",
      "Select Alpha",
      "Open Alpha",
      "Select Beta",
      "Open Beta",
    ]);
  });

  test("the open control comes right after the checkbox, before the data cells", () => {
    renderTable({ selection: true });
    const cells = Array.from(rowOf("Alpha").children);
    expect(cells).toHaveLength(3);
    expect(within(cells[0] as HTMLElement).getByRole("checkbox")).toBeTruthy();
    expect(
      within(cells[1] as HTMLElement).getByRole("button", { name: "Open Alpha" }),
    ).toBeTruthy();
    expect(cells[2]?.textContent).toBe("Alpha");
  });

  test("the open column has a readable header, not an empty one", () => {
    renderTable({ selection: true });
    const headers = screen.getAllByRole("columnheader");
    expect(headers).toHaveLength(3);
    expect(headers[1]?.textContent?.trim()).toBe("Open");
  });
});
