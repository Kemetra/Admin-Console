import { type ClaimState, MetricClaims } from "@/components/MetricClaim";
import { DocumentLocale } from "@/i18n";
import type { SalesKpis } from "@/metrics/metricRegistry";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/tokens.css";
import "@/styles/controls.css";
import "@/styles/a11y.css";

/**
 * RT-819 e2e harness: the shared KPI claim in every state, mounted on its own
 * because no Console screen adopts it yet (VIZ-2 / VIZ-3 are the first; move
 * these checks onto their screens when they land). Never shipped:
 * tests/e2e/harness/build.ts bundles it into a temp directory for the
 * Playwright run only. It imports the real component and the app's own
 * stylesheets, so what axe sees is what a screen would render.
 */

const ZERO: SalesKpis = {
  receivedSales: { count: 0, byCurrency: [] },
  voids: { count: 0, byCurrency: [] },
  returns: { count: 0, byCurrency: [] },
  legacyRefunds: { count: 0, byCurrency: [] },
  syncStatus: { captured: 0, synced: 0, failedRetryable: 0, failedNeedsRepair: 0 },
  erpPosting: { posted: 0, pending: 0, failed: 0, unknown: 0 },
  shiftCloses: {
    count: 0,
    normal: 0,
    forced: 0,
    withVariance: 0,
    approvalMissing: { yes: 0, no: 0, unknown: 0 },
  },
};

const KPIS: SalesKpis = {
  ...ZERO,
  receivedSales: {
    count: 14,
    byCurrency: [
      { currencyCode: "EGP", count: 12, total: "1250.5000" },
      { currencyCode: "USD", count: 2, total: "40.0000" },
    ],
  },
  erpPosting: { posted: 9, pending: 2, failed: 1, unknown: 2 },
  shiftCloses: {
    count: 3,
    normal: 2,
    forced: 1,
    withVariance: 1,
    approvalMissing: { yes: 1, no: 1, unknown: 1 },
  },
};

function Harness(): React.JSX.Element {
  const [returnsState, setReturnsState] = useState<ClaimState>({
    status: "error",
    requestId: "0190f000-0000-7000-8000-00000000e819",
    retry: () => setReturnsState({ status: "ready", data: KPIS }),
  });
  return (
    <>
      <DocumentLocale />
      <h1>KPI claims</h1>
      <section aria-labelledby="store-today">
        <h2 id="store-today">Store, today</h2>
        <MetricClaims
          context={{
            scope: { kind: "store", storeName: "Heliopolis", timeZone: "Africa/Cairo" },
            period: { from: "2026-10-23", to: "2026-10-23", partial: true },
            asOf: "2026-10-23T10:15:00Z",
            completeness: "received_only",
          }}
          claims={[
            { metric: "receivedSales", state: { status: "ready", data: KPIS } },
            { metric: "voids", state: { status: "ready", data: ZERO } },
            { metric: "returns", state: returnsState },
            { metric: "legacyRefunds", state: { status: "unknown" } },
            { metric: "syncStatus", state: { status: "loading" } },
            { metric: "erpPosting", state: { status: "ready", data: KPIS } },
            { metric: "shiftCloses", state: { status: "ready", data: KPIS } },
          ]}
        />
      </section>
      <section aria-labelledby="scope-week">
        <h2 id="scope-week">All stores, one week</h2>
        <MetricClaims
          context={{
            scope: { kind: "all_in_scope", storeCount: 3, timeZones: ["Africa/Cairo", "UTC"] },
            period: { from: "2026-10-01", to: "2026-10-07" },
            asOf: "2026-10-23T10:15:00Z",
            completeness: "received_only",
          }}
          claims={[
            { metric: "receivedSales", state: { status: "ready", data: KPIS } },
            { metric: "erpPosting", state: { status: "hidden" } },
          ]}
        />
      </section>
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
