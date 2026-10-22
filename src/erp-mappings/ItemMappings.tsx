/**
 * RT-725 ERPNext item mappings (`catalog/erpnext-item-map.yaml`): the tenant's
 * active mappings, filterable to the review queue (`state=suggested`), with
 * Confirm (suggested only) and Retire, each behind an inline confirm and sent
 * with the version on screen.
 *
 * A suggestion is recorded for a product the operator picks from the console
 * catalog (the shared picker over `consoleListCatalogProducts`, RT-767), or for
 * the product of the row just retired (a re-point is retire, then a fresh
 * suggestion). There is no free-text product field. Product ids are shown as
 * received in the table: resolving a name for every row is out of scope.
 */
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { StatusPill } from "@/erp-status/parts";
import { AsOf, Panel } from "@/erp-status/parts";
import { DateTime, type T, useT } from "@/i18n";
import type { ErpnextItemMapping, ItemMappingState } from "@/lib/erp-mapping-queries";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { FailureBanner, InlineConfirm, Ref, RetryButton } from "./MappingParts";
import { CatalogSuggest, ReplacementSuggest } from "./SuggestMapping";
import { parseStateFilter, sourceKey, stateView } from "./mappingLogic";
import {
  type ListView,
  useConfirmItemMapping,
  useItemMappings,
  useRetireItemMapping,
} from "./useErpMappings";

type RowAction = { kind: "confirm" | "retire"; row: ErpnextItemMapping };

function columns(t: T): { key: string; header: string }[] {
  return [
    { key: "product", header: t("erp.map.items.col.product") },
    { key: "item", header: t("erp.map.items.col.item") },
    { key: "state", header: t("erp.map.items.col.state") },
    { key: "source", header: t("erp.map.items.col.source") },
    { key: "suggested", header: t("erp.map.items.col.suggestedAt") },
    { key: "confirmed", header: t("erp.map.items.col.confirmedAt") },
    { key: "actions", header: t("erp.map.col.actions") },
  ];
}

function StateFilter({
  value,
  onChange,
}: Readonly<{
  value: ItemMappingState | "";
  onChange: (next: string) => void;
}>): React.JSX.Element {
  const t = useT();
  return (
    <div className="erp-filter">
      <div className="erp-filter__field">
        <label htmlFor="map-state-filter">{t("erp.map.items.filter")}</label>
        <select
          id="map-state-filter"
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{t("erp.map.items.filter.all")}</option>
          <option value="suggested">{t("erp.map.items.filter.suggested")}</option>
          <option value="confirmed">{t("erp.map.items.filter.confirmed")}</option>
        </select>
      </div>
    </div>
  );
}

function ConfirmStep({
  tenantId,
  action,
  onDone,
  onCancel,
}: Readonly<{
  tenantId: string;
  action: RowAction;
  onDone: (action: RowAction) => void;
  onCancel: () => void;
}>): React.JSX.Element {
  const t = useT();
  const confirm = useConfirmItemMapping(tenantId);
  const retire = useRetireItemMapping(tenantId);
  const mutation = action.kind === "confirm" ? confirm : retire;
  const { row } = action;
  const names = {
    item: <Ref value={row.erpnext_item_ref} />,
    product: <Ref value={row.tenant_product_id} />,
  };
  const isConfirm = action.kind === "confirm";
  return (
    <InlineConfirm
      label={t(isConfirm ? "erp.map.items.confirm.label" : "erp.map.items.retire.label")}
      prompt={t.rich(
        isConfirm ? "erp.map.items.confirm.prompt" : "erp.map.items.retire.prompt",
        names,
      )}
      confirmLabel={t(isConfirm ? "erp.map.items.confirm.action" : "erp.map.items.retire.action")}
      destructive={!isConfirm}
      op={isConfirm ? "confirm" : "retireItem"}
      pending={mutation.pending}
      failure={mutation.failure}
      onConfirm={() =>
        mutation.run({ id: row.id, version: row.version }, (outcome) => {
          if (outcome.ok) onDone(action);
        })
      }
      onCancel={onCancel}
    />
  );
}

