import { Banner } from "@/components/Banner";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { DataTableSkeleton } from "@/components/DataTableSkeleton";
import { ListState } from "@/components/ListState";
import { DateTime, type T, useT } from "@/i18n";
import type { DeviceSummary } from "@/lib/device-queries";
import { type StoreDirectory, useStoreDirectory } from "@/shift-closes/useShiftCloses";
/**
 * RT-371 — Devices: the fleet table (read-only). Exception-first in the
 * SERVER's order (custody exception, then active by soonest expiry, then
 * revoked, then retired), keyset paged; the view never re-sorts or filters
 * loaded rows. "Stale" is not ordered: last seen is not recorded until RT-370.
 * Filters (store, trust state) live in the URL so Back from a detail and the
 * Store Detail deep link restore them; a filter never changes the active scope.
 *
 * A failed continuation keeps the loaded rows and offers an inline retry
 * (UX-10). A 404 is the API's uniform refusal: with a store filter it reads as
 * "this store's devices are not available to you", never as an empty list.
 */
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { DeviceFilterBar } from "./DeviceFilterBar";
import { Attention, DeviceName, LastSeen, TrustBadge } from "./DeviceParts";
import {
  type DeviceFilters,
  buildListQuery,
  filtersFromSearch,
  filtersToSearch,
  isFiltered,
} from "./deviceFilters";
import {
  type DeviceError,
  type DeviceListState,
  useDeviceList,
  useDeviceScope,
} from "./useDevices";
import "../shell/surface.css";
import "./devices.css";

function deviceColumns(
  t: T,
  directory: StoreDirectory,
  now: number,
): DataTableColumn<DeviceSummary>[] {
  return [
    {
      key: "device",
      header: t("devices.list.col.device"),
      cell: (d) => <DeviceName label={d.label} deviceId={d.deviceId} />,
    },
    {
      key: "store",
      header: t("devices.list.col.store"),
      cell: (d) => directory.nameOf(d.storeId) ?? t("devices.list.unknownStore"),
    },
    {
      key: "trust",
      header: t("devices.list.col.trust"),
      cell: (d) => <TrustBadge trustState={d.trustState} />,
    },
    {
      key: "attention",
      header: t("devices.list.col.attention"),
      cell: (d) => <Attention device={d} now={now} />,
    },
    {
      key: "expires",
      header: t("devices.list.col.expires"),
      cell: (d) => <DateTime value={d.expiresAt} timeZone={directory.timeZoneOf(d.storeId)} />,
    },
    {
      key: "lastSeen",
      header: t("devices.list.col.lastSeen"),
      cell: (d) => (
        <LastSeen
          lastSeenAt={d.lastSeenAt}
          lastSeenSource={d.lastSeenSource}
          timeZone={directory.timeZoneOf(d.storeId)}
        />
      ),
    },
  ];
}

function ErrorView({
  error,
  storeFiltered,
  onRetry,
}: Readonly<{
  error: DeviceError;
  storeFiltered: boolean;
  onRetry: () => void;
}>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") {
    return storeFiltered ? (
      <ListState
        state="empty"
        emptyMessage={t("devices.list.storeUnavailable")}
        emptyHint={t("devices.list.storeUnavailableHint")}
      />
    ) : (
      <ListState state="empty" emptyMessage={t("devices.list.unavailable")} />
    );
  }
  if (error.kind === "session") {
    return (
      <Banner
        variant="danger"
        message={t("devices.list.sessionExpired")}
        requestId={error.requestId}
      />
    );
  }
  const retry = (
    <button type="button" className="btn-secondary" onClick={onRetry}>
      {t("devices.list.retry")}
    </button>
  );
  const rejected = error.kind === "rejected";
  return (
    <Banner
      variant={rejected ? "warning" : "danger"}
      message={t(rejected ? "devices.list.filterRejected" : "devices.list.loadFailed")}
      requestId={error.requestId}
      action={retry}
    />
  );
}

