import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { SelectionSummary } from "@/components/SelectionSummary";
import { useRowSelection } from "@/components/useRowSelection";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { useMemo } from "react";
import { describe, expect, test, vi } from "vitest";

/**
 * RT-753 (UX-10) — row selection on the shared DataTable. Selection ≠
 * navigation: the checkbox toggles selection only and never opens the row.
 * Bulk scope is countable and explicit: "this page" and "all matching" are
 * different scopes, and "all matching" is offered only when the caller has an
 * authoritative total and a handler (no backend contract exists yet).
 * Selection never outlives the scope/filter/sort it was made under.
 */

interface Row {
  id: string;
  name: string;
}
const rows: Row[] = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];
const columns: DataTableColumn<Row>[] = [{ key: "name", header: "Name", cell: (r) => r.name }];

function renderTable(
  selected: string[],
  handlers: Partial<{ onSel: (s: ReadonlySet<string>) => void; onOpen: (r: Row) => void }> = {},
) {
  return render(
    <DataTable
      caption="Items"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      onRowActivate={handlers.onOpen ?? (() => {})}
      selection={{
        selectedKeys: new Set(selected),
        onSelectionChange: handlers.onSel ?? (() => {}),
        rowLabel: (r) => r.name,
      }}
    />,
  );
}