function ItemRow({
  row,
  onAction,
  open,
}: Readonly<{
  row: ErpnextItemMapping;
  onAction: (action: RowAction) => void;
  open: boolean;
}>): React.JSX.Element {
  const t = useT();
  const view = stateView(row.state);
  const source = sourceKey(row.suggestion_source);
  return (
    <tr className="erp-row">
      <td>
        <Ref value={row.tenant_product_id} />
      </td>
      <td>
        <Ref value={row.erpnext_item_ref} />
      </td>
      <td>
        <StatusPill view={view} />
      </td>
      <td>{source ? t(source) : <Ref value={row.suggestion_source} />}</td>
      <td>
        <DateTime value={row.suggested_at} />
      </td>
      <td>{row.confirmed_at ? <DateTime value={row.confirmed_at} /> : t("erp.map.notYet")}</td>
      <td>
        {view.known ? (
          <div className="map-actions">
            {row.state === "suggested" ? (
              <button
                type="button"
                className="btn-secondary"
                disabled={open}
                onClick={() => onAction({ kind: "confirm", row })}
              >
                {t("erp.map.items.confirm.action")}
              </button>
            ) : null}
            <button
              type="button"
              className="btn-secondary"
              disabled={open}
              onClick={() => onAction({ kind: "retire", row })}
            >
              {t("erp.map.items.retire.action")}
            </button>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

function ItemTable({
  list,
  tenantId,
  emptyKey,
  onRetired,
  onConfirmed,
}: Readonly<{
  list: ListView<ErpnextItemMapping>;
  tenantId: string;
  emptyKey: "erp.map.items.empty" | "erp.map.items.emptySuggested" | "erp.map.items.emptyConfirmed";
  onRetired: (row: ErpnextItemMapping) => void;
  onConfirmed: () => void;
}>): React.JSX.Element {
  const t = useT();
  const [action, setAction] = useState<RowAction | null>(null);
  const cols = columns(t);
  if (list.isLoading) {
    return (
      <DataTableSkeleton
        caption={t("erp.map.items.title")}
        columns={cols}
        label={t("erp.map.items.loading")}
      />
    );
  }
  if (list.failure) {
    const retry =
      list.failure.kind === "unavailable" ? undefined : <RetryButton onRetry={list.retry} />;
    return <FailureBanner op="listItems" failure={list.failure} action={retry} />;
  }
  if (list.rows.length === 0) return <ListState state="empty" emptyMessage={t(emptyKey)} />;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="data-table__caption">{t("erp.map.items.title")}</caption>
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col.key} scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.rows.map((row) => (
            <ItemRowGroup
              key={row.id}
              row={row}
              tenantId={tenantId}
              action={action?.row.id === row.id ? action : null}
              colSpan={cols.length}
              onAction={setAction}
              onClose={() => setAction(null)}
              onDone={(done) => {
                setAction(null);
                if (done.kind === "retire") onRetired(done.row);
                else onConfirmed();
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemRowGroup({
  row,
  tenantId,
  action,
  colSpan,
  onAction,
  onClose,
  onDone,
}: Readonly<{
  row: ErpnextItemMapping;
  tenantId: string;
  action: RowAction | null;
  colSpan: number;
  onAction: (action: RowAction) => void;
  onClose: () => void;
  onDone: (action: RowAction) => void;
}>): React.JSX.Element {
  return (
    <>
      <ItemRow row={row} onAction={onAction} open={action !== null} />
      {action ? (
        <tr className="erp-row map-confirm-row">
          <td colSpan={colSpan}>
            <ConfirmStep
              key={action.kind}
              tenantId={tenantId}
              action={action}
              onDone={onDone}
              onCancel={onClose}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

const EMPTY_KEYS = {
  "": "erp.map.items.empty",
  suggested: "erp.map.items.emptySuggested",
  confirmed: "erp.map.items.emptyConfirmed",
} as const;

type Notice = "confirmed" | "retired" | "suggested";

const NOTICE_KEYS = {
  confirmed: "erp.map.items.notice.confirmed",
  retired: "erp.map.items.notice.retired",
  suggested: "erp.map.items.notice.suggested",
} as const;

export function ItemMappings({ tenantId }: Readonly<{ tenantId: string }>): React.JSX.Element {
  const t = useT();
  const [search, setSearch] = useSearchParams();
  const state = parseStateFilter(search.get("state"));
  const list = useItemMappings(tenantId, state, true);
  const [retired, setRetired] = useState<ErpnextItemMapping | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const onFilter = (next: string) => {
    const params = new URLSearchParams(search);
    if (next) params.set("state", next);
    else params.delete("state");
    setSearch(params);
  };

  return (
    <Panel id="map-items-title" title={t("erp.map.items.title")}>
      <p className="erp-note">{t("erp.map.items.note")}</p>
      <output className="map-notice">{notice ? t(NOTICE_KEYS[notice]) : null}</output>
      {list.failure?.kind === "unavailable" ? null : (
        <>
          <div className="map-toolbar">
            <button
              type="button"
              className="btn-secondary"
              aria-expanded={suggesting}
              onClick={() => {
                setRetired(null);
                setSuggesting(true);
              }}
            >
              {t("erp.map.items.suggestNew.action")}
            </button>
          </div>
          {suggesting ? (
            <CatalogSuggest
              tenantId={tenantId}
              onSuggested={() => {
                setSuggesting(false);
                setNotice("suggested");
              }}
              onDismiss={() => setSuggesting(false)}
            />
          ) : null}
        </>
      )}
      {retired && list.failure?.kind !== "unavailable" ? (
        <ReplacementSuggest
          key={retired.id}
          tenantId={tenantId}
          retired={retired}
          onSuggested={() => {
            setRetired(null);
            setNotice("suggested");
          }}
          onDismiss={() => setRetired(null)}
        />
      ) : null}
      {list.failure?.kind === "unavailable" ? null : (
        <StateFilter value={state} onChange={onFilter} />
      )}
      {list.staleFailure ? (
        <FailureBanner
          op="listItems"
          failure={list.staleFailure}
          action={<RetryButton onRetry={list.retry} />}
        />
      ) : null}
      <ItemTable
        list={list}
        tenantId={tenantId}
        emptyKey={EMPTY_KEYS[state]}
        onRetired={(row) => {
          setSuggesting(false);
          setRetired(row);
          setNotice("retired");
        }}
        onConfirmed={() => setNotice("confirmed")}
      />
      <AsOf at={list.asOf} />
    </Panel>
  );
}
