import { BackArrow } from "@/components/BackArrow";
import { Banner } from "@/components/Banner";
import { ListState } from "@/components/ListState";
import {
  DateTime,
  type MessageKey,
  Money,
  formatEvidenceTime,
  formatNumber,
  useLocale,
  useT,
} from "@/i18n";
import type { ShiftCloseDetail as Detail, ShiftCashMovement } from "@/lib/shift-close-queries";
/**
 * RT-18 — One recorded shift close (read-only). The close fields exactly as the
 * API recorded them: the cash reconciliation (opening float, cash sales and
 * refunds, pay-ins and pay-outs, expected, counted) and the signed variance
 * (counted − expected), then the recorded approver, the cash movements and the
 * returns refunded in cash. Nothing is recomputed, edited or resolved here.
 *
 * The approver is attribution as the terminal sent it: not verified (the
 * persisted `approverCheck` is RT-384 / RT-385, not in the contract) and it
 * never changes the variance. Actors are bare ids: the contract carries no
 * names. A 404 is the API's uniform refusal and reads as not available.
 */
import { Link, useLocation, useParams } from "react-router";
import { ShiftScopePrompt } from "./ShiftScopePrompt";
import {
  closeKindKey,
  movementKindKey,
  reasonCodeKey,
  varianceDirectionKey,
} from "./shiftCloseLogic";
import {
  type ShiftCloseError,
  useShiftCloseDetail,
  useShiftCloseScope,
  useStoreOf,
} from "./useShiftCloses";
import "../shell/surface.css";
import "./shift-closes.css";

/** The list's search string (its filters), kept in navigation state by the list. */
function useBackSearch(): string {
  const state = useLocation().state as { list?: unknown } | null;
  const list = state?.list;
  return typeof list === "string" && list.startsWith("?") ? list : "";
}

function BackLink(): React.JSX.Element {
  const t = useT();
  return (
    <Link to={{ pathname: "/shift-closes", search: useBackSearch() }} className="surface__back">
      <BackArrow /> {t("shift.detail.back")}
    </Link>
  );
}

function Field({
  label,
  mono,
  children,
}: Readonly<{ label: string; mono?: boolean; children: React.ReactNode }>): React.JSX.Element {
  return (
    <div className="field-row">
      <dt className="field-row__label">{label}</dt>
      <dd className={mono ? "field-row__value field-row__value--mono" : "field-row__value"}>
        {children}
      </dd>
    </div>
  );
}

/** An actor or reference id: machine data, isolated LTR (UX-11). */
function MachineId({ value }: Readonly<{ value: string }>): React.JSX.Element {
  return <bdi dir="ltr">{value}</bdi>;
}

function Section({
  titleKey,
  children,
}: Readonly<{ titleKey: MessageKey; children: React.ReactNode }>): React.JSX.Element {
  const t = useT();
  return (
    <section className="shift-section">
      <h2 className="surface__section-title">{t(titleKey)}</h2>
      {children}
    </section>
  );
}

interface LoadedProps {
  detail: Detail;
  storeName?: string;
  timeZone?: string;
}

function SummarySection({ detail, storeName, timeZone }: Readonly<LoadedProps>): React.JSX.Element {
  const t = useT();
  const locale = useLocale();
  return (
    <Section titleKey="shift.detail.section.summary">
      <dl className="surface__detail">
        <Field label={t("shift.field.store")}>{storeName ?? t("shift.list.unknownStore")}</Field>
        <Field label={t("shift.field.shiftId")} mono>
          <MachineId value={detail.shiftId} />
        </Field>
        <Field label={t("shift.field.kind")}>
          <span className="badge">{t(closeKindKey(detail))}</span>
        </Field>
        {detail.forcedReason ? (
          <Field label={t("shift.field.forcedReason")}>
            <bdi dir="auto">{detail.forcedReason}</bdi>
          </Field>
        ) : null}
        <Field label={t("shift.field.openedAt")}>
          <DateTime value={detail.openedAt} timeZone={timeZone} />
        </Field>
        <Field label={t("shift.field.closedAt")}>
          <DateTime value={detail.closedAt} timeZone={timeZone} />
        </Field>
        <Field label={t("shift.field.receivedAt")}>
          <time dateTime={detail.receivedAt}>
            <bdi dir="ltr">{formatEvidenceTime(detail.receivedAt)}</bdi>
          </time>
        </Field>
        <Field label={t("shift.field.saleCount")}>{formatNumber(detail.saleCount, locale)}</Field>
        <Field label={t("shift.field.openingUser")} mono>
          <MachineId value={detail.openingUserId} />
        </Field>
        <Field label={t("shift.field.closingUser")} mono>
          <MachineId value={detail.closingUserId} />
        </Field>
        <Field label={t("shift.field.recordedBy")} mono>
          <MachineId value={detail.recordedByUserId} />
        </Field>
      </dl>
    </Section>
  );
}

function CashSection({ detail }: Readonly<{ detail: Detail }>): React.JSX.Element {
  const t = useT();
  const currency = detail.currencyCode;
  const figures: [MessageKey, string][] = [
    ["shift.field.openingFloat", detail.openingFloat],
    ["shift.field.cashSales", detail.cashSalesTotal],
    ["shift.field.cashRefunds", detail.cashRefundsTotal],
    ["shift.field.payIn", detail.payInTotal],
    ["shift.field.payOut", detail.payOutTotal],
    ["shift.field.expected", detail.expectedCash],
    ["shift.field.counted", detail.countedCash],
  ];
  return (
    <Section titleKey="shift.detail.section.cash">
      <dl className="surface__detail">
        {figures.map(([key, value]) => (
          <Field key={key} label={t(key)}>
            <Money value={value} currency={currency} />
          </Field>
        ))}
        <Field label={t("shift.field.variance")}>
          <span className="shift-variance">
            <Money signed value={detail.variance} currency={currency} />
            <small className="shift-variance__label">{t(varianceDirectionKey(detail))}</small>
          </span>
        </Field>
      </dl>
    </Section>
  );
}

