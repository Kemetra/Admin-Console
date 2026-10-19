/**
 * RT-727 shared pieces for the product-master reconciliation screens: the
 * read-error banner (every contract status mapped, request id shown), the
 * outcome banner for a mutation, the class filter, values shown as received,
 * and the cursor-paged table. The pill, panel frame and as-of line are the
 * RT-560 ERP-status ones, so the integration area reads as one family.
 */
import { Banner } from "@/components/Banner";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState as ListStateView } from "@/components/ListState";
import { StatusPill } from "@/erp-status/parts";
import { type MessageKey, type T, useT } from "@/i18n";
import { Fragment } from "react";
import { Link } from "react-router";
import {
  type OutcomeView,
  type ReadError,
  type RefusedOutcome,
  type RepairPlan,
  type RepairTarget,
  classView,
  refusalView,
} from "./productReconLogic";
import type { ListState } from "./useProductReconciliation";

/** A mismatch class pill; an unknown class reads "Unknown" with the raw value beside it. */
export function ClassPill({ value }: Readonly<{ value: string }>): React.JSX.Element {
  const view = classView(value);
  return (
    <span className="recon-stack">
      <StatusPill view={view} />
      {view.labelKey === "productRecon.unknown" ? <Raw value={value} /> : null}
    </span>
  );
}

/** A machine value (UUID, ERPNext ref, class code) exactly as received, LTR-isolated. */
export function Raw({ value }: Readonly<{ value: string }>): React.JSX.Element {
  return (
    <bdi dir="ltr" className="data-table__cell--mono">
      {value}
    </bdi>
  );
}

const OPEN_KEYS: Record<RepairTarget["repairKind"], MessageKey> = {
  suggest_confirm: "productRecon.repair.open",
  confirm: "productRecon.repair.confirmOpen",
  re_point: "productRecon.repair.repointOpen",
};

/**
 * A row's repair action: the button that opens the repair panel, a link to the
 * item mappings screen when the row lacks the mapping id and version (RT-733),
 * or a muted dash.
 */
export function RepairAction({
  plan,
  onRepair,
}: Readonly<{ plan: RepairPlan; onRepair: (target: RepairTarget) => void }>): React.JSX.Element {
  const t = useT();
  if (plan === "needs-version") {
    return <Link to="/erp-connection/mappings">{t("productRecon.repair.needsVersion")}</Link>;
  }
  if (typeof plan === "string") return <span className="muted">{t("productRecon.none")}</span>;
  return (
    <button type="button" className="btn-secondary" onClick={() => onRepair(plan)}>
      {t(OPEN_KEYS[plan.repairKind])}
    </button>
  );
}

/** "Too many requests", with the server's Retry-After when it sent one. */
function rateLimitedCopy(t: T, base: MessageKey, retryAfterSeconds?: number): string {
  if (retryAfterSeconds === undefined) return t(base);
  return `${t(base)} ${t("productRecon.retryIn", { count: retryAfterSeconds })}`;
}

const READ_ERROR_KEYS: Record<Exclude<ReadError["kind"], "generic">, MessageKey> = {
  session: "productRecon.error.session",
  forbidden: "productRecon.error.forbidden",
  "not-found": "productRecon.error.notFound",
  rejected: "productRecon.error.rejected",
  "rate-limited": "productRecon.error.rateLimited",
};

/** How each read failure presents: its tone, and whether a retry can help. */
const READ_ERROR_PRESENTATION: Record<
  ReadError["kind"],
  { variant: "danger" | "warning"; retryable: boolean }
> = {
  session: { variant: "danger", retryable: false },
  forbidden: { variant: "danger", retryable: false },
  "not-found": { variant: "warning", retryable: false },
  rejected: { variant: "warning", retryable: true },
  "rate-limited": { variant: "warning", retryable: true },
  generic: { variant: "danger", retryable: true },
};

/** The copy for a read failure; a panel may name its own not-found and generic failure. */
function readErrorMessage(
  t: T,
  error: ReadError,
  copy: { failed: string; notFound?: string },
): string {
  switch (error.kind) {
    case "generic":
      return copy.failed;
    case "not-found":
      return copy.notFound ?? t(READ_ERROR_KEYS[error.kind]);
    case "rate-limited":
      return rateLimitedCopy(t, READ_ERROR_KEYS[error.kind], error.retryAfterSeconds);
    default:
      return t(READ_ERROR_KEYS[error.kind]);
  }
}

