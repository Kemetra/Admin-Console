/**
 * RT-725 ERPNext warehouse mappings (`catalog/erpnext-warehouse-map.yaml`): the
 * tenant's active store → ERPNext Warehouse mappings, a Set form for a store
 * that has none yet, and Retire. Every change passes an inline confirm; Retire
 * carries the version on screen. A re-point is a retire, then a fresh set.
 *
 * Store names come from the caller's own store list; a mapping whose store is
 * not in it reads "unknown store" with its id, never a guessed name.
 */
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { AsOf, Panel } from "@/erp-status/parts";
import { DateTime, type T, useT } from "@/i18n";
import type { ErpnextWarehouseMapping } from "@/lib/erp-mapping-queries";
import { useId, useState } from "react";
import { FailureBanner, InlineConfirm, Ref } from "./MappingParts";
import { cleanRef, purposeKey, unmappedStores } from "./mappingLogic";
import {
  type ListView,
  useRetireWarehouseMapping,
  useSetWarehouseMapping,
  useWarehouseMappings,
} from "./useErpMappings";

export interface MappingStore {
  id: string;
  name?: string;
}

export interface StoreOptions {
  stores: MappingStore[];
  /** The store list is still being read: nothing is offered or claimed yet. */
  loading: boolean;
  /** The store list could not be read: no store can be offered. */
  failed: boolean;
}

function columns(t: T): { key: string; header: string }[] {
  return [
    { key: "store", header: t("erp.map.wh.col.store") },
    { key: "purpose", header: t("erp.map.wh.col.purpose") },
    { key: "warehouse", header: t("erp.map.wh.col.warehouse") },
    { key: "set", header: t("erp.map.wh.col.setAt") },
    { key: "actions", header: t("erp.map.col.actions") },
  ];
}

function StoreName({
  id,
  stores,
}: Readonly<{ id: string; stores: readonly MappingStore[] }>): React.JSX.Element {
  const t = useT();
  const name = stores.find((s) => s.id === id)?.name;
  if (name) return <bdi>{name}</bdi>;
  return (
    <span className="erp-stack">
      <span>{t("erp.runs.unknownStore")}</span>
      <Ref value={id} />
    </span>
  );
}

interface SetDraft {
  storeId: string;
  ref: string;
}

const EMPTY_DRAFT: SetDraft = { storeId: "", ref: "" };

/** A field's error line, tied to its control by id. */
function FieldError({ id, message }: Readonly<{ id: string; message: string | null }>) {
  if (message === null) return null;
  return (
    <p className="map-form__error" id={id}>
      {message}
    </p>
  );
}

/** Store and reference, checked before the confirm: an empty or unoffered value is never sent. */
function SetFields({
  available,
  initial,
  onReview,
}: Readonly<{
  available: readonly MappingStore[];
  initial: SetDraft;
  onReview: (draft: SetDraft) => void;
}>): React.JSX.Element {
  const t = useT();
  const formId = useId();
  const [draft, setDraft] = useState(initial);
  const [missing, setMissing] = useState({ store: false, ref: false });
  const storeInput = `${formId}-store`;
  const refInput = `${formId}-ref`;
  const describedBy = (bad: boolean, id: string) => (bad ? `${id}-error` : undefined);
  return (
    <form
      className="map-form"
      aria-label={t("erp.map.wh.set.label")}
      onSubmit={(e) => {
        e.preventDefault();
        const ref = cleanRef(draft.ref);
        const next = { store: !available.some((s) => s.id === draft.storeId), ref: ref === "" };
        setMissing(next);
        if (!next.store && !next.ref) onReview({ storeId: draft.storeId, ref });
      }}
    >
      <div className="map-form__grid">
        <div className="field">
          <label htmlFor={storeInput}>{t("erp.map.wh.set.store")}</label>
          <select
            id={storeInput}
            className="input"
            value={draft.storeId}
            aria-invalid={missing.store}
            aria-describedby={describedBy(missing.store, storeInput)}
            onChange={(e) => setDraft({ ...draft, storeId: e.target.value })}
          >
            <option value="">{t("erp.map.wh.set.pickStore")}</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name ?? s.id}
              </option>
            ))}
          </select>
          <FieldError
            id={`${storeInput}-error`}
            message={missing.store ? t("erp.map.form.storeRequired") : null}
          />
        </div>
        <div className="field">
          <label htmlFor={refInput}>{t("erp.map.wh.set.ref")}</label>
          <input
            id={refInput}
            className="input input--mono"
            dir="ltr"
            autoComplete="off"
            value={draft.ref}
            aria-invalid={missing.ref}
            aria-describedby={describedBy(missing.ref, refInput)}
            onChange={(e) => setDraft({ ...draft, ref: e.target.value })}
          />
          <FieldError
            id={`${refInput}-error`}
            message={missing.ref ? t("erp.map.form.required") : null}
          />
        </div>
      </div>
      <div className="map-confirm__actions">
        <button type="submit" className="btn-primary">
          {t("erp.map.review")}
        </button>
      </div>
    </form>
  );
}

