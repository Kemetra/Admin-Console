import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

/**
 * RT-753 (UX-10) — sortable headers on the shared DataTable. Sort is opt-in per
 * column and controlled by the caller: DataTable shows the state and reports
 * clicks, it never reorders the rows it is given (sort the dataset, not the
 * viewport).
 */

interface Row {
  id: string;
  name: string;
  code: string;
}

const rows: Row[] = [
  { id: "1", name: "Zeta", code: "Z" },
  { id: "2", name: "Alpha", code: "A" },
];

function columns(sortable: boolean): DataTableColumn<Row>[] {
  return [
    { key: "name", header: "Name", cell: (r) => r.name, sortable },
    { key: "code", header: "Code", cell: (r) => r.code, sortable },
    { key: "note", header: "Note", cell: () => "-" },
  ];
}

function renderTable(props: {
  sortable?: boolean;
  sort?: { key: string; direction: "asc" | "desc" } | null;
  onSortChange?: (next: { key: string; direction: "asc" | "desc" }) => void;
}) {
  return render(
    <DataTable
      caption="Stores"
      columns={columns(props.sortable ?? true)}
      rows={rows}
      rowKey={(r) => r.id}
      onRowActivate={() => {}}
      sort={props.sort}
      onSortChange={props.onSortChange}
    />,
  );
}

describe("DataTable sortable headers", () => {
  test("without opt-in a header has no button and no aria-sort (markup unchanged)", () => {
    renderTable({ sortable: false });
    for (const th of screen.getAllByRole("columnheader")) {
      expect(th.hasAttribute("aria-sort")).toBe(false);
      expect(within(th).queryByRole("button")).toBeNull();
    }
  });

  test("a sortable column is a button inside its header, named by the header text", () => {
    renderTable({ onSortChange: () => {} });
    const th = screen.getByRole("columnheader", { name: "Name" });
    expect(within(th).getByRole("button", { name: "Name" })).toBeTruthy();
  });

  test("a column that is not sortable stays plain even when others are", () => {
    renderTable({ onSortChange: () => {} });
    const th = screen.getByRole("columnheader", { name: "Note" });
    expect(within(th).queryByRole("button")).toBeNull();
    expect(th.hasAttribute("aria-sort")).toBe(false);
  });

  test("aria-sort is set only on the active column", () => {
    renderTable({ sort: { key: "name", direction: "asc" }, onSortChange: () => {} });
    expect(screen.getByRole("columnheader", { name: "Name" }).getAttribute("aria-sort")).toBe(
      "ascending",
    );
    expect(screen.getByRole("columnheader", { name: "Code" }).hasAttribute("aria-sort")).toBe(
      false,
    );
  });

  test("a descending sort reports aria-sort=descending", () => {
    renderTable({ sort: { key: "code", direction: "desc" }, onSortChange: () => {} });
    expect(screen.getByRole("columnheader", { name: "Code" }).getAttribute("aria-sort")).toBe(
      "descending",
    );
  });

  test("direction is drawn as a shape, not only colour, on the active column only", () => {
    const { container } = renderTable({
      sort: { key: "name", direction: "desc" },
      onSortChange: () => {},
    });
    const marks = container.querySelectorAll("[data-sort-direction]");
    expect(marks).toHaveLength(1);
    expect(marks[0]?.getAttribute("data-sort-direction")).toBe("desc");
    expect(marks[0]?.querySelector("svg")).not.toBeNull();
    expect(marks[0]?.closest("th")?.textContent).toContain("Name");
  });

  test("clicking an unsorted column asks for ascending", () => {
    const onSortChange = vi.fn();
    renderTable({ sort: null, onSortChange });
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "name", direction: "asc" });
  });

  test("clicking the ascending column asks for descending", () => {
    const onSortChange = vi.fn();
    renderTable({ sort: { key: "name", direction: "asc" }, onSortChange });
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenCalledWith({ key: "name", direction: "desc" });
  });

  test("the sort control is a native button, so Enter and Space work and it is a tab stop", () => {
    renderTable({ onSortChange: () => {} });
    const button = screen.getByRole("button", { name: "Name" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    expect(button.tabIndex).toBeGreaterThanOrEqual(0);
  });

  test("never reorders the rows it is handed, whatever the sort state", () => {
    renderTable({ sort: { key: "name", direction: "asc" }, onSortChange: () => {} });
    const cells = screen.getAllByRole("row").slice(1);
    expect(cells.map((r) => within(r).getAllByRole("cell")[0]?.textContent)).toEqual([
      "Zeta",
      "Alpha",
    ]);
  });

  test("without a change handler a sortable column renders no control (nothing inert)", () => {
    renderTable({ sort: null });
    expect(screen.queryByRole("button")).toBeNull();
  });
});