function ApprovalSection({ detail }: Readonly<{ detail: Detail }>): React.JSX.Element {
  const t = useT();
  const approver = detail.varianceApprovedByUserId;
  return (
    <Section titleKey="shift.detail.section.approval">
      {approver ? (
        <dl className="surface__detail">
          <Field label={t("shift.field.approver")} mono>
            <MachineId value={approver} />
          </Field>
        </dl>
      ) : (
        <p className="content__sub">{t("shift.approval.none")}</p>
      )}
      <p className="content__sub">{t("shift.approval.note")}</p>
    </Section>
  );
}

function MovementRow({
  movement,
  currency,
  timeZone,
}: Readonly<{
  movement: ShiftCashMovement;
  currency: string;
  timeZone?: string;
}>): React.JSX.Element {
  const t = useT();
  return (
    <tr className="data-table__row data-table__row--static">
      <td>
        <DateTime value={movement.occurredAt} timeZone={timeZone} />
      </td>
      <td>{t(movementKindKey(movement))}</td>
      <td>{t(reasonCodeKey(movement))}</td>
      <td>
        <Money value={movement.amount} currency={currency} />
      </td>
      <td>{movement.note ? <bdi dir="auto">{movement.note}</bdi> : null}</td>
      <td className="data-table__cell--mono">
        <MachineId value={movement.recordedByUserId} />
      </td>
    </tr>
  );
}

function MovementsSection({
  detail,
  timeZone,
}: Readonly<{ detail: Detail; timeZone?: string }>): React.JSX.Element {
  const t = useT();
  return (
    <Section titleKey="shift.detail.section.movements">
      {detail.cashMovements.length === 0 ? (
        <p className="content__sub">{t("shift.movement.empty")}</p>
      ) : (
        <table className="data-table">
          <caption className="data-table__caption">{t("shift.movement.caption")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("shift.movement.col.time")}</th>
              <th scope="col">{t("shift.movement.col.kind")}</th>
              <th scope="col">{t("shift.movement.col.reason")}</th>
              <th scope="col">{t("shift.movement.col.amount")}</th>
              <th scope="col">{t("shift.movement.col.note")}</th>
              <th scope="col">{t("shift.movement.col.recordedBy")}</th>
            </tr>
          </thead>
          <tbody>
            {detail.cashMovements.map((m) => (
              <MovementRow
                key={m.movementId}
                movement={m}
                currency={detail.currencyCode}
                timeZone={timeZone}
              />
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}

function ReturnsSection({ refs }: Readonly<{ refs: readonly string[] }>): React.JSX.Element {
  const t = useT();
  return (
    <Section titleKey="shift.detail.section.returns">
      {refs.length === 0 ? (
        <p className="content__sub">{t("shift.returns.empty")}</p>
      ) : (
        <ul className="shift-refs">
          {refs.map((ref) => (
            <li key={ref}>
              <MachineId value={ref} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Loaded({ detail, storeName, timeZone }: Readonly<LoadedProps>): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      <BackLink />
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("shift.detail.title")}</h1>
          <p className="content__sub">
            {t.rich("shift.detail.zoneNote", { zone: <bdi dir="ltr">{timeZone ?? "UTC"}</bdi> })}
          </p>
        </div>
      </header>
      <SummarySection detail={detail} storeName={storeName} timeZone={timeZone} />
      <CashSection detail={detail} />
      <ApprovalSection detail={detail} />
      <MovementsSection detail={detail} timeZone={timeZone} />
      <ReturnsSection refs={detail.cashRefundReturnRefs} />
    </div>
  );
}

function ErrorView({
  error,
  onRetry,
}: Readonly<{ error: ShiftCloseError; onRetry: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <div className="surface">
      {error.kind === "not-found" ? (
        <ListState state="empty" emptyMessage={t("shift.detail.notFound")} />
      ) : (
        <Banner
          variant="danger"
          message={t(
            error.kind === "session" ? "shift.list.sessionExpired" : "shift.detail.loadFailed",
          )}
          requestId={error.requestId}
          action={
            error.kind === "session" ? undefined : (
              <button type="button" className="btn-secondary" onClick={onRetry}>
                {t("shift.detail.retry")}
              </button>
            )
          }
        />
      )}
      <BackLink />
    </div>
  );
}

/** The close is read but its store's zone has not settled: hold the times back. */
function awaitingStore(detail: Detail | undefined, storeReady: boolean): boolean {
  return detail !== undefined && !storeReady;
}

export function ShiftCloseDetail(): React.JSX.Element {
  const t = useT();
  const scope = useShiftCloseScope();
  const { shiftId } = useParams();
  const { detail, isLoading, error, retry } = useShiftCloseDetail(scope, shiftId);
  const store = useStoreOf(detail?.storeId);

  if (!scope.tenantId) return <ShiftScopePrompt />;
  if (isLoading || awaitingStore(detail, store.ready)) {
    return (
      <div className="surface">
        <ListState state="loading" label={t("shift.detail.loadingNoun")} />
      </div>
    );
  }
  if (error) return <ErrorView error={error} onRetry={retry} />;
  if (!detail) return <div className="surface" />;
  return <Loaded detail={detail} storeName={store.name} timeZone={store.timeZone} />;
}
