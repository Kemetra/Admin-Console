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
};
