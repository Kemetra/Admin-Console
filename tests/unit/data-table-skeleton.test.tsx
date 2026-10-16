import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { translate } from "@/i18n";
import { setLocale } from "@/i18n/locale";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

/**
 * RT-549 — the loading state of a list table: the real column headers over
 * flat skeleton rows (approved Stores designs 02/07/12), still announced to
 * assistive tech. It is not interactive: no row is a button or a tab stop.
 */

const columns = [
  { key: "name", header: "Store" },
  { key: "code", header: "Code" },
  { key: "state", header: "Status" },
];

describe("DataTableSkeleton", () => {
  test("keeps the real column headers", () => {
    render(<DataTableSkeleton caption="Stores" columns={columns} label="stores" />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Store", "Code", "Status"]);
  });

  test("renders six skeleton rows of one placeholder bar per column", () => {
    const { container } = render(
      <DataTableSkeleton caption="Stores" columns={columns} label="stores" />,
    );
    const bodyRows = container.querySelectorAll("tbody tr");
    expect(bodyRows).toHaveLength(6);
    for (const row of bodyRows) {
      expect(row.querySelectorAll("td .skeleton")).toHaveLength(columns.length);
    }
  });

  test("the table is busy and named by its caption", () => {
    render(<DataTableSkeleton caption="Stores" columns={columns} label="stores" />);
    const table = screen.getByRole("table", { name: "Stores" });
    expect(table.getAttribute("aria-busy")).toBe("true");
  });

  test("announces loading through a status region", () => {
    render(<DataTableSkeleton caption="Stores" columns={columns} label="stores" />);
    expect(screen.getByRole("status").textContent).toBe("Loading stores…");
  });

  test("the placeholder bars are hidden from assistive tech", () => {
    const { container } = render(
      <DataTableSkeleton caption="Stores" columns={columns} label="stores" />,
    );
    for (const bar of container.querySelectorAll(".skeleton")) {
      expect(bar.getAttribute("aria-hidden")).toBe("true");
    }
  });

  test("rows are not interactive", () => {
    const { container } = render(
      <DataTableSkeleton caption="Stores" columns={columns} label="stores" />,
    );
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
    expect(within(container).queryAllByRole("button")).toHaveLength(0);
  });

  test("announces in Arabic when the locale is Arabic", () => {
    setLocale("ar");
    render(
      <DataTableSkeleton
        caption="المتاجر"
        columns={columns}
        label={translate("ar", "stores.list.loadingNoun")}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("جارٍ تحميل المتاجر…");
    setLocale("en");
  });
});
