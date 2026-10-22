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

  // RT-767: the shared product picker (active products only, no price).
  "catalog.picker.search": "Search active products",
  "catalog.picker.searchNote":
    "Type part of the name, or an exact barcode, SKU or quick-sale code. The text is sent exactly as typed.",
  "catalog.picker.submit": "Search",
  "catalog.picker.list": "Active products",
  "catalog.picker.loading": "Loading products",
  "catalog.picker.count": "Products shown: {count}",
  "catalog.picker.more": "Only the first products are shown. Refine the search to narrow the list.",
  "catalog.picker.empty": "No active product matches this search.",
  "catalog.picker.emptyAll": "There are no active products.",
  "catalog.picker.sku": "SKU",
  "catalog.picker.barcode": "Barcode",
  "catalog.picker.retry": "Try again",
  "catalog.picker.qTooLong": "Search text can be at most 100 characters.",
  "catalog.picker.error.notFound": "Products cannot be searched from this account or scope.",
  "catalog.picker.error.session": "Your session has ended. Sign in again to search products.",
  "catalog.picker.error.rejected":
    "The server rejected this search. Change the text and try again.",
  "catalog.picker.error.rateLimited":
    "Too many requests in a short time. Wait for the countdown, then try again.",
  "catalog.picker.error.generic": "Products could not be loaded.",
  // --- Edit and retire (RT-768, CAT-C2a) ----------------------------------------
  "catalog.detail.subWriter": "Item in {tenant}.",
  "catalog.detail.edit": "Edit item",
  "catalog.detail.retiredNotice":
    "This item is retired, so it is read-only. Its identifiers stay bound to it.",

  "catalog.edit.title": "Edit {name}",
  "catalog.edit.sub": "Changes apply in {tenant}. Only what you change is saved.",
  "catalog.edit.scopePrompt": "Select a tenant to edit this item.",
  "catalog.edit.back": "Back to item",
  "catalog.edit.loadingNoun": "item",
  "catalog.edit.readOnly": "You can view this item but not edit it.",
  "catalog.edit.readOnlyHint": "Editing items is for owners and tenant admins.",
  "catalog.edit.retired": "This item is retired, so it is read-only.",
  "catalog.edit.retiredHint": "Its identifiers stay bound to it. Retiring cannot be undone here.",
  "catalog.edit.section": "Item details",
  "catalog.edit.save": "Save changes",
  "catalog.edit.noChanges": "There are no changes to save.",
  "catalog.edit.reload": "Reload",
  "catalog.edit.reloaded":
    "The latest version is loaded. What you typed is kept. Check it, then save again.",
  "catalog.edit.reloadFailed": "Could not reload this item. What you typed is kept.",

  "catalog.form.required": "(required)",
  "catalog.form.name": "Name",
  "catalog.form.description": "Description",
  "catalog.form.category": "Category",
  "catalog.form.categoryNone": "No category",
  "catalog.form.categoryRetired": "{name} (retired)",
  "catalog.form.categoryUnavailableOption": "{name} (unavailable)",
  "catalog.form.categoriesFailed": "Categories could not be loaded. The current category is kept.",
  "catalog.form.taxCategory": "Tax category",
  "catalog.form.taxCategoryHint":
    "A short code, up to 50 characters, for example standard. It is kept as typed, apart from spaces at the ends.",
  "catalog.form.availability": "Available for sale by default",
  "catalog.form.availabilityHint": "A store can still set its own availability.",
  "catalog.form.price": "Price",
  "catalog.form.priceHint": "Prices are not edited here.",
  "catalog.form.error.nameRequired": "Enter the item name.",
  "catalog.form.error.nameTooLong": "The name can be at most 500 characters. Shorten it.",
  "catalog.form.error.descriptionTooLong":
    "The description can be at most 2000 characters. Shorten it.",
  "catalog.form.error.taxCategoryRequired": "Enter the tax category.",
  "catalog.form.error.taxCategoryTooLong":
    "The tax category can be at most 50 characters. Shorten it.",
  "catalog.form.error.categoryUnavailable":
    "This category is no longer available. Choose another category, or no category.",

  "catalog.write.error.validation":
    "The server rejected these values. Check the name, description and tax category, then try again.",
  "catalog.write.error.session": "Your session has expired. Sign in again.",
  "catalog.write.error.origin":
    "The request was refused because it did not come from this console. Reload the page and try again.",
  "catalog.write.error.forbidden": "You do not have permission to change this item.",
  "catalog.write.error.notFound": "This item is no longer available to you.",
  "catalog.write.error.conflict":
    "The item is in a state that does not allow this change. Reload and try again.",
  "catalog.write.error.stale":
    "This item changed since you opened it. Reload to get the latest version. What you typed is kept.",
  "catalog.write.error.staleRetire":
    "This item changed since you opened it. Reload to get the latest version, then decide again.",
  "catalog.write.error.retired": "This item is retired, so it can no longer be changed.",
  "catalog.write.error.rateLimited": "Too many requests. Wait a moment, then try again.",
  "catalog.write.error.server": "Something went wrong and nothing was saved. Try again.",

  "catalog.retire.section": "Retire this item",
  "catalog.retire.sub":
    "Retiring takes the item out of sale. It cannot be undone from the console.",
  "catalog.retire.start": "Retire item",
  "catalog.retire.confirmLabel": "Confirm: retire this item",
  "catalog.retire.prompt": "Retire {name}?",
  "catalog.retire.consequence":
    "Retiring cannot be undone here. The POS stops offering this item. Its barcodes and other identifiers stay bound to it, so they cannot be used for another item.",
  "catalog.retire.confirm": "Yes, retire item",
  "catalog.retire.done": "{name} is retired. It is read-only now.",
  "catalog.retire.reloaded": "The latest version is loaded. Retire again if you still want to.",
};
