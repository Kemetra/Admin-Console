import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { type ClaimContext, type ClaimState, MetricClaims } from "@/components/MetricClaim";
import { setLocale } from "@/i18n/locale";
import type { SalesSummary } from "@/lib/sales-summary-queries";
import type { MetricId } from "@/metrics/metricRegistry";
import { KPIS, ZERO_KPIS as ZERO } from "./metric-claim-fixtures";

/**
 * RT-819 (VIZ-1) shared KPI claim. Every state of one figure: loading, hidden
 * (403/404, no row), error with retry, unknown (a word, never 0), zero (a real
 * 0, no invented amount) and ready (one line per currency, never summed). The
 * context line always says scope, period, zone, `asOf` and completeness. No
 * delta, no colour, no count-up.
 */

type Kpis = SalesSummary["scopeTotals"]["rangeTotals"];

const STORE_CONTEXT: ClaimContext = {
  scope: { kind: "store", storeName: "Heliopolis", timeZone: "Africa/Cairo" },
  period: { from: "2026-10-23", to: "2026-10-23", partial: true },
  asOf: "2026-10-23T10:15:00Z",
  completeness: "received_only",
};

const SCOPE_CONTEXT: ClaimContext = {
  scope: { kind: "all_in_scope", storeCount: 3, timeZones: ["Africa/Cairo", "UTC"] },
  period: { from: "2026-10-01", to: "2026-10-07" },
  asOf: "2026-10-23T10:15:00Z",
  completeness: "received_only",
};

function one(metric: MetricId, state: ClaimState, context: ClaimContext = STORE_CONTEXT) {
  return render(<MetricClaims context={context} claims={[{ metric, state }]} />);
}

function value(label: string): HTMLElement {
  const term = screen.getByText(label, { selector: "dt" });
  const dd = term.nextElementSibling;
  if (!(dd instanceof HTMLElement)) throw new Error(`no value for ${label}`);
  return dd;
}

