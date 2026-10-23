import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(cleanup);

type Sort = { key: string; direction: "asc" | "desc" } | null;

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
  sort?: Sort;
  onSortChange?: (next: Sort) => void;
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

describe("DataTable three-state sort (RT-758)", () => {
  const ORIGINAL = "Original order restored";
  const live = (container: HTMLElement) => container.querySelector("output[aria-live=polite]");

  function Harness({ initial }: Readonly<{ initial: Sort }>) {
    const [sort, setSort] = useState<Sort>(initial);
    return (
      <DataTable
        caption="Stores"
        columns={columns(true)}
        rows={rows}
        rowKey={(r) => r.id}
        onRowActivate={() => {}}
        sort={sort}
        onSortChange={setSort}
      />
    );
  }

  test("clicking the descending column asks for the server's order (null)", () => {
    const onSortChange = vi.fn();
    renderTable({ sort: { key: "name", direction: "desc" }, onSortChange });
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(onSortChange).toHaveBeenCalledWith(null);
  });

  test("with no sort no header carries aria-sort", () => {
    renderTable({ sort: null, onSortChange: () => {} });
    for (const th of screen.getAllByRole("columnheader")) {
      expect(th.hasAttribute("aria-sort")).toBe(false);
    }
  });

  test("every inactive sortable header shows the decorative sortable hint, not a direction", () => {
    const { container } = renderTable({ sort: null, onSortChange: () => {} });
    const hints = container.querySelectorAll('svg[data-icon="sortable"]');
    expect(hints).toHaveLength(2);
    expect(container.querySelectorAll("[data-sort-direction]")).toHaveLength(0);
    for (const hint of hints) expect(hint.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Name" })).toBeTruthy();
  });

  test("the active column shows its own arrow and no hint; the other keeps the hint", () => {
    const { container } = renderTable({
      sort: { key: "name", direction: "asc" },
      onSortChange: () => {},
    });
    const name = screen.getByRole("columnheader", { name: "Name" });
    const code = screen.getByRole("columnheader", { name: "Code" });
    expect(name.querySelector('svg[data-icon="sortAscending"]')).not.toBeNull();
    expect(name.querySelector('svg[data-icon="sortable"]')).toBeNull();
    expect(code.querySelector('svg[data-icon="sortable"]')).not.toBeNull();
    expect(container.querySelector('svg[data-icon="disclosure"]')).toBeNull();
  });

  test("descending draws the descending arrow", () => {
    const { container } = renderTable({
      sort: { key: "code", direction: "desc" },
      onSortChange: () => {},
    });
    expect(container.querySelector('svg[data-icon="sortDescending"]')).not.toBeNull();
  });

  test("a polite live region exists outside the table, empty on mount (nothing stale)", () => {
    const { container } = render(<Harness initial={null} />);
    expect(live(container)?.textContent).toBe("");
    expect(live(container)?.closest("table")).toBeNull();
  });

  test("the third press removes aria-sort, restores the hint and announces once", () => {
    const { container } = render(<Harness initial={null} />);
    const press = () => fireEvent.click(screen.getByRole("button", { name: "Name" }));
    press();
    expect(screen.getByRole("columnheader", { name: "Name" }).getAttribute("aria-sort")).toBe(
      "ascending",
    );
    expect(live(container)?.textContent).toBe("");
    press();
    expect(live(container)?.textContent).toBe("");
    press();
    const th = screen.getByRole("columnheader", { name: "Name" });
    expect(th.hasAttribute("aria-sort")).toBe(false);
    expect(th.querySelector('svg[data-icon="sortable"]')).not.toBeNull();
    expect(container.textContent?.split(ORIGINAL)).toHaveLength(2);
    expect(live(container)?.textContent).toBe(ORIGINAL);
  });

  test("sorting again clears the announcement", () => {
    const { container } = render(<Harness initial={{ key: "name", direction: "desc" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    expect(live(container)?.textContent).toBe(ORIGINAL);
    fireEvent.click(screen.getByRole("button", { name: "Code" }));
    expect(live(container)?.textContent).toBe("");
  });

  test("a caller reset (sort prop becomes null) announces nothing", () => {
    const table = (sort: Sort) => (
      <DataTable
        caption="Stores"
        columns={columns(true)}
        rows={rows}
        rowKey={(r) => r.id}
        onRowActivate={() => {}}
        sort={sort}
        onSortChange={() => {}}
      />
    );
    const { container, rerender } = render(table({ key: "name", direction: "desc" }));
    rerender(table(null));
    expect(live(container)?.textContent).toBe("");
  });

  test("a table without sorting renders no live region (markup unchanged)", () => {
    const { container } = renderTable({ sortable: false });
    expect(live(container)).toBeNull();
  });
});
