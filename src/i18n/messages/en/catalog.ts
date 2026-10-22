import type { catalog as ar } from "../ar/catalog";
import type { MessagesOf } from "../types";

/**
 * English copy for the catalog product list (RT-765, CAT-C1a). Read-only.
 * Terminology (UX-12): the Retail Item is «الصنف», "Item" in English. The list
 * never claims a total: the contract has none, so the count is what is loaded.
 */
export const catalog: MessagesOf<typeof ar> = {
  // --- Navigation ------------------------------------------------------------
  "catalog.nav.label": "Items",

  // --- List ------------------------------------------------------------------
  "catalog.list.title": "Items",
  "catalog.list.sub": "The items catalogued in {tenant}. Read-only.",
  "catalog.list.storeNote": "Showing the values of {store}, as the server resolves them.",
  "catalog.list.scopePrompt": "Select a tenant to view items.",
  "catalog.list.caption": "Items, by name from A to Z",
  "catalog.list.captionSearch": "Items, exact code matches first, then by name from A to Z",
  "catalog.list.loadingNoun": "items",
  "catalog.list.empty": "There are no active items yet.",
  "catalog.list.emptyHint": "Items appear here once they are in the catalog.",
  "catalog.list.emptyFiltered": "No items match {filters}.",
  "catalog.list.emptyFilteredHint": "Change the filters or clear them.",
  "catalog.list.clearFilters": "Clear filters",
  "catalog.list.partialPage":
    "No matching items in the part checked so far. Choose “Load more” to keep looking.",
  "catalog.list.ended": "End of the items.",
  "catalog.list.unavailable": "These items are not available to you.",
  "catalog.list.unavailableHint": "Choose another tenant or store.",
  "catalog.list.storeStale": "The selected store is no longer available.",
  "catalog.list.storeStaleHint": "Change the store in the scope bar, or choose “All stores”.",
  "catalog.list.filterRejected":
    "The server rejected this search. Check the search text and the category.",
  "catalog.list.loadFailed": "Could not load items.",
  "catalog.list.sessionExpired": "Your session has expired. Sign in again.",
  "catalog.list.inlineError":
    "The rest of the rows could not be loaded. The rows shown are from the last successful load.",
  "catalog.list.retry": "Retry",
  "catalog.list.cursorRejected":
    "The server did not accept the position of the next page. Start again from the first page.",
  "catalog.list.restart": "Start again",
  "catalog.list.loaded": "Loaded items: {count}",
  "catalog.list.loadMore": "Load more",
  "catalog.list.col.item": "Item",
  "catalog.list.col.status": "Status",
  "catalog.list.col.price": "Price",
  "catalog.list.col.sku": "SKU",
  "catalog.list.col.barcode": "Barcode",
  "catalog.list.col.category": "Category",
  "catalog.list.col.availability": "Store availability",
  "catalog.list.col.taxCategory": "Tax category",
  "catalog.list.col.tracking": "Tracking",
  "catalog.list.col.updatedAt": "Updated",

  // --- Values ----------------------------------------------------------------
  "catalog.value.noPrice": "No price",
  "catalog.value.noCategory": "No category",
  "catalog.status.active": "Active",
  "catalog.status.inactive": "Inactive",
  "catalog.status.retired": "Retired",
  "catalog.status.any": "Any status",
  "catalog.status.unknownCode": "Unrecognised status",
  "catalog.availability.yes": "Available",
  "catalog.availability.no": "Not available",
  "catalog.availability.override": "Store-specific",
  "catalog.tracking.none": "None",
  "catalog.tracking.batch": "By batch",
  "catalog.tracking.serial": "By serial number",
  "catalog.tracking.unknownCode": "Unrecognised tracking",

  // --- Filters ---------------------------------------------------------------
  "catalog.filter.label": "Item filters",
  "catalog.filter.q": "Name or code",
  "catalog.filter.qNote":
    "Matches a barcode, SKU or quick-sale code exactly, or part of the name. The text is sent exactly as typed.",
  "catalog.filter.status": "Status",
  "catalog.filter.category": "Category",
  "catalog.filter.categoryAll": "All categories",
  "catalog.filter.categoryLoading": "Loading…",
  "catalog.filter.categoryStale": "Unavailable category",
  "catalog.filter.categorySelected": "Selected category",
  "catalog.filter.categoriesFailed": "Categories could not be loaded.",
  "catalog.filter.apply": "Search",
  "catalog.filter.clear": "Clear",
  "catalog.filter.qTooLong": "Search text can be at most 100 characters.",
  "catalog.filter.categoryInvalid": "The category in the link is not valid.",

  // --- Filter summary (the filtered-empty message) ---------------------------
  "catalog.summary.q": "search “{q}”",
  "catalog.summary.status": "status: {status}",
  "catalog.summary.category": "category: {category}",
  "catalog.summary.join": ", ",

  // --- Detail (RT-766, CAT-C1b) -----------------------------------------------
  "catalog.detail.back": "Back to items",
  "catalog.detail.scopePrompt": "Select a tenant to view this item.",
  "catalog.detail.sub": "Item in {tenant}. Read-only.",
  "catalog.detail.loadingNoun": "item",
  "catalog.detail.unavailable": "This item is not available to you.",
  "catalog.detail.unavailableHint": "It may not exist, or it may be outside your tenant or stores.",
  "catalog.detail.loadFailed": "Could not load this item.",
  "catalog.detail.sessionExpired": "Your session has expired. Sign in again.",
  "catalog.detail.rateLimited": "Too many requests. Wait a moment, then try again.",
  "catalog.detail.retry": "Retry",
  "catalog.detail.inventoryLink": "View on-hand stock in {store}",

  "catalog.detail.tenant.title": "Tenant values",
  "catalog.detail.field.status": "Status",
  "catalog.detail.field.description": "Description",
  "catalog.detail.field.category": "Category",
  "catalog.detail.field.taxCategory": "Tax category",
  "catalog.detail.field.tenantAvailability": "Tenant availability",
  "catalog.detail.field.availability": "Availability",
  "catalog.detail.field.tracking": "Tracking",
  "catalog.detail.field.price": "Price",
  "catalog.detail.field.updatedAt": "Updated",
  "catalog.detail.value.noDescription": "No description",
  "catalog.detail.noPriceNotice": "No price: the POS will not sell this item until a price is set.",

  "catalog.detail.identifiers.title": "Identifiers",
  "catalog.detail.identifiers.caption": "Active identifiers of this item",
  "catalog.detail.identifiers.col.type": "Type",
  "catalog.detail.identifiers.col.value": "Value",
  "catalog.detail.identifiers.col.scope": "Scope",
  "catalog.detail.identifiers.col.source": "Source system",
  "catalog.detail.identifiers.scopeAll": "All stores",
  "catalog.detail.identifiers.empty": "This item has no active identifiers.",
  "catalog.detail.identifierType.barcode": "Barcode",
  "catalog.detail.identifierType.sku": "SKU",
  "catalog.detail.identifierType.plu": "Quick-sale code (PLU)",
  "catalog.detail.identifierType.supplier_code": "Supplier code",
  "catalog.detail.identifierType.external_pos_id": "External POS id",
  "catalog.detail.identifierType.unknownCode": "Unrecognised type",

  "catalog.detail.overrides.title": "Store overrides",
  "catalog.detail.overrides.sub":
    "Each store's own values exactly as stored, next to the tenant value. The value a store actually sells with is resolved by the server: choose a store in the scope bar and open the item list to see it.",
  "catalog.detail.overrides.empty": "No store in your scope has its own values for this item.",
  "catalog.detail.overrides.noValues": "This override sets no value of its own.",
  "catalog.detail.overrides.caption": "Store override for {store}",
  "catalog.detail.overrides.col.setting": "Setting",
  "catalog.detail.overrides.col.store": "Store value",
  "catalog.detail.overrides.col.tenant": "Tenant value",
};