describe("RT-819 MetricClaim states", () => {
  test("loading: a busy indicator in the value, no figure", () => {
    one("receivedSales", { status: "loading" });
    const dd = value("Received sales");
    expect(dd.getAttribute("aria-busy")).toBe("true");
    expect(dd.textContent).toContain("Loading");
    expect(dd.textContent).not.toMatch(/\d/);
  });

  test("hidden (403/404): the claim renders no row at all", () => {
    one("receivedSales", { status: "hidden" });
    expect(screen.queryByText("Received sales")).toBeNull();
  });

  test("every claim hidden: nothing renders, not even the context", () => {
    const { container } = one("receivedSales", { status: "hidden" });
    expect(container.innerHTML).toBe("");
  });

  test("error: an alert with the request reference and a retry that re-reads", () => {
    const retry = vi.fn();
    one("receivedSales", { status: "error", requestId: "req-42", retry });
    const dd = value("Received sales");
    const alert = within(dd).getByRole("alert");
    expect(alert.textContent).toContain("Couldn't load this figure");
    expect(alert.textContent).toContain("req-42");
    expect(dd.textContent).not.toMatch(/\b0\b/);
    fireEvent.click(within(dd).getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test("error retry button is described by its claim label", () => {
    one("receivedSales", { status: "error", retry: () => undefined });
    const button = screen.getByRole("button", { name: "Retry" });
    const describedBy = button.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)?.textContent).toBe("Received sales");
  });

  test("unknown is a word with its reason, never 0", () => {
    one("receivedSales", { status: "unknown" });
    const dd = value("Received sales");
    expect(dd.textContent).toContain("Unknown");
    expect(dd.textContent).toContain("not zero");
    expect(dd.textContent).not.toMatch(/\d/);
  });

  test("zero is a real 0 with no invented amount or currency", () => {
    one("receivedSales", { status: "ready", data: ZERO });
    const dd = value("Received sales");
    expect(dd.querySelector(".metric-claim__count")?.textContent).toBe("0");
    expect(dd.textContent).toContain("No amount");
    expect(dd.textContent).not.toMatch(/EGP|USD|0\.00/);
  });

  test("unknown and zero never render the same", () => {
    const { container: u } = one("receivedSales", { status: "unknown" });
    const unknownText = u.textContent;
    const { container: z } = one("receivedSales", { status: "ready", data: ZERO });
    expect(z.textContent).not.toBe(unknownText);
  });

  test("ready: one line per currency in contract order, never a combined total", () => {
    one("receivedSales", { status: "ready", data: KPIS });
    const dd = value("Received sales");
    expect(dd.querySelector(".metric-claim__count")?.textContent).toBe("14");
    const lines = within(dd)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(lines).toEqual([
      expect.stringContaining("1,250.50 EGP"),
      expect.stringContaining("40.00 USD"),
    ]);
    // 1250.50 + 40.00 never appears as one figure.
    expect(dd.textContent).not.toContain("1,290.50");
  });

  test("money is isolated LTR in a bdi", () => {
    one("receivedSales", { status: "ready", data: KPIS });
    const bdi = value("Received sales").querySelector("bdi");
    expect(bdi?.getAttribute("dir")).toBe("ltr");
  });

  test("ERP posting keeps 'unknown' as its own word, beside posted/pending/failed", () => {
    one("erpPosting", { status: "ready", data: KPIS });
    const dd = value("ERP posting state");
    const parts = within(dd)
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(parts).toEqual(["Posted: 9", "Pending: 2", "Failed: 1", "Unknown: 2"]);
  });

  test("shift closes: outcomes and the approval-missing tri-state, unknown kept", () => {
    one("shiftCloses", { status: "ready", data: KPIS });
    const dd = value("Shift closes");
    expect(dd.querySelector(".metric-claim__count")?.textContent).toBe("3");
    expect(dd.textContent).toContain("Approval missing, unknown: 1");
    expect(dd.textContent).toContain("Forced: 1");
  });

  test("hidden claims drop out while others stay", () => {
    render(
      <MetricClaims
        context={STORE_CONTEXT}
        claims={[
          { metric: "receivedSales", state: { status: "ready", data: KPIS } },
          { metric: "erpPosting", state: { status: "hidden" } },
        ]}
      />,
    );
    expect(screen.getByText("Received sales")).toBeTruthy();
    expect(screen.queryByText("ERP posting state")).toBeNull();
  });
});

describe("RT-819 MetricClaim context", () => {
  test("store scope: store, single business date marked so far, zone, asOf in store zone, completeness", () => {
    one("receivedSales", { status: "ready", data: KPIS });
    const ctx = screen.getByTestId("metric-claims-context");
    expect(ctx.textContent).toContain("Heliopolis");
    expect(ctx.textContent).toContain("Oct 23, 2026");
    expect(ctx.textContent).toContain("so far");
    expect(ctx.textContent).toContain("Africa/Cairo");
    // 10:15Z is 13:15 in Cairo (EEST, +3).
    expect(ctx.querySelector("time[datetime='2026-10-23T10:15:00Z']")?.textContent).toContain(
      "13:15",
    );
    expect(ctx.textContent).toMatch(/still queued on a terminal/);
  });

  test("all in scope: each store's own business day, every zone listed, asOf in UTC labelled", () => {
    one("receivedSales", { status: "ready", data: KPIS }, SCOPE_CONTEXT);
    const ctx = screen.getByTestId("metric-claims-context");
    expect(ctx.textContent).toContain("3 stores");
    expect(ctx.textContent).toContain("each store's local business day");
    expect(ctx.textContent).toContain("Africa/Cairo");
    expect(ctx.textContent).toContain("UTC");
    expect(ctx.textContent).toContain("Oct 1, 2026");
    expect(ctx.textContent).toContain("Oct 7, 2026");
    expect(ctx.textContent).not.toContain("so far");
    expect(ctx.querySelector("time[datetime='2026-10-23T10:15:00Z']")?.textContent).toContain(
      "10:15",
    );
  });

  test("no asOf yet (still loading): the context omits it rather than inventing one", () => {
    one("receivedSales", { status: "loading" }, { ...STORE_CONTEXT, asOf: undefined });
    const ctx = screen.getByTestId("metric-claims-context");
    expect(ctx.querySelector("time[datetime^='2026-10-23T']")).toBeNull();
  });

  test("the list is described by its context line", () => {
    one("receivedSales", { status: "ready", data: KPIS });
    const list = document.querySelector("dl");
    const ctx = screen.getByTestId("metric-claims-context");
    expect(list?.getAttribute("aria-describedby")).toBe(ctx.id);
  });

  test("each figure has a definition disclosure from the registry", () => {
    one("erpPosting", { status: "ready", data: KPIS });
    const summary = screen.getByText("About ERP posting state");
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.closest("details")?.textContent).toMatch(/never means not posted/i);
  });
});