describe("DataTable selection column", () => {
  test("without selection there is no checkbox at all (markup unchanged)", () => {
    render(
      <DataTable
        caption="Items"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowActivate={() => {}}
      />,
    );
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  test("each row has a checkbox named for the row, plus one page checkbox in the header", () => {
    renderTable([]);
    expect(screen.getByRole("checkbox", { name: "Select all rows on this page" })).toBeTruthy();
    for (const r of rows) {
      expect(screen.getByRole("checkbox", { name: `Select ${r.name}` })).toBeTruthy();
    }
  });

  test("selected rows are checked", () => {
    renderTable(["b"]);
    expect(
      (screen.getByRole("checkbox", { name: "Select Beta" }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByRole("checkbox", { name: "Select Alpha" }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  test("toggling a row adds it to the selection without opening the row", () => {
    const onSel = vi.fn();
    const onOpen = vi.fn();
    renderTable(["a"], { onSel, onOpen });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Beta" }));
    expect([...(onSel.mock.calls[0]?.[0] as Set<string>)].sort()).toEqual(["a", "b"]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("toggling a selected row removes it", () => {
    const onSel = vi.fn();
    renderTable(["a", "b"], { onSel });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Beta" }));
    expect([...(onSel.mock.calls[0]?.[0] as Set<string>)]).toEqual(["a"]);
  });

  test("Space or Enter on a checkbox never activates the row", () => {
    const onOpen = vi.fn();
    renderTable([], { onOpen });
    const box = screen.getByRole("checkbox", { name: "Select Alpha" });
    fireEvent.keyDown(box, { key: " " });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a row opens from its explicit open control, not from the row itself (RT-756)", () => {
    const onOpen = vi.fn();
    renderTable([], { onOpen });
    const tr = screen.getByRole("checkbox", { name: "Select Alpha" }).closest("tr") as HTMLElement;
    fireEvent.keyDown(tr, { key: "Enter" });
    fireEvent.click(tr);
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(within(tr).getByRole("button", { name: "Open Alpha" }));
    expect(onOpen).toHaveBeenCalledWith(rows[0]);
  });

  test("the header checkbox selects every row on the page", () => {
    const onSel = vi.fn();
    renderTable(["a"], { onSel });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
    expect([...(onSel.mock.calls[0]?.[0] as Set<string>)].sort()).toEqual(["a", "b", "c"]);
  });

  test("when every page row is selected the header checkbox is checked and clears the page", () => {
    const onSel = vi.fn();
    renderTable(["a", "b", "c"], { onSel });
    const head = screen.getByRole("checkbox", {
      name: "Select all rows on this page",
    }) as HTMLInputElement;
    expect(head.checked).toBe(true);
    expect(head.indeterminate).toBe(false);
    fireEvent.click(head);
    expect([...(onSel.mock.calls[0]?.[0] as Set<string>)]).toEqual([]);
  });

  test("a partial selection shows the header checkbox as mixed, not checked", () => {
    renderTable(["a"]);
    const head = screen.getByRole("checkbox", {
      name: "Select all rows on this page",
    }) as HTMLInputElement;
    expect(head.checked).toBe(false);
    expect(head.indeterminate).toBe(true);
  });

  test("the header cell has readable text so the column is not an empty header", () => {
    renderTable([]);
    const th = screen.getAllByRole("columnheader")[0] as HTMLElement;
    expect(within(th).getByRole("checkbox")).toBeTruthy();
    expect(th.textContent?.trim()).not.toBe("");
  });
});

describe("SelectionSummary", () => {
  test("with nothing selected it keeps an empty polite status mounted and shows no controls", () => {
    render(<SelectionSummary selectedCount={0} onClear={() => {}} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByRole("button")).toBeNull();
  });

  test("the same status element announces the first selection (it is not remounted)", () => {
    const { rerender } = render(<SelectionSummary selectedCount={0} onClear={() => {}} />);
    const before = screen.getByRole("status");
    rerender(<SelectionSummary selectedCount={1} onClear={() => {}} />);
    expect(screen.getByRole("status")).toBe(before);
    expect(before.textContent).toBe("1 selected on this page");
  });

  test("the action buttons sit outside the live region so a count change never re-reads them", () => {
    render(
      <SelectionSummary
        selectedCount={3}
        onClear={() => {}}
        allMatching={{ total: 120, onSelect: () => {} }}
      />,
    );
    const status = screen.getByRole("status");
    expect(status.querySelector("button")).toBeNull();
    expect(status.textContent).toBe("3 selected on this page");
    expect(screen.getByRole("button", { name: "Clear selection" })).toBeTruthy();
  });

  test("names the scope as this page and is a polite live region", () => {
    render(<SelectionSummary selectedCount={3} onClear={() => {}} />);
    const status = screen.getByRole("status");
    expect(status.textContent).toContain("3 selected on this page");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  test("singular count", () => {
    render(<SelectionSummary selectedCount={1} onClear={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("1 selected on this page");
  });

  test("without an all-matching capability it never offers all matching", () => {
    render(<SelectionSummary selectedCount={3} onClear={() => {}} />);
    expect(screen.queryByRole("button", { name: /matching/i })).toBeNull();
  });

  test("offers all matching only with an authoritative total larger than the selection", () => {
    const onSelect = vi.fn();
    render(
      <SelectionSummary
        selectedCount={3}
        onClear={() => {}}
        allMatching={{ total: 120, onSelect }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select all 120 matching rows" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test("does not offer all matching when the page already covers the total", () => {
    render(
      <SelectionSummary
        selectedCount={3}
        onClear={() => {}}
        allMatching={{ total: 3, onSelect: () => {} }}
      />,
    );
    expect(screen.queryByRole("button", { name: /matching/i })).toBeNull();
  });

  test("in all-matching mode it states the matching total, not the page count", () => {
    render(
      <SelectionSummary
        selectedCount={3}
        mode="all-matching"
        onClear={() => {}}
        allMatching={{ total: 120, onSelect: () => {} }}
      />,
    );
    const text = screen.getByRole("status").textContent ?? "";
    expect(text).toContain("All 120 matching rows are selected");
    expect(text).not.toContain("on this page");
  });

  test("clear selection calls back", () => {
    const onClear = vi.fn();
    render(<SelectionSummary selectedCount={2} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe("useRowSelection", () => {
  const keys = ["a", "b", "c"];

  test("starts empty in page mode", () => {
    const { result } = renderHook(() => useRowSelection("scope-1", keys));
    expect(result.current.selectedKeys.size).toBe(0);
    expect(result.current.mode).toBe("page");
  });

  test("an explicit selection is kept", () => {
    const { result } = renderHook(() => useRowSelection("scope-1", keys));
    act(() => result.current.setSelectedKeys(new Set(["a", "b"])));
    expect([...result.current.selectedKeys].sort()).toEqual(["a", "b"]);
  });

  test("a change of scope, filter or sort clears the selection", () => {
    const { result, rerender } = renderHook(({ scope }) => useRowSelection(scope, keys), {
      initialProps: { scope: "tenant-1|status=pending|sort=name:asc" },
    });
    act(() => result.current.setSelectedKeys(new Set(["a"])));
    rerender({ scope: "tenant-1|status=pending|sort=name:desc" });
    expect(result.current.selectedKeys.size).toBe(0);
  });

  test("returning to the first scope does not resurrect the old selection", () => {
    const { result, rerender } = renderHook(({ scope }) => useRowSelection(scope, keys), {
      initialProps: { scope: "one" },
    });
    act(() => result.current.setSelectedKeys(new Set(["a"])));
    rerender({ scope: "two" });
    rerender({ scope: "one" });
    expect(result.current.selectedKeys.size).toBe(0);
  });

  test("only rows still listed stay selected (no invisible selection)", () => {
    const { result, rerender } = renderHook(({ listed }) => useRowSelection("s", listed), {
      initialProps: { listed: keys },
    });
    act(() => result.current.setSelectedKeys(new Set(["a", "c"])));
    rerender({ listed: ["a", "b"] });
    expect([...result.current.selectedKeys]).toEqual(["a"]);
  });

  test("a row that left the list and comes back is not selected again", () => {
    const { result, rerender } = renderHook(({ listed }) => useRowSelection("s", listed), {
      initialProps: { listed: keys },
    });
    act(() => result.current.setSelectedKeys(new Set(["a", "c"])));
    rerender({ listed: ["a", "b"] });
    rerender({ listed: keys });
    expect([...result.current.selectedKeys]).toEqual(["a"]);
  });

  test("selecting all matching marks every listed row and switches mode", () => {
    const { result } = renderHook(() => useRowSelection("s", keys));
    act(() => result.current.selectAllMatching());
    expect(result.current.mode).toBe("all-matching");
    expect([...result.current.selectedKeys].sort()).toEqual(keys);
  });

  test("deselecting one row leaves all-matching mode for an explicit selection", () => {
    const { result } = renderHook(() => useRowSelection("s", keys));
    act(() => result.current.selectAllMatching());
    act(() => result.current.setSelectedKeys(new Set(["a", "b"])));
    expect(result.current.mode).toBe("page");
    expect([...result.current.selectedKeys].sort()).toEqual(["a", "b"]);
  });

  test("clear empties the selection and returns to page mode", () => {
    const { result } = renderHook(() => useRowSelection("s", keys));
    act(() => result.current.selectAllMatching());
    act(() => result.current.clear());
    expect(result.current.selectedKeys.size).toBe(0);
    expect(result.current.mode).toBe("page");
  });

  test("a scope change also leaves all-matching mode", () => {
    const { result, rerender } = renderHook(({ scope }) => useRowSelection(scope, keys), {
      initialProps: { scope: "one" },
    });
    act(() => result.current.selectAllMatching());
    rerender({ scope: "two" });
    expect(result.current.mode).toBe("page");
    expect(result.current.selectedKeys.size).toBe(0);
  });
});

/**
 * RT-759 — the three pieces wired the way a screen will wire them. Each piece
 * is covered alone above; this is the contract a consumer relies on once they
 * are composed: the count names its scope, the header checkbox and the
 * summary agree, and nothing selected outlives the scope or the list.
 */
function SelectionHarness(props: { scope: string; rows: Row[]; total?: number }) {
  const listed = useMemo(() => props.rows.map((r) => r.id), [props.rows]);
  const sel = useRowSelection(props.scope, listed);
  return (
    <>
      <SelectionSummary
        selectedCount={sel.selectedKeys.size}
        mode={sel.mode}
        onClear={sel.clear}
        allMatching={
          props.total === undefined
            ? undefined
            : { total: props.total, onSelect: sel.selectAllMatching }
        }
      />
      <DataTable
        caption="Items"
        columns={columns}
        rows={props.rows}
        rowKey={(r) => r.id}
        onRowActivate={() => {}}
        selection={{
          selectedKeys: sel.selectedKeys,
          onSelectionChange: sel.setSelectedKeys,
          rowLabel: (r) => r.name,
        }}
      />
    </>
  );
}

const checkbox = (name: string) => screen.getByRole("checkbox", { name }) as HTMLInputElement;
const pageBox = () => checkbox("Select all rows on this page");
const status = () => screen.getByRole("status").textContent ?? "";

describe("DataTable + useRowSelection + SelectionSummary, composed", () => {
  test("nothing selected: an empty status and no bulk buttons", () => {
    render(<SelectionHarness scope="s" rows={rows} />);
    expect(status()).toBe("");
    // The only buttons are the per-row «Open» controls (RT-756), no bulk actions.
    expect(
      screen
        .queryAllByRole("button")
        .filter((b) => !/^Open /.test(b.getAttribute("aria-label") ?? "")),
    ).toEqual([]);
  });

  test("one row selected: the count names the page and the header shows mixed", () => {
    render(<SelectionHarness scope="s" rows={rows} />);
    fireEvent.click(checkbox("Select Beta"));
    expect(status()).toContain("1 selected on this page");
    expect(pageBox().indeterminate).toBe(true);
    expect(pageBox().checked).toBe(false);
  });

  test("the header checkbox selects the whole page and a second click clears it", () => {
    render(<SelectionHarness scope="s" rows={rows} />);
    fireEvent.click(pageBox());
    expect(status()).toContain("3 selected on this page");
    expect(pageBox().checked).toBe(true);
    expect(pageBox().indeterminate).toBe(false);
    fireEvent.click(pageBox());
    expect(status()).toBe("");
    expect(rows.every((r) => !checkbox(`Select ${r.name}`).checked)).toBe(true);
  });

  test("the clear button empties the selection and the checkboxes follow", () => {
    render(<SelectionHarness scope="s" rows={rows} />);
    fireEvent.click(pageBox());
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(status()).toBe("");
    expect(pageBox().checked).toBe(false);
    expect(checkbox("Select Alpha").checked).toBe(false);
  });

  test("a change of scope clears what was selected", () => {
    const { rerender } = render(<SelectionHarness scope="one" rows={rows} />);
    fireEvent.click(pageBox());
    rerender(<SelectionHarness scope="two" rows={rows} />);
    expect(status()).toBe("");
    expect(checkbox("Select Alpha").checked).toBe(false);
  });

  test("a row that leaves the list drops out of the count and does not return selected", () => {
    const { rerender } = render(<SelectionHarness scope="s" rows={rows} />);
    fireEvent.click(pageBox());
    const fewer = rows.filter((r) => r.id !== "c");
    rerender(<SelectionHarness scope="s" rows={fewer} />);
    expect(status()).toContain("2 selected on this page");
    rerender(<SelectionHarness scope="s" rows={rows} />);
    expect(status()).toContain("2 selected on this page");
    expect(checkbox("Select Gamma").checked).toBe(false);
  });

  test("no all-matching offer without an authoritative total", () => {
    render(<SelectionHarness scope="s" rows={rows} />);
    fireEvent.click(pageBox());
    expect(screen.queryByRole("button", { name: /matching/i })).toBeNull();
  });

  test("all matching: offered with a total, named in the count, and left by unchecking one row", () => {
    render(<SelectionHarness scope="s" rows={rows} total={120} />);
    fireEvent.click(pageBox());
    fireEvent.click(screen.getByRole("button", { name: "Select all 120 matching rows" }));
    expect(status()).toContain("All 120 matching rows are selected");
    expect(rows.every((r) => checkbox(`Select ${r.name}`).checked)).toBe(true);
    fireEvent.click(checkbox("Select Beta"));
    expect(status()).toContain("2 selected on this page");
    expect(screen.getByRole("button", { name: "Select all 120 matching rows" })).toBeTruthy();
  });
});

/**
 * RT-757 — the 36px floor applies to controls inside tables. The checkbox keeps
 * its 18px glyph; the whole selection cell is the target, and it still never
 * opens the row (Selection ≠ navigation). The measured hit-test for the sort
 * button is in tests/e2e/store-list.spec.ts (jsdom has no layout).
 */
describe("DataTable selection cell is the whole target", () => {
  const cellOf = (name: string, tag: "td" | "th") =>
    screen.getByRole("checkbox", { name }).closest(tag) as HTMLElement;

  test("a click on the row's cell, outside the checkbox, toggles it and never opens the row", () => {
    const onSel = vi.fn();
    const onOpen = vi.fn();
    renderTable([], { onSel, onOpen });
    fireEvent.click(cellOf("Select Beta", "td"));
    expect([...onSel.mock.calls[0][0]]).toEqual(["b"]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("a click on the header cell, outside the checkbox, toggles the page", () => {
    const onSel = vi.fn();
    renderTable([], { onSel });
    fireEvent.click(cellOf("Select all rows on this page", "th"));
    expect([...onSel.mock.calls[0][0]].sort()).toEqual(["a", "b", "c"]);
  });

  test("a click on the checkbox itself toggles exactly once (no double toggle from the cell)", () => {
    const onSel = vi.fn();
    renderTable([], { onSel });
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Beta" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all rows on this page" }));
    expect(onSel).toHaveBeenCalledTimes(2);
  });
});
