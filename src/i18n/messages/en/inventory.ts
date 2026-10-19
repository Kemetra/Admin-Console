import type { inventory as ar } from "../ar/inventory";
import type { MessagesOf } from "../types";

export const inventory: MessagesOf<typeof ar> = {
  // --- Navigation (under the Inventory section) ----------------------------------
  "inventory.nav.label": "Stock movements",

  // --- Shared states ----------------------------------------------------------
  "inventory.title": "Inventory",
  "inventory.scopePrompt": "Choose a tenant from the scope bar to see inventory.",
  "inventory.retry": "Retry",
  "inventory.inlineError": "This section could not be refreshed. Showing the last successful read.",
  "inventory.error.session": "Your session has ended. Sign in again.",
  "inventory.error.forbidden": "This section is not available to your role.",
  "inventory.error.rejected": "The server rejected this request.",
  "inventory.error.rateLimited": "Too many requests in a short time. Wait a moment, then retry.",
  "inventory.error.rateLimitedFor": {
    one: "Too many requests in a short time. Retry in 1 second.",
    other: "Too many requests in a short time. Retry in {count} seconds.",
  },
  "inventory.value.unknown": "Unknown",
  "inventory.value.notRecorded": "Not recorded",
  "inventory.value.none": "—",
  "inventory.note.readOnly": "Read only. No movement, transfer or count is recorded here.",
  "inventory.note.erpBook":
    "Balances here are derived from Retail Tower movements. ERPNext book stock is on Stock discrepancies.",

  // --- Store picker -------------------------------------------------------------
  "inventory.stores.sub": "Choose a store to see its stock locations and movement ledger.",
  "inventory.stores.caption": "Stores available to you",
  "inventory.stores.col.store": "Store",
  "inventory.stores.loadingNoun": "stores",
  "inventory.stores.loadFailed": "Stores could not be loaded.",
  "inventory.stores.empty": "No stores are available to you in this tenant.",

  // --- One store ------------------------------------------------------------------
  "inventory.store.back": "All stores",
  "inventory.store.title": "Store inventory",
  "inventory.store.sub": "This store's stock locations and every stock movement, newest first.",
  "inventory.store.notFound": "This store is not available.",

  "inventory.locations.title": "Stock locations",
  "inventory.locations.caption": "The store's stock locations, primary first",
  "inventory.locations.col.name": "Name",
  "inventory.locations.col.code": "Code",
  "inventory.locations.col.kind": "Kind",
  "inventory.locations.col.active": "Status",
  "inventory.locations.kind.primary": "Primary",
  "inventory.locations.kind.storage": "Storage",
  "inventory.locations.active": "Active",
  "inventory.locations.inactive": "Inactive",
  "inventory.locations.loadingNoun": "stock locations",
  "inventory.locations.loadFailed": "Stock locations could not be loaded.",
  "inventory.locations.empty": "This store has no stock locations.",

  "inventory.movements.title": "Stock movement ledger",
  "inventory.movements.sub":
    "Every movement at the store, for every product and with no product. Open a product to see its on-hand.",
  "inventory.movements.caption": "Stock movements, newest first",
  "inventory.movements.col.occurredAt": "Occurred",
  "inventory.movements.col.type": "Type",
  "inventory.movements.col.product": "Product",
  "inventory.movements.col.quantity": "Quantity",
  "inventory.movements.col.position": "Location and status",
  "inventory.movements.col.reason": "Reason",
  "inventory.movements.col.erp": "ERPNext state",
  "inventory.movements.adhoc": "No product",
  "inventory.movements.openProduct": "Open on-hand for product {ref}",
  "inventory.movements.loadingNoun": "stock movements",
  "inventory.movements.loadFailed": "Stock movements could not be loaded.",
  "inventory.movements.empty": "No stock movements at this store yet.",
  "inventory.movements.loadMore": "Load older movements",

  "inventory.movementType.inbound": "Inbound",
  "inventory.movementType.outbound": "Outbound",
  "inventory.movementType.adjustment": "Adjustment",
  "inventory.movementType.transfer_out": "Transfer out",
  "inventory.movementType.transfer_in": "Transfer in",
  "inventory.movementType.count_correction": "Count correction",

  "inventory.status.sellable": "Sellable",
  "inventory.status.return_inspection": "Return inspection",
  "inventory.status.quality_hold": "Quality hold",
  "inventory.status.damaged": "Damaged",
  "inventory.status.expired": "Expired",
  "inventory.status.recall_hold": "Recall hold",

  "inventory.integration.not_posted": "No posting needed",
  "inventory.integration.pending": "Posting pending",
  "inventory.integration.confirmed": "Confirmed by ERPNext",
  "inventory.integration.rejected": "Rejected by ERPNext",
  "inventory.integration.reconciliation_required": "Needs reconciliation",
  "inventory.integration.external": "From ERPNext",

  // --- One product at one store --------------------------------------------------
  "inventory.product.back": "Store movement ledger",
  "inventory.product.title": "Product on-hand at this store",
  "inventory.product.sub": "Product {ref}",
  "inventory.product.notFound": "This product is not available at this store.",

  "inventory.onHand.title": "Physical on-hand",
  "inventory.onHand.physical": "Physical on-hand",
  "inventory.onHand.sellable": "Sellable",
  "inventory.onHand.byStatus": "On-hand by inventory status",
  "inventory.onHand.col.status": "Status",
  "inventory.onHand.col.quantity": "Quantity",
  "inventory.onHand.negative": "On-hand is below zero. It is recorded and flagged, never refused.",
  "inventory.onHand.note":
    "Computed on read from this product's movements at the store, across every location. Not ERPNext book stock.",
  "inventory.onHand.loadingNoun": "on-hand",
  "inventory.onHand.loadFailed": "On-hand could not be loaded. The balance is unknown.",

  "inventory.tracking.title": "Batches and serials",
  "inventory.tracking.caption": "This product's tracking identities",
  "inventory.tracking.col.kind": "Kind",
  "inventory.tracking.col.code": "Code",
  "inventory.tracking.col.expiry": "Expiry date",
  "inventory.tracking.col.manufactured": "Manufactured on",
  "inventory.tracking.kind.batch": "Batch",
  "inventory.tracking.kind.serial": "Serial",
  "inventory.tracking.loadingNoun": "tracking identities",
  "inventory.tracking.loadFailed": "Tracking identities could not be loaded.",
  "inventory.tracking.empty": "No batches or serials are recorded for this product.",
  "inventory.tracking.loadMore": "Load more",
};
