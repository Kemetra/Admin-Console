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
};
