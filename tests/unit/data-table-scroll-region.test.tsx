import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

/**
 * RT-826 (RT-785 slice 2, decision D4: no card layout). Every table sits in an
 * inline-axis scroll region so a wide table scrolls inside it instead of
 * widening `.content`. The region is keyboard-reachable (axe
 * scrollable-region-focusable) and named by the table's own caption.
 */

interface Row {
  id: string;
  name: string;
}
const columns: DataTableColumn<Row>[] = [{ key: "name", header: "Name", cell: (r) => r.name }];

describe("DataTable scroll region", () => {
  test("wraps the table in a focusable region labelled by its caption", () => {
    render(
      <DataTable
        caption="Stores"
        columns={columns}
        rows={[{ id: "a", name: "Alpha" }]}
        rowKey={(r) => r.id}
        onRowActivate={() => {}}
      />,
    );
    const region = screen.getByRole("region", { name: "Stores" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(region.className).toContain("data-table__scroll");
    expect(within(region).getByRole("table", { name: "Stores" })).toBeTruthy();
  });

  test("two tables on one page get distinct regions", () => {
    render(
      <>
        <DataTable
          caption="First"
          columns={columns}
          rows={[]}
          rowKey={(r) => r.id}
          onRowActivate={() => {}}
        />
        <DataTable
          caption="Second"
          columns={columns}
          rows={[]}
          rowKey={(r) => r.id}
          onRowActivate={() => {}}
        />
      </>,
    );
    expect(screen.getByRole("region", { name: "First" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Second" })).toBeTruthy();
  });

  test("the loading skeleton keeps the same region", () => {
    render(<DataTableSkeleton caption="Stores" columns={columns} label="stores" />);
    const region = screen.getByRole("region", { name: "Stores" });
    expect(region.getAttribute("tabindex")).toBe("0");
  });
});