/** Loaded count, the inline continuation error, and Load more. */
function Pager({ list }: Readonly<{ list: DeviceListState }>): React.JSX.Element {
  const t = useT();
  return (
    <>
      {list.inlineError ? (
        <Banner
          variant="danger"
          message={t("devices.list.inlineError")}
          requestId={list.inlineError.requestId}
          action={
            <button type="button" className="btn-secondary" onClick={list.retry}>
              {t("devices.list.retry")}
            </button>
          }
        />
      ) : null}
      <div className="device-pager">
        <span>{t("devices.list.loaded", { count: list.rows.length })}</span>
        {list.hasMore ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={list.loadMore}
            disabled={list.isFetchingNextPage}
          >
            {list.isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
            {t("devices.list.loadMore")}
          </button>
        ) : null}
      </div>
    </>
  );
}

interface ResultsProps {
  list: DeviceListState;
  directory: StoreDirectory;
  filters: DeviceFilters;
  onOpen: (row: DeviceSummary) => void;
}

/**
 * Rows are held back until the store roster has settled (read or failed), so a
 * time is never shown in UTC, or a store as unknown, just because the roster
 * had not arrived yet.
 */
function awaitingRoster(list: DeviceListState, directory: StoreDirectory): boolean {
  return list.rows.length > 0 && !directory.ready;
}

function Results({ list, directory, filters, onOpen }: Readonly<ResultsProps>): React.JSX.Element {
  const t = useT();
  // One clock reading per mount: "expiry passed" does not flicker between renders.
  const [now] = useState(() => Date.now());
  const columns = deviceColumns(t, directory, now);
  const pending = list.isLoading || awaitingRoster(list, directory);
  if (pending) {
    return (
      <DataTableSkeleton
        caption={t("devices.list.caption")}
        columns={columns}
        label={t("devices.list.loadingNoun")}
      />
    );
  }
  if (list.error) {
    return (
      <ErrorView error={list.error} storeFiltered={filters.storeId !== ""} onRetry={list.retry} />
    );
  }
  if (list.rows.length === 0) {
    const filtered = isFiltered(filters);
    return (
      <ListState
        state="empty"
        emptyMessage={t(filtered ? "devices.list.emptyFiltered" : "devices.list.empty")}
        emptyHint={t(filtered ? "devices.list.emptyFilteredHint" : "devices.list.emptyHint")}
      />
    );
  }
  return (
    <>
      <DataTable
        caption={t("devices.list.caption")}
        columns={columns}
        rows={list.rows}
        rowKey={(d) => d.deviceId}
        onRowActivate={onOpen}
      />
      <Pager list={list} />
    </>
  );
}

export function DeviceList(): React.JSX.Element {
  const t = useT();
  const scope = useDeviceScope();
  const [search, setSearch] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const directory = useStoreDirectory(scope.tenantId);

  const filters = filtersFromSearch(search);
  const list = useDeviceList(scope, buildListQuery(filters));

  if (!scope.tenantId) {
    return (
      <div className="surface">
        <p className="content__sub">{t("devices.list.scopePrompt")}</p>
      </div>
    );
  }

  return (
    <div className="surface">
      <header className="surface__head">
        <div>
          <h1 className="content__title">{t("devices.list.title")}</h1>
          <p className="content__sub">
            {t.rich("devices.list.sub", { tenant: <bdi>{scope.tenantName}</bdi> })}
          </p>
        </div>
      </header>
      <p className="content__sub">{t("devices.list.orderNote")}</p>
      <p className="content__sub">{t("devices.list.staleNote")}</p>

      <DeviceFilterBar
        applied={filters}
        stores={directory.stores}
        onApply={(next) => setSearch(filtersToSearch(next))}
        onClear={() => setSearch(new URLSearchParams())}
      />

      <Results
        list={list}
        directory={directory}
        filters={filters}
        onOpen={(row) => navigate(`/devices/${row.deviceId}`, { state: { list: location.search } })}
      />
    </div>
  );
}
