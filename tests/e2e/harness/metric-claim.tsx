import { type ClaimState, MetricClaims } from "@/components/MetricClaim";
import { DocumentLocale } from "@/i18n";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { KPIS, ZERO_KPIS as ZERO } from "../../unit/metric-claim-fixtures";
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