/** The explicit confirm of a set: sent once; a refusal stays here. */
function SetConfirm({
  tenantId,
  draft,
  stores,
  onSet,
  onCancel,
}: Readonly<{
  tenantId: string;
  draft: SetDraft;
  stores: readonly MappingStore[];
  onSet: () => void;
  onCancel: () => void;
}>): React.JSX.Element {
  const t = useT();
  const set = useSetWarehouseMapping(tenantId);
  const name = stores.find((s) => s.id === draft.storeId)?.name ?? draft.storeId;
  return (
    <InlineConfirm
      label={t("erp.map.wh.set.label")}
      prompt={t.rich("erp.map.wh.set.prompt", {
        store: <bdi>{name}</bdi>,
        warehouse: <Ref value={draft.ref} />,
      })}
      confirmLabel={t("erp.map.wh.set.action")}
      op="setWarehouse"
      pending={set.pending}
      failure={set.failure}
      onConfirm={() =>
        set.run({ store_id: draft.storeId, erpnext_warehouse_ref: draft.ref }, (outcome) => {
          if (outcome.ok) onSet();
        })
      }
      onCancel={onCancel}
    />
  );
}

function SetForm({
  tenantId,
  options,
  mappings,
  onSet,
}: Readonly<{
  tenantId: string;
  options: StoreOptions;
  mappings: readonly ErpnextWarehouseMapping[];
  onSet: () => void;
}>): React.JSX.Element | null {
  const t = useT();
  const [draft, setDraft] = useState<SetDraft>(EMPTY_DRAFT);
  const [review, setReview] = useState(false);
  const available = unmappedStores(options.stores, mappings);

  if (options.loading) return null;
  if (options.failed) return <p className="erp-note">{t("erp.map.wh.set.storesFailed")}</p>;
  if (review) {
    return (
      <SetConfirm
        tenantId={tenantId}
        draft={draft}
        stores={options.stores}
        onSet={() => {
          setReview(false);
          setDraft(EMPTY_DRAFT);
          onSet();
        }}
        onCancel={() => setReview(false)}
      />
    );
  }
  if (available.length === 0) return <p className="erp-note">{t("erp.map.wh.set.allMapped")}</p>;
  return (
    <SetFields
      available={available}
      initial={draft}
      onReview={(next) => {
        setDraft(next);
        setReview(true);
      }}
    />
  );
}

function RetireStep({
  tenantId,
  row,
  stores,
  onDone,
  onCancel,
}: Readonly<{
  tenantId: string;
  row: ErpnextWarehouseMapping;
  stores: readonly MappingStore[];
  onDone: () => void;
  onCancel: () => void;
}>): React.JSX.Element {
  const t = useT();
  const retire = useRetireWarehouseMapping(tenantId);
  return (
    <InlineConfirm
      label={t("erp.map.wh.retire.label")}
      prompt={t.rich("erp.map.wh.retire.prompt", {
        store: <StoreName id={row.store_id} stores={stores} />,
        warehouse: <Ref value={row.erpnext_warehouse_ref} />,
      })}
      confirmLabel={t("erp.map.wh.retire.action")}
      destructive
      op="retireWarehouse"
      pending={retire.pending}
      failure={retire.failure}
      onConfirm={() =>
        retire.run({ id: row.id, version: row.version }, (outcome) => {
          if (outcome.ok) onDone();
        })
      }
      onCancel={onCancel}
    />
  );
}

