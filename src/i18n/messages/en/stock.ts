import type { stock as ar } from "../ar/stock";
import type { MessagesOf } from "../types";

export const stock: MessagesOf<typeof ar> = {
  // --- Stock discrepancies: shared ----------------------------------------
  "stock.title": "ERPNext stock discrepancies",
  "stock.tenantPrompt": "Select a tenant to view ERPNext stock discrepancies.",
  "stock.loadFailed": "ERPNext stock discrepancies could not be loaded.",
  "stock.inlineError":
    "Some rows could not be loaded. The rows shown are from the last successful load.",
  "stock.retry": "Retry",

  "stock.status.fresh": "Fresh snapshot",
  "stock.status.stale": "Stale snapshot",
  "stock.status.none": "No ERPNext snapshot",
  "stock.noSnapshotReason.notRecorded": "Not recorded yet",
  "stock.noSnapshotReason.noMapping": "No warehouse mapping",
  "stock.notice.noSnapshot":
    "No ERPNext snapshot has been recorded for this store yet, so its ERPNext stock is unknown. This is not the same as having no discrepancies.",
  "stock.notice.noMapping":
    "No ERPNext snapshot: this store has no ERPNext stock warehouse mapping, so its ERPNext stock is unknown. This is not the same as having no discrepancies.",
  "stock.notice.stale":
    "This ERPNext snapshot is older than {age}. The items below come from that snapshot and may no longer match ERPNext. Request a fresh snapshot to re-read ERPNext.",

  // --- Store summary list -------------------------------------------------
  "stock.stores.sub":
    "Items with negative on-hand quantity in each store's latest recorded ERPNext snapshot. Read-only; resolve the cause in ERPNext Desk.",
  "stock.stores.notFound":
    "Not found. ERPNext stock discrepancies are not available to you in this tenant.",
  "stock.stores.caption": "Stores",
  "stock.stores.col.store": "Store",
  "stock.stores.col.snapshot": "ERPNext snapshot",
  "stock.stores.col.asOf": "As of",
  "stock.stores.col.negativeItems": "Negative items",
  "stock.stores.col.request": "Snapshot request",
  "stock.stores.count": "{count}",
  "stock.stores.countUnknown": "Unknown",
  "stock.stores.pending": "Requested, awaiting Connector",
  "stock.stores.noPending": "None",
  "stock.stores.loadingNoun": "stores",
  "stock.stores.empty": "No stores are available to you in this tenant.",
  "stock.stores.loadMore": "Load more stores",

  // --- One store's negative items ------------------------------------------
  "stock.store.back": "Back to stores",
  "stock.store.sub": "Items below zero in this store's latest recorded ERPNext snapshot.",
  "stock.store.notFoundTitle": "Store not found",
  "stock.store.notFound": "Not found. This store does not exist or is not available to you.",
  "stock.store.loadingNoun": "ERPNext snapshot",
  "stock.store.snapshotChanged":
    "Snapshot changed — reloaded. A newer ERPNext snapshot was recorded while paging, so the list was reloaded from its first page.",
  "stock.store.loadMore": "Load more items",

  "stock.items.caption": "Items below zero in ERPNext",
  "stock.items.col.product": "Product",
  "stock.items.col.erpnextItem": "ERPNext Item",
  "stock.items.col.warehouse": "Warehouse",
  "stock.items.col.quantity": "Quantity",
  "stock.items.col.uom": "Stock UOM",
  "stock.items.notMapped": "Not mapped",
  "stock.items.notMappedTitle": "Not mapped to a Retail Tower product",
  "stock.items.empty": "No items below zero in this ERPNext snapshot.",

  "stock.refresh.action": "Request fresh snapshot",
  "stock.refresh.requesting": "Requesting…",
  "stock.refresh.blocked.noMapping": "Map an ERPNext stock warehouse for this store first.",
  "stock.refresh.blocked.pending": "A snapshot request is already pending.",
  "stock.refresh.outcome.notFound": "Not found. A snapshot cannot be requested for this store.",
  "stock.refresh.outcome.keyConflict":
    "That snapshot request conflicted with an earlier one. Try again.",
  "stock.refresh.outcome.error": "The snapshot request could not be sent. Try again.",

  "stock.panel.label": "ERPNext snapshot",
  "stock.panel.asOf": "ERPNext snapshot as of {time}",
  "stock.panel.noSnapshot": "No ERPNext snapshot",
  "stock.panel.warehouse": "ERPNext warehouse",
  "stock.panel.recordedAt": "Recorded by Retail Tower",
  "stock.panel.entryCount": "ERPNext Bins in snapshot",
  "stock.pending.badge": "Snapshot requested, awaiting Connector",
  "stock.pending.requestedAt": "Requested {time}.",
  "stock.pending.overdue":
    "Snapshot requested but not yet reported. The ERPNext Connector may be offline, or the warehouse may hold more than 500 items, which the Connector does not report yet.",
  "stock.pending.overdueWithPrevious":
    "Snapshot requested but not yet reported. The ERPNext Connector may be offline, or the warehouse may hold more than 500 items, which the Connector does not report yet. The previous snapshot is still shown.",

  "stock.desk.label": "Resolving in ERPNext Desk",
  "stock.desk.title": "Resolving a negative quantity in ERPNext Desk",
  "stock.desk.receipt":
    "Post the missing Purchase Receipt, or a Stock Entry (Material Receipt or Material Transfer), for the item and warehouse.",
  "stock.desk.count": "Or record a physical count with a Stock Reconciliation.",
  "stock.desk.noBlindEntry":
    "Do not post a balancing entry blindly; find the missing document first.",
  "stock.desk.note":
    "Retail Tower creates no stock documents. A row clears only when a later ERPNext snapshot shows the item at zero or above.",

  // --- Unknown items review queue (RF-4a) -----------------------------------
  "unknownItems.title": "Unknown items",
  "unknownItems.sub": "POS item references awaiting review in this tenant.",
  "unknownItems.filters.legend": "Queue filters",
  "unknownItems.filters.source": "Source system",
  "unknownItems.filters.sourcePlaceholder": "All sources",
  "unknownItems.filters.sort": "Sort",
  "unknownItems.sort.newest": "Newest first",
  "unknownItems.sort.oldest": "Oldest first",
  "unknownItems.sort.store": "By store",
  "unknownItems.filters.groupBy": "Group by",
  "unknownItems.group.none": "None",
  "unknownItems.group.store": "Store",
  "unknownItems.group.source": "Source system",
  "unknownItems.retry": "Retry",
  "unknownItems.loadingNoun": "unknown items",
  "unknownItems.empty": "No unknown items to review.",
  "unknownItems.caption": "Unknown items",
  "unknownItems.col.identifier": "Identifier",
  "unknownItems.col.type": "Type",
  "unknownItems.col.store": "Store",
  "unknownItems.col.source": "Source system",
  "unknownItems.col.encountered": "Encountered",

  "unknownItems.identifierType.barcode": "Barcode",
  "unknownItems.identifierType.sku": "SKU",
  "unknownItems.identifierType.plu": "PLU",
  "unknownItems.identifierType.supplier_code": "Supplier code",
  "unknownItems.identifierType.external_pos_id": "External POS ID",
  "unknownItems.status.pending": "Pending",
  "unknownItems.status.resolved": "Resolved",
  "unknownItems.status.dismissed": "Dismissed",
  "unknownItems.action.linked": "Linked",
  "unknownItems.action.created": "Created",
  "unknownItems.action.dismissed": "Dismissed",

  "unknownItems.drawer.title": "Unknown item",
  "unknownItems.drawer.loadingNoun": "item",
  "unknownItems.field.identifier": "Identifier",
  "unknownItems.field.identifierType": "Identifier type",
  "unknownItems.field.source": "Source system",
  "unknownItems.field.store": "Store",
  "unknownItems.field.status": "Status",
  "unknownItems.field.resolutionAction": "Resolution action",
  "unknownItems.field.encounteredAt": "Encountered at",
  "unknownItems.field.resolvedAt": "Resolved at",
  "unknownItems.field.resolvedBy": "Resolved by",

  "unknownItems.dismiss.action": "Dismiss",
  "unknownItems.dismiss.resource": "{type} {value}",

  "unknownItems.errors.forbidden":
    "You do not have permission to review unknown items in this scope.",
  "unknownItems.errors.notFound": "This item is not available.",
  "unknownItems.errors.alreadyReconciled":
    "This item has already been resolved. Refresh to see its current state.",

  // RT-724 (RF-4b): queue status filter, create product, reopen, bulk dismiss.
  "unknownItems.filters.status": "Status",
  "unknownItems.emptyStatus": "No items with this status.",
  "unknownItems.create.action": "Create product",
  "unknownItems.create.legend": "New product from this identifier",
  "unknownItems.create.name": "Product name",
  "unknownItems.create.taxCategory": "Tax category",
  "unknownItems.create.taxCategoryHint": "The tax category code the product belongs to.",
  "unknownItems.create.submit": "Create the product",
  "unknownItems.create.nameRequired": "Enter a product name.",
  "unknownItems.create.taxCategoryRequired": "Enter a tax category.",
  "unknownItems.create.success":
    "Product created and the identifier linked to it. The item has left the review queue.",
  "unknownItems.reopen.action": "Reopen",
  "unknownItems.reopen.success": "Item reopened. It is back in the review queue.",
  "unknownItems.select.column": "Select",
  "unknownItems.select.row": "Select {value}",
  "unknownItems.select.page": "Select every item on this page",
  "unknownItems.bulk.selected": {
    zero: "No items selected",
    one: "1 item selected",
    other: "{count} items selected",
  },
  "unknownItems.bulk.action": "Dismiss selected",
  "unknownItems.bulk.clear": "Clear selection",
  "unknownItems.bulk.resource": {
    zero: "no items",
    one: "1 item",
    other: "{count} items",
  },
  "unknownItems.bulk.overLimit":
    "You can dismiss at most {max} items at a time. Narrow the selection, then try again.",
  "unknownItems.bulk.result.dismissed": {
    zero: "No items were dismissed.",
    one: "1 item dismissed.",
    other: "{count} items dismissed.",
  },
  "unknownItems.bulk.result.alreadyReconciled": {
    zero: "No items were already resolved.",
    one: "1 item was already resolved, so it was not dismissed.",
    other: "{count} items were already resolved, so they were not dismissed.",
  },
  "unknownItems.bulk.result.notFound": {
    zero: "No items were unavailable.",
    one: "1 item is no longer available, so it was not dismissed.",
    other: "{count} items are no longer available, so they were not dismissed.",
  },
  "unknownItems.errors.reopenForbidden":
    "Reopening needs tenant-wide authority. Ask a tenant administrator.",
  "unknownItems.errors.reopenResolved":
    "This item has been resolved; only a dismissed item can be reopened. Refresh to see its current state.",
  "unknownItems.errors.createValidation":
    "The product could not be created with these details. Check the name and tax category, then try again.",
  "unknownItems.errors.bulkRejected":
    "The whole request was rejected and nothing was dismissed. Select at most {max} items, then try again.",
  "unknownItems.errors.aliasConflict":
    "This identifier is already linked to another product, so no product was created. Review the catalog before continuing.",
  "unknownItems.errors.targetUnavailable":
    "The target product is no longer available, so nothing changed.",
  "unknownItems.errors.keyConflict":
    "This request conflicted with an earlier attempt, so nothing changed. Refresh, then try again.",
  "unknownItems.errors.rateLimited":
    "Too many requests in a short time, so nothing changed. Wait a moment, then try again.",
  "unknownItems.errors.inProgress":
    "The previous request is still being processed. Wait a moment, then try again.",
};
