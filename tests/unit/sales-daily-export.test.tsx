import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ctx, stores } from "./sale-fixtures";
import { CAIRO, EGP_USD_DAY, storeSummary } from "./sales-daily-fixtures";

const consoleGetSalesSummary = vi.fn();
vi.mock("@/lib/sales-summary-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sales-summary-queries")>();
  return {
    ...actual,
    consoleGetSalesSummary: (...a: unknown[]) => consoleGetSalesSummary(...a),
  };
});
const listStores = vi.fn();
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listStores: (...a: unknown[]) => listStores(...a) };
});
vi.mock("@/lib/sale-queries", () => ({
  consoleListSales: vi.fn(),
  consoleGetSale: vi.fn(),
}));
const activeContext = vi.fn();
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => activeContext(),
}));

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { SalesDaily } from "@/sales-daily/SalesDaily";

/**
 * RT-824 (VIZ-6) the export button: one click hands the browser a Blob of
 * the report's CSV (UTF-8 BOM first) as a file named for the range, and
 * makes no request.
 */

const ok = (data: unknown) => ({ status: 200, data });

/** jsdom's Blob has no arrayBuffer(); FileReader reads the same bytes. */
function bytesOf(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

const createObjectURL = vi.fn(() => "blob:test");
const revokeObjectURL = vi.fn();
let clicked: { download: string; href: string } | null = null;

function renderReport(): void {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/sales-daily"]}>
        <Routes>
          <Route path="/sales-daily" element={<SalesDaily />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ExportButton (RT-824, VIZ-6)", () => {
  beforeEach(() => {
    setLocale("en");
    consoleGetSalesSummary.mockReset();
    listStores.mockReset();
    activeContext.mockReset();
    activeContext.mockReturnValue(ctx("owner", "t1", CAIRO));
    listStores.mockResolvedValue({ status: 200, data: stores });
    consoleGetSalesSummary.mockResolvedValue(
      ok(
        storeSummary(
          { ref: CAIRO, timeZone: "Africa/Cairo", currentBusinessDate: "2026-10-23" },
          undefined,
          { "2026-10-20": EGP_USD_DAY },
        ),
      ),
    );
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    clicked = null;
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked = { download: this.download, href: this.href };
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T09:00:00Z"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    setLocale("en");
  });

  test("a click downloads the CSV as a file named for the range, as a UTF-8 Blob with a BOM", async () => {
    renderReport();
    fireEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    expect(blob.type).toBe("text/csv;charset=utf-8");
    const bytes = new Uint8Array(await bytesOf(blob));
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(clicked).toEqual({
      download: "sales-daily_2026-10-16_2026-10-23.csv",
      href: "blob:test",
    });
  });

  test("the file holds the exact figures and names the store", async () => {
    renderReport();
    fireEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    const text = new TextDecoder().decode(await bytesOf(blob));
    expect(text).toContain("1250.5000");
    expect(text).toContain("completeness,received_only");
    expect(text).toContain("Cairo Festival");
  });

  test("while loading or on an error there is nothing to export", async () => {
    consoleGetSalesSummary.mockReturnValue(new Promise(() => undefined));
    renderReport();
    expect(await screen.findByText(/loading the report/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Export CSV" })).toBeNull();
  });
});