describe("RT-819 MetricClaim locale and motion", () => {
  test("Arabic: labels and words from the Arabic catalog, money still LTR", () => {
    act(() => setLocale("ar"));
    one("erpPosting", { status: "ready", data: KPIS });
    expect(screen.getByText("حالة الترحيل إلى ERPNext", { selector: "dt" })).toBeTruthy();
    expect(document.body.textContent).toContain("غير معروف");
    act(() => setLocale("en"));
  });

  test("Arabic unknown claim never shows a digit", () => {
    act(() => setLocale("ar"));
    one("receivedSales", { status: "unknown" });
    const dd = value("المبيعات المستلمة");
    expect(dd.textContent).not.toMatch(/[0-9٠-٩]/);
    act(() => setLocale("en"));
  });

  test("the final figure renders at once (no count-up) and the styles declare no motion", () => {
    one("receivedSales", { status: "ready", data: KPIS });
    expect(value("Received sales").querySelector(".metric-claim__count")?.textContent).toBe("14");
    const css = readFileSync(join(process.cwd(), "src/components/metric-claim.css"), "utf8");
    expect(css).not.toMatch(/animation|transition|@keyframes/);
  });

  test("no colour carries meaning: no state colour classes on any claim", () => {
    const { container } = one("erpPosting", { status: "ready", data: KPIS });
    expect(container.innerHTML).not.toMatch(/success|warning|danger|badge/);
  });
});

describe("RT-819 MetricClaim review follow-ups", () => {
  test("sync status: the contract's four states in order, 'synced' as its own word", () => {
    const data: Kpis = {
      ...KPIS,
      syncStatus: { captured: 1, synced: 10, failedRetryable: 2, failedNeedsRepair: 1 },
    };
    one("syncStatus", { status: "ready", data });
    const parts = within(value("Sale sync status"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(parts).toEqual([
      "Captured: 1",
      "Synced: 10",
      "Failed, retrying: 2",
      "Failed, needs repair: 1",
    ]);
  });

  test("stores sharing one zone: the zone is named once, singular", () => {
    one(
      "receivedSales",
      { status: "ready", data: KPIS },
      {
        ...SCOPE_CONTEXT,
        scope: {
          kind: "all_in_scope",
          storeCount: 3,
          timeZones: ["Africa/Cairo", "Africa/Cairo", "Africa/Cairo"],
        },
      },
    );
    const ctx = screen.getByTestId("metric-claims-context");
    expect(ctx.textContent).toContain("Time zone: Africa/Cairo");
    expect(ctx.textContent?.match(/Africa\/Cairo/g)).toHaveLength(1);
  });

  test("the request reference is isolated LTR", () => {
    one("receivedSales", { status: "error", requestId: "req-42", retry: () => undefined });
    const bdi = screen.getByText("req-42");
    expect(bdi.tagName).toBe("BDI");
    expect(bdi.getAttribute("dir")).toBe("ltr");
  });
});