function WarehouseTable({
  list,
  tenantId,
  stores,
  onRetired,
}: Readonly<{
  list: ListView<ErpnextWarehouseMapping>;
  tenantId: string;
  stores: readonly MappingStore[];
  onRetired: () => void;
}>): React.JSX.Element {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const cols = columns(t);
  if (list.isLoading) {
    return (
      <DataTableSkeleton
        caption={t("erp.map.wh.title")}
        columns={cols}
        label={t("erp.map.wh.loading")}
      />
    );
  }
  if (list.failure) {
    const retry =
      list.failure.kind === "unavailable" ? undefined : (
        <button type="button" className="btn-secondary" onClick={list.retry}>
          {t("erp.retry")}
        </button>
      );
    return <FailureBanner op="listWarehouses" failure={list.failure} action={retry} />;
  }
  if (list.rows.length === 0)
    return <ListState state="empty" emptyMessage={t("erp.map.wh.empty")} />;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="data-table__caption">{t("erp.map.wh.title")}</caption>
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
          {list.rows.map((row) => {
            const purpose = purposeKey(row.purpose);
            return (
              <WarehouseRowGroup key={row.id} open={open === row.id} colSpan={cols.length}>
                <tr className="erp-row">
                  <td className="erp-row__name">
                    <StoreName id={row.store_id} stores={stores} />
                  </td>
                  <td>{purpose ? t(purpose) : <Ref value={row.purpose} />}</td>
                  <td>
                    <Ref value={row.erpnext_warehouse_ref} />
                  </td>
                  <td>
                    <DateTime value={row.set_at} />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={open === row.id}
                      onClick={() => setOpen(row.id)}
                    >
                      {t("erp.map.wh.retire.action")}
                    </button>
                  </td>
                </tr>
                <RetireStep
                  tenantId={tenantId}
                  row={row}
                  stores={stores}
                  onDone={() => {
                    setOpen(null);
                    onRetired();
                  }}
                  onCancel={() => setOpen(null)}
                />
              </WarehouseRowGroup>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The row, and below it (only while open) its retire confirm. */
function WarehouseRowGroup({
  open,
  colSpan,
  children,
}: Readonly<{ open: boolean; colSpan: number; children: [React.ReactNode, React.ReactNode] }>) {
  const [row, confirm] = children;
  return (
    <>
      {row}
      {open ? (
        <tr className="erp-row map-confirm-row">
          <td colSpan={colSpan}>{confirm}</td>
        </tr>
      ) : null}
    </>
  );
}

type Notice = "set" | "retired";

const NOTICE_KEYS = {
  set: "erp.map.wh.notice.set",
  retired: "erp.map.wh.notice.retired",
} as const;

export function WarehouseMappings({
  tenantId,
  options,
}: Readonly<{ tenantId: string; options: StoreOptions }>): React.JSX.Element {
  const t = useT();
  const list = useWarehouseMappings(tenantId, true);
  const [notice, setNotice] = useState<Notice | null>(null);
  const showForm = !list.isLoading && list.failure === undefined;
  return (
    <Panel id="map-wh-title" title={t("erp.map.wh.title")}>
      <p className="erp-note">{t("erp.map.wh.note")}</p>
      <output className="map-notice">{notice ? t(NOTICE_KEYS[notice]) : null}</output>
      {showForm ? (
        <SetForm
          tenantId={tenantId}
          options={options}
          mappings={list.rows}
          onSet={() => setNotice("set")}
        />
      ) : null}
      {list.staleFailure ? (
        <FailureBanner
          op="listWarehouses"
          failure={list.staleFailure}
          action={
            <button type="button" className="btn-secondary" onClick={list.retry}>
              {t("erp.retry")}
            </button>
          }
        />
      ) : null}
      <WarehouseTable
        list={list}
        tenantId={tenantId}
        stores={options.stores}
        onRetired={() => setNotice("retired")}
      />
      <AsOf at={list.asOf} />
    </Panel>
  );
}
