/**
 * RT-766 pure helpers for the catalog product detail (CAT-C1b). No React, no
 * fetch. The detail shows the tenant's values and each store override as the
 * raw deviation it is, next to the tenant value it deviates from. It never
 * computes `override ?? tenant`: resolution belongs to Backend-Core's shared
 * resolver (RT-752 D8, CLAUDE.md §5).
 *
 * Helpers return message keys, never copy; components translate at render so a
 * locale switch re-renders them (RT-399).
 */
import type { MessageKey } from "@/i18n";
import { canReadInventory } from "@/inventory/inventoryLogic";
import type {
  CatalogIdentifier,
  CatalogMoney,
  CatalogProduct,
  CatalogStoreOverride,
} from "@/lib/catalog-queries";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A route id that is not a UUID would be a contract 400: it reads as not available, unasked. */
export function isProductId(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

/**
 * The tenant's availability: only an `active` product is sold. This is the
 * tenant status restated, not a resolved value.
 */
export function tenantAvailable(product: Pick<CatalogProduct, "status">): boolean {
  return product.status === "active";
}

// --- Store overrides: raw deviations --------------------------------------------------

/** One field a store overrides, beside the tenant value it deviates from. */
export type Deviation =
  | { field: "availability"; override: boolean; tenant: boolean }
  | { field: "taxCategory"; override: string; tenant: string }
  | { field: "price"; override: CatalogMoney; tenant: CatalogMoney | null };

export interface StoreDeviations {
  storeId: string;
  /** Empty when every field of the override is null: the store sets nothing of its own. */
  deviations: Deviation[];
}

/** A null override field is "not overridden", so it is no deviation. Fixed order. */
export function deviationsOf(
  override: CatalogStoreOverride,
  tenant: Pick<CatalogProduct, "status" | "taxCategory" | "defaultPrice">,
): Deviation[] {
  const found: Deviation[] = [];
  if (override.isActive !== null) {
    found.push({
      field: "availability",
      override: override.isActive,
      tenant: tenantAvailable(tenant),
    });
  }
  if (override.taxCategory !== null) {
    found.push({
      field: "taxCategory",
      override: override.taxCategory,
      tenant: tenant.taxCategory,
    });
  }
  if (override.price !== null) {
    found.push({ field: "price", override: override.price, tenant: tenant.defaultPrice });
  }
  return found;
}

export function storeDeviations(
  overrides: readonly CatalogStoreOverride[],
  tenant: Pick<CatalogProduct, "status" | "taxCategory" | "defaultPrice">,
): StoreDeviations[] {
  return overrides.map((o) => ({ storeId: o.storeId, deviations: deviationsOf(o, tenant) }));
}

export function deviationFieldKey(field: Deviation["field"]): MessageKey {
  switch (field) {
    case "availability":
      return "catalog.detail.field.availability";
    case "taxCategory":
      return "catalog.detail.field.taxCategory";
    case "price":
      return "catalog.detail.field.price";
  }
}

// --- Identifiers ----------------------------------------------------------------------

const IDENTIFIER_TYPE_KEYS: Record<string, MessageKey> = {
  barcode: "catalog.detail.identifierType.barcode",
  sku: "catalog.detail.identifierType.sku",
  plu: "catalog.detail.identifierType.plu",
  supplier_code: "catalog.detail.identifierType.supplier_code",
  external_pos_id: "catalog.detail.identifierType.external_pos_id",
};

/** An unrecognised type is said so; it is never shown as a known one. */
export function identifierTypeKey(type: string): MessageKey {
  return Object.hasOwn(IDENTIFIER_TYPE_KEYS, type)
    ? IDENTIFIER_TYPE_KEYS[type]
    : "catalog.detail.identifierType.unknownCode";
}

/** A stable row key: type, store and value identify one active identifier. */
export function identifierKey(identifier: CatalogIdentifier): string {
  return `${identifier.identifierType}|${identifier.storeId ?? ""}|${identifier.value}`;
}

// --- Cross-link -------------------------------------------------------------------------

/**
 * The inventory on-hand view of this item in the store in scope (RT-728), or
 * null: with "All stores" there is no store to read, and a role the inventory
 * API refuses gets no dead link.
 */
export function inventoryPath(
  role: string | null | undefined,
  activeStoreId: string | null,
  productId: string,
): string | null {
  if (!activeStoreId || !canReadInventory(role)) return null;
  return `/inventory/stores/${activeStoreId}/products/${productId}`;
}

// --- Store names ------------------------------------------------------------------------

interface StoreNamed {
  id?: unknown;
  name?: unknown;
}

function nameEntry(row: StoreNamed | null): [string, string][] {
  return typeof row?.id === "string" && typeof row.name === "string" ? [[row.id, row.name]] : [];
}

/**
 * Store id to name, from whatever the stores read answered with: anything but
 * a list gives no names, and a row without a string id and name is skipped.
 * The active store's name comes from the scope and wins.
 */
export function storeNameMap(
  rows: unknown,
  active: { id: string | null; name: string | null },
): Map<string, string> {
  const names = new Map<string, string>(Array.isArray(rows) ? rows.flatMap(nameEntry) : []);
  if (active.id && active.name) names.set(active.id, active.name);
  return names;
}
