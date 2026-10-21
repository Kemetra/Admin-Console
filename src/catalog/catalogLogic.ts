/**
 * RT-765 pure helpers for the catalog list (CAT-C1a). No React, no fetch. The
 * view renders server truth: it never recomputes a price, an availability or a
 * resolved value (RT-752 D8; the shared resolver lives in Backend-Core).
 *
 * Helpers return catalog message keys, never copy; components translate at
 * render so a locale switch re-renders them (RT-399).
 */
import type { MessageKey } from "@/i18n";
import type { CatalogListQuery, CatalogProduct, CatalogStatusFilter } from "@/lib/catalog-queries";

/** Roles the API lets read the catalog (RT-752 AC 1). */
export const READ_ROLES = ["owner", "tenant_admin", "store_manager"] as const;

/** Navigation gate: mirrors the API's read roles. Not an authorization decision. */
export function canReadCatalog(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}

/** The page size asked for. The server may return fewer (RT-752 AC 4). */
export const CATALOG_PAGE_SIZE = 50;

/** The contract's limit on the search text. */
export const MAX_QUERY_LENGTH = 100;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// --- Keyset paging -----------------------------------------------------------

/**
 * getNextPageParam. A page may be short or empty with a non-null cursor; only
 * `null` ends the walk.
 */
export function nextCatalogCursor(page: { nextCursor: string | null }): string | undefined {
  return page.nextCursor ?? undefined;
}

/** The walk has ended: the last loaded page carries `nextCursor: null`. */
export function listEnded(pages: readonly { nextCursor: string | null }[]): boolean {
  // No page yet is not an end: `undefined === null` is false.
  return pages.at(-1)?.nextCursor === null;
}

/**
 * The contract's walk is not a snapshot, so a product renamed mid-walk can
 * appear on two pages. One row per `productId`, and the later occurrence wins
 * (RT-752 D4): the earlier row is dropped and the later one keeps its position.
 */
export function dedupeProducts(rows: readonly CatalogProduct[]): CatalogProduct[] {
  const byId = new Map<string, CatalogProduct>();
  for (const row of rows) {
    byId.delete(row.productId);
    byId.set(row.productId, row);
  }
  return [...byId.values()];
}

// --- Filters (the URL is the source of truth) --------------------------------

export interface CatalogFilters {
  /** Sent verbatim: an exact code keeps its leading zeros and every space. */
  q: string;
  status: CatalogStatusFilter;
  categoryId: string;
}

export const STATUS_FILTERS = ["active", "inactive", "retired", "any"] as const;

const DEFAULT_STATUS: CatalogStatusFilter = "active";

export function defaultFilters(): CatalogFilters {
  return { q: "", status: DEFAULT_STATUS, categoryId: "" };
}

export function isDefaultFilters(filters: CatalogFilters): boolean {
  return filters.q === "" && filters.status === DEFAULT_STATUS && filters.categoryId === "";
}

function statusOf(value: string | null): CatalogStatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as CatalogStatusFilter)
    : DEFAULT_STATUS;
}

export function filtersFromSearch(search: URLSearchParams): CatalogFilters {
  return {
    q: search.get("q") ?? "",
    status: statusOf(search.get("status")),
    // The contract's id is case-insensitive; the form's options carry it lower case.
    categoryId: (search.get("category") ?? "").toLowerCase(),
  };
}

/** Defaults are left out, so the bare list URL stays the bare list. */
export function filtersToSearch(filters: CatalogFilters): URLSearchParams {
  const search = new URLSearchParams();
  if (filters.q !== "") search.set("q", filters.q);
  if (filters.status !== DEFAULT_STATUS) search.set("status", filters.status);
  if (filters.categoryId !== "") search.set("category", filters.categoryId);
  return search;
}

export type FilterErrors = Partial<Record<"q" | "category", MessageKey>>;

/** What the server would refuse with a 400, caught before the request. */
export function validateFilters(filters: CatalogFilters): FilterErrors {
  const errors: FilterErrors = {};
  if (filters.q.length > MAX_QUERY_LENGTH) errors.q = "catalog.filter.qTooLong";
  if (filters.categoryId !== "" && !UUID_PATTERN.test(filters.categoryId)) {
    errors.category = "catalog.filter.categoryInvalid";
  }
  return errors;
}

/** The first-page query. Empty filters are left out; the status and size always go. */
export function buildListQuery(
  filters: CatalogFilters,
  storeId: string | null,
): NonNullable<CatalogListQuery> {
  return {
    ...(filters.q === "" ? {} : { q: filters.q }),
    status: filters.status,
    ...(filters.categoryId === "" ? {} : { category_id: filters.categoryId }),
    ...(storeId ? { store_id: storeId } : {}),
    limit: CATALOG_PAGE_SIZE,
  };
}

// --- Label keys (machine codes drive copy; they are not copy) -----------------

function keyOf(map: Record<string, MessageKey>, code: string, fallback: MessageKey): MessageKey {
  return Object.hasOwn(map, code) ? map[code] : fallback;
}

const STATUS_KEYS: Record<string, MessageKey> = {
  active: "catalog.status.active",
  inactive: "catalog.status.inactive",
  retired: "catalog.status.retired",
};

/** An unrecognised status is said so; it is never shown as «نشط». */
export function statusKey(status: string): MessageKey {
  return keyOf(STATUS_KEYS, status, "catalog.status.unknownCode");
}

/** A status filter value: the three statuses, and `any` for no status filter. */
export function statusFilterKey(status: string): MessageKey {
  return status === "any" ? "catalog.status.any" : statusKey(status);
}

const TRACKING_KEYS: Record<string, MessageKey> = {
  none: "catalog.tracking.none",
  batch: "catalog.tracking.batch",
  serial: "catalog.tracking.serial",
};

export function trackingKey(mode: string): MessageKey {
  return keyOf(TRACKING_KEYS, mode, "catalog.tracking.unknownCode");
}

export function availabilityKey(effectiveActive: boolean): MessageKey {
  return effectiveActive ? "catalog.availability.yes" : "catalog.availability.no";
}
