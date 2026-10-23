/**
 * RT-821 (VIZ-3, RT-751 slice 4) «المبيعات المستلمة يوميًا»: the daily
 * received-sales report (R2, R3, R4) at `/sales-daily`, a Sales sibling
 * (RT-751 D6). The store is the scope header's active store; with none, the
 * whole scope (`all_in_scope`, `scopeTotals`). One read per range, at most 31
 * business days; the default is the last 7 completed days plus today, read
 * only once the store's zone is known so a UTC guess never fires a read.
 *
 * Entry (UX-09 "navigation has a capacity budget"): an in-page link from the
 * Sales screen and a back link here, not a new sidebar destination. Spec 015
 * (Reports) stays deferred until more than one report exists.
 */
import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { type MessageKey, useT } from "@/i18n";
import type { SalesSummaryErrorRender } from "@/lib/sales-summary-queries";
import { Notice, Unavailable } from "@/sales/SalePager";
import { canReadSales } from "@/sales/saleLogic";
import { type SaleScope, useSaleScope } from "@/sales/useSales";
import { type StoreDirectory, useStoreDirectory } from "@/shift-closes/useShiftCloses";
import { Link, useSearchParams } from "react-router";
import { DailyRangeForm } from "./DailyRangeForm";
import { DailyReport } from "./DailyTables";
import {
  type DailyRange,
  buildSummaryQuery,
  defaultRange,
  rangeFromSearch,
  rangeToSearch,
  reportModel,
  validateRange,
} from "./dailyLogic";
import { type SalesDailyState, useSalesDaily } from "./useSalesDaily";
import "@/components/list-state.css";
import "../shell/surface.css";
import "./sales-daily.css";

const RANGE_PROBLEM_KEY = {
  "to-before-from": "sales.filter.rangeReversed",
  "range-too-wide": "sales.filter.spanTooWide",
} as const satisfies Record<string, MessageKey>;

/** A 400 belongs at the To field; every other failure is the body's. */
function fieldErrorOf(error: SalesSummaryErrorRender | undefined): MessageKey | undefined {
  if (error?.kind === "range") return RANGE_PROBLEM_KEY[error.problem];
  return error?.kind === "field" ? "salesDaily.range.rejected" : undefined;
}

/** The zones that decide "today" before the first read: the store's, or every store's. */
function proposalZones(scope: SaleScope, directory: StoreDirectory): string[] {
  if (scope.activeStoreId) return [directory.timeZoneOf(scope.activeStoreId) ?? "UTC"];
  return directory.stores.map((s) => s.timezone ?? "UTC");
}

/** The URL's range, else the default once the zone is known; null while it is not. */
function appliedRange(
  search: URLSearchParams,
  scope: SaleScope,
  directory: StoreDirectory,
): DailyRange | null {
  const fromUrl = rangeFromSearch(search);
  if (fromUrl) return fromUrl;
  return directory.ready ? defaultRange(proposalZones(scope, directory)) : null;
}

function Loading(): React.JSX.Element {
  const t = useT();
  return (
    <output className="list-state list-state--loading" aria-busy="true">
      <span className="spinner" aria-hidden="true" />
      <span className="list-state__msg">{t("salesDaily.loading")}</span>
    </output>
  );
}

/** A 400 is shown at the To field, not in the body. */
function isFieldError(error: SalesSummaryErrorRender): boolean {
  return error.kind === "range" || error.kind === "field";
}

function Failure({ daily }: Readonly<{ daily: SalesDailyState }>): React.JSX.Element | null {
  const t = useT();
  const error = daily.error;
  if (!error || isFieldError(error)) return null;
  if (error.kind === "not-found") return <Unavailable />;
  const retry = (
    <GatedButton type="button" className="btn-secondary" onClick={daily.retry}>
      {t("salesDaily.retry")}
    </GatedButton>
  );
  if (error.kind === "rate-limited") {
    return (
      <div className="daily-report__state">
        <Notice message={t("salesDaily.rateLimited")} hint={t("salesDaily.rateLimitedHint")} />
        {retry}
      </div>
    );
  }
  return (
    <Banner
      variant="danger"
      message={t("salesDaily.failed")}
      requestId={error.requestId}
      action={retry}
    />
  );
}

function Body({
  daily,
  scope,
  directory,
}: Readonly<{ daily: SalesDailyState; scope: SaleScope; directory: StoreDirectory }>) {
  if (daily.isLoading) return <Loading />;
  if (daily.error) return <Failure daily={daily} />;
  if (!daily.summary) return null;
  const model = reportModel(daily.summary);
  const ref = model.storeRef ?? scope.activeStoreId ?? "";
  return (
    <DailyReport
      model={model}
      storeName={directory.nameOf(ref) ?? ref}
      readStores={daily.summary.stores.length}
    />
  );
}

function ZoneNote({ scope, directory }: Readonly<{ scope: SaleScope; directory: StoreDirectory }>) {
  const t = useT();
  const zone = scope.activeStoreId ? directory.timeZoneOf(scope.activeStoreId) : undefined;
  // The store note already states the 31-day bound; a whole scope states it here.
  if (!zone) return <>{`${t("salesDaily.range.note")} ${t("salesDaily.context.calendar")}`}</>;
  return <>{t.rich("sales.filter.zoneNote", { zone: <bdi dir="ltr">{zone}</bdi> })}</>;
}

function Shell({
  scope,
  children,
}: Readonly<{ scope: SaleScope; children: React.ReactNode }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <Link to="/sales" className="surface__back">
        <BackArrow /> {t("salesDaily.back")}
      </Link>
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("salesDaily.title")}</h1>
          <p className="content__sub">
            {t.rich("salesDaily.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
      </header>
      {children}
    </div>
  );
}

export function SalesDaily(): React.JSX.Element {
  const t = useT();
  const scope = useSaleScope();
  const [search, setSearch] = useSearchParams();
  // A refused role reads nothing: the server would answer the same 404.
  const permitted = canReadSales(scope.role);
  const directory = useStoreDirectory(permitted ? scope.tenantId : null);
  const range = appliedRange(search, scope, directory);
  const valid = range !== null && Object.keys(validateRange(range)).length === 0;
  const query = permitted && valid ? buildSummaryQuery(range, scope.activeStoreId) : null;
  const daily = useSalesDaily(scope, query);

  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("sales.list.scopePrompt")}</p>
      </div>
    );
  }
  if (!permitted) {
    return (
      <Shell scope={scope}>
        <Unavailable />
      </Shell>
    );
  }
  return (
    <Shell scope={scope}>
      <DailyRangeForm
        range={range}
        zoneNote={<ZoneNote scope={scope} directory={directory} />}
        serverError={fieldErrorOf(daily.error)}
        onApply={(next) => setSearch(rangeToSearch(next))}
      />
      {range === null ? <Loading /> : <Body daily={daily} scope={scope} directory={directory} />}
    </Shell>
  );
}
