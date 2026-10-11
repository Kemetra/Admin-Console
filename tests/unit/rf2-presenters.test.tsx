import { ConfirmDelete } from "@/components/ConfirmDelete";
import { DataTable } from "@/components/DataTable";
import { ListState } from "@/components/ListState";
import { translate } from "@/i18n";
import { setLocale } from "@/i18n/locale";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

/**
 * Shared RF-2 presenters (T006/T007/T008). Tables-over-cards (DESIGN.md rule 7),
 * a first-class state matrix (PRODUCT.md Principle 4), and a destructive-confirm
 * affordance that names the resource (single-primary, no reflexive modal).
 */

interface Row {
  id: string;
  name: string;
  slug: string;
}

const rows: Row[] = [
  { id: "t1", name: "Northstar Retail", slug: "northstar" },
  { id: "t2", name: "Helios Markets", slug: "helios" },
];

const columns = [
  { key: "name", header: "Name", cell: (r: Row) => r.name },
  { key: "slug", header: "Slug", cell: (r: Row) => r.slug, mono: true },
];

describe("DataTable", () => {
  test("renders a row per item with the column headers", () => {
    render(
      <DataTable
        caption="Tenants"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowActivate={() => {}}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeDefined();
    expect(screen.getByText("Northstar Retail")).toBeDefined();
    expect(screen.getByText("Helios Markets")).toBeDefined();
    // backend-scoped: exactly the rows handed in, no client filtering
    expect(screen.getAllByRole("row")).toHaveLength(rows.length + 1); // + header row
  });

  test("activates a row on click (row -> detail)", () => {
    const onRowActivate = vi.fn();
    render(
      <DataTable
        caption="Tenants"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowActivate={onRowActivate}
      />,
    );
    fireEvent.click(screen.getByText("Northstar Retail"));
    expect(onRowActivate).toHaveBeenCalledWith(rows[0]);
  });

  test("activates a row on Enter key (keyboard navigable)", () => {
    const onRowActivate = vi.fn();
    render(
      <DataTable
        caption="Tenants"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowActivate={onRowActivate}
      />,
    );
    const firstDataRow = screen.getAllByRole("row")[1];
    fireEvent.keyDown(firstDataRow, { key: "Enter" });
    expect(onRowActivate).toHaveBeenCalledWith(rows[0]);
  });
});

describe("ListState", () => {
  test("loading shows a distinct loading affordance", () => {
    render(<ListState state="loading" label="tenants" />);
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  test("empty is a successful zero-row state, distinct from loading and error", () => {
    render(
      <ListState
        state="empty"
        emptyMessage="No tenants yet."
        action={<button type="button">New tenant</button>}
      />,
    );
    expect(screen.getByText("No tenants yet.")).toBeDefined();
    // create entry point still present in empty state (never role-hidden, OQ-3)
    expect(screen.getByRole("button", { name: "New tenant" })).toBeDefined();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });

  test("renders nothing for the default/success states (table renders instead)", () => {
    const { container } = render(<ListState state="ready" />);
    expect(container.firstChild).toBeNull();
  });
});

describe("ConfirmDelete", () => {
  test("names the exact resource and asks to confirm", () => {
    render(
      <ConfirmDelete
        resourceName="Northstar Retail"
        confirmLabel="Soft-delete"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/Northstar Retail/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Soft-delete" })).toBeDefined();
  });

  test("confirm fires onConfirm; cancel fires onCancel", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDelete
        resourceName="Helios Markets"
        confirmLabel="Soft-delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Soft-delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  test("disables the confirm button while the delete is in flight", () => {
    render(
      <ConfirmDelete
        resourceName="Helios Markets"
        confirmLabel="Soft-delete"
        pending
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Soft-delete" }).hasAttribute("disabled")).toBe(true);
  });
});

describe("RF-2 presenters in Arabic (RT-399)", () => {
  // The RF-2 surfaces pass catalog copy into the shared presenters' string props.
  const ar = (key: Parameters<typeof translate>[1]) => translate("ar", key);

  test("the soft-delete confirm reads in Arabic and names the resource as authored", () => {
    setLocale("ar");
    render(
      <ConfirmDelete
        resourceName="Northstar Retail"
        confirmLabel={ar("tenants.detail.softDelete")}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("region", { name: "تأكيد: حذف" })).toBeDefined();
    expect(screen.getByRole("button", { name: "حذف" })).toBeDefined();
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeDefined();
    expect(screen.getByText("Northstar Retail")).toBeDefined();
  });

  test("the roster table and loading state take Arabic catalog copy", () => {
    setLocale("ar");
    render(
      <>
        <DataTable
          caption={ar("tenants.list.caption")}
          columns={[
            { key: "name", header: ar("tenants.field.name"), cell: (r: Row) => r.name },
            { key: "slug", header: ar("tenants.field.slug"), cell: (r: Row) => r.slug },
          ]}
          rows={rows}
          rowKey={(r) => r.id}
          onRowActivate={() => {}}
        />
        <ListState state="loading" label={ar("stores.list.loadingNoun")} />
      </>,
    );
    expect(screen.getByRole("table", { name: "المؤسسات" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "المعرّف المختصر" })).toBeDefined();
    expect(screen.getByText("جارٍ تحميل المتاجر…")).toBeDefined();
  });
});
