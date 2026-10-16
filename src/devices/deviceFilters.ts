/**
 * RT-371 filters: store and trust state, parsed from and written to the URL and
 * turned into the list request. The server applies them (dataset, not the
 * loaded rows), and a cursor is only valid with the filters that issued it.
 * A store that is not a UUID is sent as-is: the server's 400 is the answer, so a
 * hand-edited link is never silently widened to every store.
 */
import type { DeviceListQuery, TrustState } from "@/lib/device-queries";

export const PAGE_SIZE = 50;

export interface DeviceFilters {
  storeId: string;
  trustState: TrustState | "";
}

const TRUST_STATES: ReadonlySet<string> = new Set(["active", "revoked", "retired"]);

export const EMPTY_FILTERS: DeviceFilters = { storeId: "", trustState: "" };

export function filtersFromSearch(search: URLSearchParams): DeviceFilters {
  const state = search.get("state") ?? "";
  return {
    storeId: search.get("store") ?? "",
    trustState: TRUST_STATES.has(state) ? (state as TrustState) : "",
  };
}

export function filtersToSearch(filters: DeviceFilters): URLSearchParams {
  const pairs: [string, string][] = [
    ["store", filters.storeId],
    ["state", filters.trustState],
  ];
  return new URLSearchParams(pairs.filter(([, value]) => value !== ""));
}

export function isFiltered(filters: DeviceFilters): boolean {
  return filters.storeId !== "" || filters.trustState !== "";
}

/** The list query; the caller adds the cursor. */
export function buildListQuery(filters: DeviceFilters): DeviceListQuery {
  const query: DeviceListQuery = { page_size: PAGE_SIZE };
  if (filters.storeId) query.store_id = filters.storeId;
  if (filters.trustState) query.trust_state = filters.trustState;
  return query;
}
