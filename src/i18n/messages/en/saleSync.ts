import type { saleSync as ar } from "../ar/saleSync";
import type { MessagesOf } from "../types";

export const saleSync: MessagesOf<typeof ar> = {
  // --- Navigation (under the Integration section, owner / tenant_admin) ----------
  "saleSync.nav.label": "Sales needing repair",

  // --- Shared states ----------------------------------------------------------
  "saleSync.retry": "Retry",
  "saleSync.inlineError": "This section could not be refreshed. Showing the last successful read.",
  "saleSync.error.session": "Your session has ended. Sign in again.",
  "saleSync.error.forbidden": "This section is not available to your role.",
  "saleSync.error.rejected": "The server rejected this request.",
  "saleSync.error.rateLimited": "Too many requests in a short time. Wait a moment, then retry.",
  "saleSync.error.rateLimitedFor": {
    one: "Too many requests in a short time. Retry in 1 second.",
    other: "Too many requests in a short time. Retry in {count} seconds.",
  },
  "saleSync.value.notRecorded": "Not recorded",

  // --- Sync status section (sale detail) ------------------------------------------
  "saleSync.section.status": "Sale sync with the server",
  "saleSync.status.loadingNoun": "sync status",
  "saleSync.status.loadFailed": "The sync status could not be loaded.",
  "saleSync.status.notFound": "The sync status of this sale is not available to you.",
  "saleSync.status.captured": "Captured, not processed yet",
  "saleSync.status.synced": "Synced",
  "saleSync.status.failedRetryable": "Sync retrying",
  "saleSync.status.failedNeedsRepair": "Needs repair",
  "saleSync.status.unknown": "Unknown sync status",
  "saleSync.meaning.captured":
    "The server received the sale and has not processed it yet. This says nothing about ERPNext posting.",
  "saleSync.meaning.synced":
    "The server processed the sale. This does not mean it is posted to ERPNext; the posting state has its own section.",
  "saleSync.meaning.failedRetryable":
    "Processing failed and the server will retry it on its own. No action is needed now.",
  "saleSync.meaning.failedNeedsRepair":
    "Processing stopped and the server will not retry it automatically. You can ask the server to repair it.",
  "saleSync.meaning.unknown":
    "The server sent a status this version does not know. It means neither posted nor not posted.",
  "saleSync.field.status": "Sync status",
  "saleSync.field.source": "Source system",
  "saleSync.field.externalId": "Source reference",
  "saleSync.field.processedAt": "Processed",
  "saleSync.processedAt.none": "Not processed yet",

  // --- Dead letter ----------------------------------------------------------------
  "saleSync.deadLetter.title": "Quarantined sync item",
  "saleSync.deadLetter.none":
    "This sale has no open quarantined sync item. That does not mean it is posted to ERPNext.",
  "saleSync.deadLetter.retryable": "Retryable",
  "saleSync.deadLetter.needsRepair": "Needs repair",
  "saleSync.deadLetter.unknown": "Unknown classification",
  "saleSync.field.classification": "Classification",
  "saleSync.field.reasonCode": "Reason code",
  "saleSync.field.retryCount": "Attempts",
  "saleSync.field.quarantinedAt": "Quarantined",
  "saleSync.field.resolvedAt": "Resolved",
  "saleSync.deadLetter.open": "Open",

  // --- Repair (the one write) ----------------------------------------------------------
  "saleSync.repair.title": "Request a sync repair",
  "saleSync.repair.explain":
    "The server puts this sale back in the sync queue. It does not change the sale, does not post it to ERPNext directly, and is never repeated automatically.",
  "saleSync.repair.action": "Request repair",
  "saleSync.repair.confirmLabel": "Confirm the repair request",
  "saleSync.repair.confirmPrompt": "Ask the server to repair the sync of sale {ref}?",
  "saleSync.repair.confirm": "Confirm repair",
  "saleSync.repair.sending": "Sending the repair request…",
  "saleSync.repair.success":
    "The server accepted the repair. Sync status is now: {status}. This step does not post the sale to ERPNext.",
  "saleSync.repair.error.conflict":
    "The sale is not in a repairable state now, and nothing changed. The sync status above has been refreshed.",
  "saleSync.repair.error.keyConflict":
    "The server refused the request because it does not match an earlier request with the same key. Nothing changed; you can request the repair again.",
  "saleSync.repair.error.notFound":
    "This sale was not found or is not available to you. Nothing changed.",
  "saleSync.repair.error.forbidden": "Your role cannot request a repair. Nothing changed.",
  "saleSync.repair.error.originRejected":
    "The server refused where this request came from, and nothing changed. Report it to support with the request ID.",
  "saleSync.repair.error.rejected": "The server rejected the request. Nothing changed.",
  "saleSync.repair.error.rateLimited":
    "Too many requests in a short time. The repair was not applied.",
  "saleSync.repair.error.rateLimitedFor": {
    one: "Too many requests in a short time. The repair was not applied; you can ask again in 1 second.",
    other:
      "Too many requests in a short time. The repair was not applied; you can ask again in {count} seconds.",
  },
  "saleSync.repair.error.unconfirmed":
    "The server did not confirm the result and may have acted. Check the sync status before asking again; the next request reuses the same key, so the repair is never applied twice.",

  // --- Sync timeline (sale detail) --------------------------------------------------
  "saleSync.section.timeline": "Sync timeline",
  "saleSync.timeline.sub":
    "This sale's sync events as the server recorded them, oldest first, with sensitive data removed.",
  "saleSync.timeline.caption": "Sale sync events, oldest first",
  "saleSync.timeline.loadingNoun": "sync timeline",
  "saleSync.timeline.loadFailed": "The sync timeline could not be loaded.",
  "saleSync.timeline.notFound": "The sync timeline of this sale is not available to you.",
  "saleSync.timeline.empty": "No sync events are recorded for this sale.",
  "saleSync.timeline.col.at": "Time",
  "saleSync.timeline.col.event": "Event",
  "saleSync.timeline.col.correlation": "Correlation ID",
  "saleSync.event.saleCaptured": "Server received the sale",
  "saleSync.event.syncSynced": "Server processed the sale",
  "saleSync.event.syncRetryable": "Sync quarantined, will be retried",
  "saleSync.event.syncNeedsRepair": "Sync quarantined, needs repair",
  "saleSync.event.syncFailed": "Sync failed",
  "saleSync.event.repairRequested": "Sync repair requested",
  "saleSync.event.repairResolved": "Quarantined item closed by a repair",
  "saleSync.event.unknown": "Unknown event",

  // --- NEEDS_REPAIR list --------------------------------------------------------------
  "saleSync.list.title": "Sales needing repair",
  "saleSync.list.sub":
    "Sales in {tenant} whose sync the server stopped and will not retry on its own, newest first. A repair is requested from each sale's page.",
  "saleSync.list.note":
    "A sale listed here is not an ERPNext posting failure, and a sale missing from the list is not proof it was posted.",
  "saleSync.list.scopePrompt": "Select a tenant to view sales needing repair.",
  "saleSync.list.refresh": "Refresh",
  "saleSync.list.loadMore": "Load more",
  "saleSync.list.asOf": "Last read: {time}",
  "saleSync.list.caption": "Sales needing repair, newest first",
  "saleSync.list.loadingNoun": "sales needing repair",
  "saleSync.list.loadFailed": "Sales needing repair could not be loaded.",
  "saleSync.list.empty": "No open sales need repair.",
  "saleSync.list.emptyStore": "No open sales need repair in this store.",
  "saleSync.list.emptyHint": "An empty list does not mean every sale is posted to ERPNext.",
  "saleSync.list.storeNotFound": "This store is not available to you.",
  "saleSync.list.unknownStore": "Unknown store",
  "saleSync.list.openSale": "Open sale {ref}",
  "saleSync.filter.store": "Store",
  "saleSync.filter.allStores": "All stores",
  "saleSync.col.externalId": "Source reference",
  "saleSync.col.store": "Store",
  "saleSync.col.source": "Source system",
  "saleSync.col.reason": "Reason code",
  "saleSync.col.retries": "Attempts",
  "saleSync.col.quarantinedAt": "Quarantined",
};
