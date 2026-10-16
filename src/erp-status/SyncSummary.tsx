/**
 * RT-560 sync summary strip (spec 016 §4.2). One tile per C3 domain, each with
 * its own status, count and the server's `detail`. There is no combined "ERP
 * OK" (A-4): `not_available` is shown as not available yet, even while the
 * connection panel lists instances. `detail` is the server's own text, shown
 * verbatim and direction-isolated; it is never parsed or translated.
 */
import { ListState } from "@/components/ListState";
import { formatNumber, useT } from "@/i18n";
import type { DomainSummary } from "@/lib/erp-status-queries";
import { domainKey, domainStatusView } from "./erpStatusLogic";
import { AsOf, Panel, PanelError, StaleError, StatusPill } from "./parts";
import type { SummaryState } from "./useErpStatus";

function DomainTile({ domain }: Readonly<{ domain: DomainSummary }>): React.JSX.Element {
  const t = useT();
  return (
    <li className="erp-tile">
      <h3 className="erp-tile__title">{t(domainKey(domain.domain))}</h3>
      <StatusPill view={domainStatusView(domain.status)} />
      {domain.headlineCount === null || domain.headlineCount === undefined ? null : (
        <p className="erp-tile__count">
          {t("erp.summary.count", { count: formatNumber(domain.headlineCount) })}
        </p>
      )}
      {domain.detail ? (
        <p className="erp-tile__detail">
          <bdi dir="auto">{domain.detail}</bdi>
        </p>
      ) : null}
    </li>
  );
}

function SummaryBody({ state }: Readonly<{ state: SummaryState }>): React.JSX.Element {
  const t = useT();
  if (state.isLoading) {
    return <ListState state="loading" label={t("erp.summary.loadingNoun")} />;
  }
  if (state.error) {
    return (
      <PanelError
        error={state.error}
        failedMessage={t("erp.summary.loadFailed")}
        onRetry={state.retry}
      />
    );
  }
  const domains = state.summary?.domains ?? [];
  if (domains.length === 0) {
    return <ListState state="empty" emptyMessage={t("erp.summary.empty")} />;
  }
  return (
    <ul className="erp-tiles">
      {domains.map((domain) => (
        <DomainTile key={domain.domain} domain={domain} />
      ))}
    </ul>
  );
}

export function SyncSummary({ state }: Readonly<{ state: SummaryState }>): React.JSX.Element {
  const t = useT();
  return (
    <Panel id="erp-summary" title={t("erp.summary.title")}>
      <p className="content__sub">{t("erp.summary.note")}</p>
      <StaleError panel={state} />
      <SummaryBody state={state} />
      <AsOf at={state.asOf} />
    </Panel>
  );
}
