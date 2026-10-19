import type { erp as ar } from "../ar/erp";
import type { MessagesOf } from "../types";

export const erp: MessagesOf<typeof ar> = {
  // --- Navigation (RT-557 OD-2: its own role-gated section) ---------------------
  "erp.nav.section": "Integration",
  "erp.nav.label": "Connection & sync",

  // --- Page ---------------------------------------------------------------------
  "erp.title": "ERP connection & sync",
  "erp.sub": "ERPNext Connector, posting and reconciliation status in {tenant}. Read-only.",
  "erp.scopePrompt": "Select a tenant to view the ERP connection status.",
  "erp.refresh": "Refresh",
  "erp.retry": "Retry",
  "erp.loadMore": "Load more",
  "erp.asOf": "Last read: {time}",
  "erp.inlineError": "Couldn't refresh this section. Showing the last successful read.",
  "erp.error.session": "Your session has ended. Sign in again.",
  "erp.error.forbidden": "This section isn't available to your role.",
  "erp.error.rejected": "The server rejected this request. Check the filter and try again.",
  "erp.error.notFound": "This store isn't available to you.",

  // --- Store filter ---------------------------------------------------------------
  "erp.filter.store": "Store",
  "erp.filter.allStores": "All stores",
  "erp.filter.note":
    "The store filter applies to the sync summary, rejected postings and reconciliation history. The connector connection is tenant-wide.",

  // --- Connection panel (C1 joined with C2) ---------------------------------------
  "erp.conn.title": "Connector connection",
  "erp.conn.caption": "ERPNext Connector instances registered to this tenant",
  "erp.conn.loadingNoun": "connector instances",
  "erp.conn.empty": "No ERPNext Connector is registered for this tenant.",
  "erp.conn.emptyHint":
    "Registering a connector and issuing its credentials is a platform-team step for now.",
  "erp.conn.loadFailed": "Couldn't load the connector instances.",
  "erp.conn.healthFailed":
    "Couldn't read the connection status, so every instance shows no signal.",
  "erp.conn.noSignalNote":
    "“No signal” means the connector hasn't sent a heartbeat yet. It is neither healthy nor an error.",
  "erp.conn.col.instance": "Instance",
  "erp.conn.col.environment": "Environment",
  "erp.conn.col.site": "ERPNext site",
  "erp.conn.col.signal": "Connection",
  "erp.conn.col.lastSeen": "Last seen",
  "erp.conn.col.version": "Version (reported by the connector)",
  "erp.conn.col.reachable": "ERPNext reachable (reported by the connector)",
  "erp.conn.col.credential": "Credential expires",
  "erp.conn.never": "Never",
  "erp.conn.unknown": "Unknown",
  "erp.conn.since": "{duration} ago",
  "erp.conn.reportedAt": "Reported {time}",
  "erp.conn.noCredential": "No active credential",
  "erp.conn.registrationDisabled": "Registration disabled",
  "erp.reported.reachable": "Reachable",
  "erp.reported.unreachable": "Not reachable",
  "erp.reported.notReported": "Not reported",
  "erp.env.dev": "Development",
  "erp.env.staging": "Staging",
  "erp.env.pilot": "Pilot",
  "erp.env.prod": "Production",
  "erp.env.unknown": "Unknown environment",
  "erp.signal.healthy": "Connected",
  "erp.signal.stale": "Delayed",
  "erp.signal.noSignal": "No signal",
  "erp.signal.disabled": "Disabled",

  // --- Sync summary (C3) -------------------------------------------------------------
  "erp.summary.title": "Sync summary",
  "erp.summary.note": "Each domain shows its own status; there is no single combined status.",
  "erp.summary.loadingNoun": "sync summary",
  "erp.summary.loadFailed": "Couldn't load the sync summary.",
  "erp.summary.empty": "The server returned no domains in the summary.",
  "erp.summary.count": "Count: {count}",
  "erp.domain.posting": "ERPNext posting",
  "erp.domain.reconciliation": "Reconciliation",
  "erp.domain.connector_health": "Connector health",
  "erp.domain.product_master": "Product master",
  "erp.domain.unknown": "Unknown domain",
  "erp.domainStatus.ok": "Nothing needs attention",
  "erp.domainStatus.attention": "Needs attention",
  "erp.domainStatus.notAvailable": "Not available yet",
  "erp.domainStatus.unknown": "Unknown status",

  // --- Posting backlog (C3) -------------------------------------------------------------
  "erp.backlog.title": "Permanently rejected postings",
  "erp.backlog.sub":
    "Postings to ERPNext that were rejected and won't be resent automatically. Read-only.",
  "erp.backlog.reasonNote":
    "The detailed rejection reason isn't available yet; only the rejection class is shown.",
  "erp.backlog.caption": "Permanently rejected postings, newest first",
  "erp.backlog.loadingNoun": "rejected postings",
  "erp.backlog.empty": "No permanently rejected postings.",
  "erp.backlog.loadFailed": "Couldn't load the rejected postings.",
  "erp.backlog.col.kind": "Kind",
  "erp.backlog.col.externalId": "POS reference",
  "erp.backlog.col.source": "Source",
  "erp.backlog.col.rejectionClass": "Rejection class",
  "erp.backlog.col.deadLetteredAt": "Rejected at",
  "erp.backlog.kind.sale_post": "Sale posting",
  "erp.backlog.kind.reversal": "Reversal",
  "erp.backlog.kind.unknown": "Unknown kind",
  "erp.backlog.notRecorded": "Not recorded",

  // --- Reconciliation runs (C3) ------------------------------------------------------------
  "erp.runs.title": "Reconciliation history",
  "erp.runs.sub":
    "Stock reconciliation runs with ERPNext, newest first. Mismatch detail is in {link}.",
  "erp.runs.caption": "Stock reconciliation runs, newest first",
  "erp.runs.loadingNoun": "reconciliation runs",
  "erp.runs.empty": "No reconciliation runs recorded.",
  "erp.runs.loadFailed": "Couldn't load the reconciliation history.",
  "erp.runs.col.store": "Store",
  "erp.runs.col.trigger": "Started by",
  "erp.runs.col.status": "Status",
  "erp.runs.col.startedAt": "Started",
  "erp.runs.col.finishedAt": "Finished",
  "erp.runs.col.mismatches": "Mismatches by class",
  "erp.runs.trigger.on_demand": "On demand",
  "erp.runs.trigger.scheduled": "Schedule",
  "erp.runs.trigger.unknown": "Unknown",
  "erp.runs.status.running": "Running",
  "erp.runs.status.completed": "Completed",
  "erp.runs.status.failed": "Failed",
  "erp.runs.status.unknown": "Unknown status",
  "erp.runs.notFinished": "Not finished",
  "erp.runs.noMismatches": "None recorded",
  "erp.runs.mismatch": "{kind}: {count}",
  "erp.runs.unknownStore": "Unknown store",

  // --- ERPNext item & warehouse mappings (RT-725) ------------------------------
  "erp.map.link": "Item & warehouse mappings",
  "erp.map.title": "ERPNext mappings: items & warehouses",
  "erp.map.sub":
    "Map {tenant}'s products and stores to ERPNext references. Only a confirmed mapping is used for posting.",
  "erp.map.back": "Back to connection & sync",
  "erp.map.scopePrompt": "Select a tenant to view its ERPNext mappings.",
  "erp.map.review": "Review",
  "erp.map.notYet": "Not confirmed yet",
  "erp.map.col.actions": "Actions",
  "erp.map.form.required": "Enter the ERPNext reference.",
  "erp.map.form.storeRequired": "Choose a store.",

  "erp.map.error.validation": "The server rejected these values. Check them and try again.",
  "erp.map.error.readRejected":
    "The server rejected this request. Change the filter and try again.",
  "erp.map.error.session": "Your session has ended. Sign in again.",
  "erp.map.error.unavailable": "This section isn't available to your role.",
  "erp.map.error.origin":
    "The server refused a change from this page. Reload the console and try again.",
  "erp.map.error.productNotFound":
    "This product isn't available to you. No suggestion was recorded.",
  "erp.map.error.mappingNotFound":
    "This mapping no longer exists or isn't available to you. The list was refreshed.",
  "erp.map.error.storeNotFound": "This store isn't available to you. No mapping was set.",
  "erp.map.error.suggestConflict":
    "This product already has an active mapping. The list was refreshed.",
  "erp.map.error.confirmConflict":
    "This mapping changed since you loaded it, or can no longer be confirmed. The list was refreshed; check it and try again.",
  "erp.map.error.retireConflict":
    "This mapping changed since you loaded it, or was already retired. The list was refreshed; check it and try again.",
  "erp.map.error.setConflict":
    "This store already has an active warehouse mapping. The list was refreshed.",
  "erp.map.error.rateLimited": "Too many requests. Wait a moment, then try again.",
  "erp.map.error.rateLimitedWait": "Too many requests. Wait {seconds} seconds, then try again.",
  "erp.map.error.unknownTitle": "Unknown result",
  "erp.map.error.unknownOutcome":
    "No clear answer came back, so the change may or may not have been applied. The list was refreshed: check it before trying again.",
  "erp.map.error.failed": "Couldn't load the mappings. Try again.",

  "erp.map.state.suggested": "Suggested — not used for posting",
  "erp.map.state.confirmed": "Confirmed",
  "erp.map.state.unknown": "Unknown",
  "erp.map.source.barcode": "Barcode",
  "erp.map.source.itemCode": "Item code",
  "erp.map.source.manual": "Manual",
  "erp.map.purpose.stock": "Stock",
  "erp.map.purpose.returns": "Returns",

  "erp.map.items.title": "Item mappings",
  "erp.map.items.note":
    "Each product maps to one ERPNext Item. A suggested mapping isn't used for posting until it's confirmed.",
  "erp.map.items.loading": "item mappings",
  "erp.map.items.empty": "No active item mappings.",
  "erp.map.items.emptySuggested": "No suggestions waiting for review.",
  "erp.map.items.emptyConfirmed": "No confirmed item mappings.",
  "erp.map.items.filter": "State",
  "erp.map.items.filter.all": "All active mappings",
  "erp.map.items.filter.suggested": "Waiting for review",
  "erp.map.items.filter.confirmed": "Confirmed",
  "erp.map.items.col.product": "Product ID",
  "erp.map.items.col.item": "ERPNext Item",
  "erp.map.items.col.state": "State",
  "erp.map.items.col.source": "Source",
  "erp.map.items.col.suggestedAt": "Suggested",
  "erp.map.items.col.confirmedAt": "Confirmed",
  "erp.map.items.confirm.label": "Confirm item mapping",
  "erp.map.items.confirm.prompt":
    "Confirm mapping product {product} to ERPNext Item {item}? Posting will use this mapping.",
  "erp.map.items.confirm.action": "Confirm",
  "erp.map.items.retire.label": "Retire item mapping",
  "erp.map.items.retire.prompt":
    "Retire the mapping of product {product} to ERPNext Item {item}? It stays in the history and is no longer used.",
  "erp.map.items.retire.action": "Retire",
  "erp.map.items.suggest.label": "Suggest a replacement item",
  "erp.map.items.suggest.lead":
    "The mapping of product {product} was retired. You can suggest a new ERPNext Item for it.",
  "erp.map.items.suggest.ref": "ERPNext Item reference",
  "erp.map.items.suggest.note":
    "The suggestion is recorded unconfirmed and isn't used for posting until it's confirmed.",
  "erp.map.items.suggest.prompt": "Suggest mapping product {product} to ERPNext Item {item}?",
  "erp.map.items.suggest.action": "Record suggestion",
  "erp.map.items.suggest.dismiss": "Not now",
  "erp.map.items.notice.confirmed": "Mapping confirmed.",
  "erp.map.items.notice.retired": "Mapping retired.",
  "erp.map.items.notice.suggested":
    "Suggestion recorded. It isn't used for posting until it's confirmed.",

  "erp.map.wh.title": "Warehouse mappings",
  "erp.map.wh.note": "Each store maps to one ERPNext Warehouse for stock.",
  "erp.map.wh.loading": "warehouse mappings",
  "erp.map.wh.empty": "No active warehouse mappings.",
  "erp.map.wh.col.store": "Store",
  "erp.map.wh.col.purpose": "Purpose",
  "erp.map.wh.col.warehouse": "ERPNext Warehouse",
  "erp.map.wh.col.setAt": "Set",
  "erp.map.wh.set.label": "Set a warehouse mapping",
  "erp.map.wh.set.store": "Store",
  "erp.map.wh.set.pickStore": "Choose a store",
  "erp.map.wh.set.ref": "ERPNext Warehouse reference",
  "erp.map.wh.set.prompt": "Map store {store} to ERPNext Warehouse {warehouse}?",
  "erp.map.wh.set.action": "Set mapping",
  "erp.map.wh.set.storesFailed":
    "Couldn't load the store list, so no mapping can be set right now.",
  "erp.map.wh.set.allMapped":
    "Every store of yours has an active warehouse mapping. To change one, retire it, then set a new one.",
  "erp.map.wh.retire.label": "Retire warehouse mapping",
  "erp.map.wh.retire.prompt":
    "Retire the mapping of store {store} to ERPNext Warehouse {warehouse}? It stays in the history and is no longer used.",
  "erp.map.wh.retire.action": "Retire",
  "erp.map.wh.notice.set": "Warehouse mapping set.",
  "erp.map.wh.notice.retired": "Warehouse mapping retired.",
};
