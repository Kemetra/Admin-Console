import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { DocumentLocale } from "@/i18n";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/tokens.css";
import "@/styles/controls.css";
import "@/styles/a11y.css";

/**
 * RT-756 e2e harness: the shared DataTable in selection mode, mounted on its
 * own because no Console screen adopts selection yet (RT-771 is the first).
 * Never shipped: tests/e2e/harness/build.ts bundles it into a temp directory
 * for the Playwright run only. It imports the real component and the app's own
 * stylesheets, so what axe sees is what a screen would render.
 */

interface Row {
  id: string;
  name: string;
  code: string;
}

const ROWS: Row[] = [
  { id: "a", name: "Alpha", code: "A-100" },
  { id: "b", name: "Beta", code: "B-200" },
  { id: "c", name: "Gamma", code: "C-300" },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", cell: (r) => r.name },
  { key: "code", header: "Code", cell: (r) => r.code, mono: true },
];

function Harness(): React.JSX.Element {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <>
      <DocumentLocale />
      <DataTable
        caption="Items"
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(r) => r.id}
        onRowActivate={(r) => setOpened(r.name)}
        selection={{
          selectedKeys: selected,
          onSelectionChange: setSelected,
          rowLabel: (r) => r.name,
        }}
      />
      <output>{opened === null ? "Nothing opened" : `Opened: ${opened}`}</output>
    </>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");
createRoot(root).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