/** A read failure: the mapped copy, its request id and a retry where retrying can help. */
export function ReadErrorBanner({
  error,
  failedMessage,
  notFoundMessage,
  onRetry,
  stale = false,
}: Readonly<{
  error: ReadError;
  failedMessage: string;
  notFoundMessage?: string;
  onRetry: () => void;
  /** Earlier rows stay on screen; the banner says so. */
  stale?: boolean;
}>): React.JSX.Element {
  const t = useT();
  const { variant, retryable } = READ_ERROR_PRESENTATION[error.kind];
  return (
    <Banner
      variant={variant}
      title={stale ? t("productRecon.stale") : undefined}
      message={readErrorMessage(t, error, { failed: failedMessage, notFound: notFoundMessage })}
      requestId={error.requestId}
      action={
        retryable ? (
          <button type="button" className="btn-secondary" onClick={onRetry}>
            {t("productRecon.retry")}
          </button>
        ) : undefined
      }
    />
  );
}

/** A mutation's answer from the server, as a persistent banner (never a toast). */
export function OutcomeBanner({
  view,
  requestId,
  message,
  title,
}: Readonly<{
  view: OutcomeView;
  requestId?: string;
  /** Overrides the view's copy (used for the rate-limited countdown). */
  message?: string;
  title?: string;
}>): React.JSX.Element {
  const t = useT();
  return (
    <Banner
      variant={view.variant}
      title={title}
      message={message ?? t(view.messageKey)}
      requestId={requestId}
    />
  );
}

/** The banner for a refused mutation: what the server said, never a retry button. */
export function RefusalBanner({
  outcome,
}: Readonly<{ outcome: RefusedOutcome }>): React.JSX.Element {
  const t = useT();
  const view = refusalView(outcome.refusal);
  const message =
    outcome.refusal === "rate-limited"
      ? rateLimitedCopy(t, view.messageKey, outcome.retryAfterSeconds)
      : undefined;
  return <OutcomeBanner view={view} message={message} requestId={outcome.requestId} />;
}

export function ClassFilter<C extends string>({
  id,
  classes,
  value,
  onChange,
}: Readonly<{
  id: string;
  classes: readonly C[];
  value: C | "";
  onChange: (next: C | "") => void;
}>): React.JSX.Element {
  const t = useT();
  return (
    <div className="recon-filter field">
      <label htmlFor={id}>{t("productRecon.filter.class")}</label>
      <select
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value as C | "")}
      >
        <option value="">{t("productRecon.filter.all")}</option>
        {classes.map((cls) => (
          <option key={cls} value={cls}>
            {t(classView(cls).labelKey)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Key/value pairs as received (a run summary, a result detail), or a muted dash. */
export function Received({
  entries,
  emptyKey,
}: Readonly<{ entries: [string, string][]; emptyKey: MessageKey }>): React.JSX.Element {
  const t = useT();
  if (entries.length === 0) return <span className="muted">{t(emptyKey)}</span>;
  return (
    <dl className="recon-received">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt>
            <Raw value={key} />
          </dt>
          <dd>
            <Raw value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface ReconTableProps<R> {
  list: ListState<R>;
  caption: string;
  columns: { key: string; header: string }[];
  loadingNoun: string;
  failedMessage: string;
  notFoundMessage?: string;
  emptyMessage: string;
  rowKey: (row: R) => string;
  renderRow: (row: R) => React.ReactNode;
}

/** A cursor-paged table: skeleton, error, empty, or rows with a stale banner and Load more. */
export function ReconTable<R>({
  list,
  caption,
  columns,
  loadingNoun,
  failedMessage,
  notFoundMessage,
  emptyMessage,
  rowKey,
  renderRow,
}: Readonly<ReconTableProps<R>>): React.JSX.Element {
  const t = useT();
  if (list.isLoading) {
    return <DataTableSkeleton caption={caption} columns={columns} label={loadingNoun} />;
  }
  if (list.error) {
    return (
      <ReadErrorBanner
        error={list.error}
        failedMessage={failedMessage}
        notFoundMessage={notFoundMessage}
        onRetry={list.retry}
      />
    );
  }
  return (
    <>
      {list.inlineError ? (
        <ReadErrorBanner
          error={list.inlineError}
          failedMessage={failedMessage}
          notFoundMessage={notFoundMessage}
          onRetry={list.retry}
          stale
        />
      ) : null}
      {list.rows.length === 0 ? (
        <ListStateView state="empty" emptyMessage={emptyMessage} />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="data-table__caption">{caption}</caption>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key} scope="col">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.rows.map((row) => (
                <Fragment key={rowKey(row)}>{renderRow(row)}</Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.hasMore ? (
        <div>
          <button
            type="button"
            className="btn-secondary"
            onClick={list.loadMore}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
            {t("productRecon.loadMore")}
          </button>
        </div>
      ) : null}
    </>
  );
}
