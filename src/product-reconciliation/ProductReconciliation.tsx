/**
 * RT-727 — ERPNext product-master reconciliation (Backend-Core spec 021), for
 * owner / tenant_admin, in the Integration area beside the ERP connection
 * status. Two panels over Backend-Core only: the live unmapped-product backlog
 * (with the `suggest_confirm` repair, and `confirm` of a suggestion, RT-733)
 * and the run history (with "Start a run").
 *
 * Gate first: any other role gets the existing NoAccess state and nothing is
 * requested; the API is the authority (a non-disclosing 404 otherwise) and the
 * gate mirrors its roles. The backlog class filter lives in the URL (`?class=`).
 */
import { NoAccess } from "@/auth/NoAccess";
import { useT } from "@/i18n";
import type { BacklogClass } from "@/lib/product-reconciliation-queries";
import { useSignOut } from "@/shell/useSignOut";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { BacklogPanel } from "./BacklogPanel";
import { RepairPanel } from "./RepairPanel";
import { RunsPanel } from "./RunsPanel";
import {
  BACKLOG_CLASSES,
  type RepairTarget,
  canUseProductReconciliation,
  classFilter,
} from "./productReconLogic";
import { type ReconScope, useBacklog, useReconScope, useRuns } from "./useProductReconciliation";
import "../shell/surface.css";
import "../erp-status/erp-status.css";
import "./product-reconciliation.css";

function Content({ scope }: Readonly<{ scope: ReconScope }>): React.JSX.Element {
  const t = useT();
  const [search, setSearch] = useSearchParams();
  const cls = classFilter<BacklogClass>(search.get("class"), BACKLOG_CLASSES);
  const backlog = useBacklog(scope, cls);
  const runs = useRuns(scope);
  const [target, setTarget] = useState<RepairTarget | null>(null);

  return (
    <div className="surface erp-surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("productRecon.title")}</h1>
          <p className="content__sub">
            {t.rich("productRecon.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            backlog.retry();
            runs.retry();
          }}
        >
          {t("productRecon.refresh")}
        </button>
      </header>

      <BacklogPanel
        list={backlog}
        cls={cls}
        onClassChange={(next) => setSearch(next ? new URLSearchParams({ class: next }) : {})}
        onRepair={setTarget}
        repair={
          target ? (
            <RepairPanel
              key={target.tenantProductId}
              scope={scope}
              target={target}
              onClose={() => setTarget(null)}
            />
          ) : null
        }
      />
      <RunsPanel scope={scope} list={runs} />
    </div>
  );
}

/** The page gate shared with the run results page. */
export function ReconGate({
  children,
}: Readonly<{ children: (scope: ReconScope) => React.ReactNode }>): React.JSX.Element {
  const t = useT();
  const scope = useReconScope();
  const signOut = useSignOut();
  if (!canUseProductReconciliation(scope.role)) return <NoAccess onSignOut={signOut} />;
  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("productRecon.scopePrompt")}</p>
      </div>
    );
  }
  return <>{children(scope)}</>;
}

export function ProductReconciliation(): React.JSX.Element {
  return <ReconGate>{(scope) => <Content scope={scope} />}</ReconGate>;
}
