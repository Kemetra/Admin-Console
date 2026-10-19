import type { productRecon as ar } from "../ar/productRecon";
import type { MessagesOf } from "../types";

export const productRecon: MessagesOf<typeof ar> = {
  // --- Navigation (in the Integration section, beside the ERP connection) ---------
  "productRecon.nav.label": "Product reconciliation",

  // --- Page ---------------------------------------------------------------------------
  "productRecon.title": "ERPNext product reconciliation",
  "productRecon.sub":
    "Products in {tenant} without a confirmed ERPNext item mapping, and the reconciliation run history.",
  "productRecon.scopePrompt": "Select a tenant to view product reconciliation.",
  "productRecon.refresh": "Refresh",
  "productRecon.retry": "Retry",
  "productRecon.loadMore": "Load more",
  "productRecon.stale": "Couldn't refresh. Showing the last successful read.",
  "productRecon.unknown": "Unknown",
  "productRecon.none": "—",
  "productRecon.retryIn": {
    one: "Try again in {count}s.",
    other: "Try again in {count}s.",
  },

  // --- Read errors -----------------------------------------------------------------------
  "productRecon.error.session": "Your session has ended. Sign in again.",
  "productRecon.error.forbidden": "This section isn't available to your role.",
  "productRecon.error.notFound": "This section isn't available to you.",
  "productRecon.error.rejected":
    "The server rejected this request. Check the filter and try again.",
  "productRecon.error.rateLimited": "Too many requests.",

  // --- Class filter and classes ------------------------------------------------------------
  "productRecon.filter.class": "Class",
  "productRecon.filter.all": "All classes",
  "productRecon.class.match": "Match",
  "productRecon.class.unmapped_dp2_product": "Product not mapped",
  "productRecon.class.suggestion_unconfirmed": "Suggestion not confirmed",
  "productRecon.class.unmapped_erpnext_item": "ERPNext item not mapped",
  "productRecon.class.attribute_drift": "Attribute drift",
  "productRecon.class.sellable_state_divergence": "Sellable state differs",

  // --- Backlog -------------------------------------------------------------------------------
  "productRecon.backlog.title": "Products without a confirmed mapping",
  "productRecon.backlog.sub":
    "A live read of active products that lack a confirmed, active ERPNext item mapping.",
  "productRecon.backlog.caption": "Active products lacking a confirmed ERPNext item mapping",
  "productRecon.backlog.loadingNoun": "unmapped products",
  "productRecon.backlog.loadFailed": "Couldn't load the unmapped products.",
  "productRecon.backlog.empty": "Every active product has a confirmed ERPNext item mapping.",
  "productRecon.backlog.col.product": "Product ID",
  "productRecon.backlog.col.class": "Class",
  "productRecon.backlog.col.suggestion": "Suggested item",
  "productRecon.backlog.col.observedAt": "Observed",
  "productRecon.backlog.col.action": "Action",
  "productRecon.backlog.suggestedAt": "Suggested {time}",

  // --- Runs ------------------------------------------------------------------------------------
  "productRecon.runs.title": "Reconciliation runs",
  "productRecon.runs.sub":
    "Each run compares the confirmed mappings with the ERPNext items the Connector reports, without changing any mapping or product. Newest first.",
  "productRecon.runs.caption": "ERPNext product reconciliation runs",
  "productRecon.runs.loadingNoun": "reconciliation runs",
  "productRecon.runs.loadFailed": "Couldn't load the reconciliation runs.",
  "productRecon.runs.empty": "No reconciliation run yet.",
  "productRecon.runs.col.startedAt": "Started",
  "productRecon.runs.col.trigger": "Trigger",
  "productRecon.runs.col.status": "Status",
  "productRecon.runs.col.view": "ERPNext data",
  "productRecon.runs.col.finishedAt": "Finished",
  "productRecon.runs.col.summary": "Counts by class",
  "productRecon.runs.col.results": "Results",
  "productRecon.runs.notFinished": "Not finished",
  "productRecon.runs.noSummary": "No summary",
  "productRecon.runs.viewResults": "View results",
  "productRecon.runs.status.running": "Running",
  "productRecon.runs.status.completed": "Completed",
  "productRecon.runs.status.failed": "Failed",
  "productRecon.runs.view.available": "Available",
  "productRecon.runs.view.partial": "Partial",
  "productRecon.runs.view.unavailable": "Unavailable",
  "productRecon.runs.trigger.on_demand": "On demand",
  "productRecon.runs.trigger.scheduled": "Scheduled",

  // --- Start a run -------------------------------------------------------------------------------
  "productRecon.trigger.start": "Start a reconciliation run",
  "productRecon.trigger.confirmLabel": "Confirm starting a reconciliation run",
  "productRecon.trigger.confirmPrompt":
    "A new reconciliation run starts for the whole tenant. The run changes no mapping or product. Continue?",
  "productRecon.trigger.confirm": "Start run",
  "productRecon.trigger.started": "Run started. Status: {status}. ERPNext data: {view}.",

  // --- Run results ---------------------------------------------------------------------------------
  "productRecon.results.heading": "Reconciliation run results",
  "productRecon.results.title": "Classified results",
  "productRecon.results.sub": "Run {run}.",
  "productRecon.results.caption": "Classified results of a product reconciliation run",
  "productRecon.results.loadingNoun": "results",
  "productRecon.results.loadFailed": "Couldn't load the run's results.",
  "productRecon.results.notFound": "This run isn't available to you.",
  "productRecon.results.empty": "No results in this class.",
  "productRecon.results.back": "Reconciliation runs",
  "productRecon.results.col.class": "Class",
  "productRecon.results.col.product": "Product ID",
  "productRecon.results.col.erpnext": "ERPNext item ref",
  "productRecon.results.col.state": "Result state",
  "productRecon.results.col.detail": "Detail as received",
  "productRecon.results.col.action": "Action",
  "productRecon.results.state.open": "Open",
  "productRecon.results.state.repaired": "Repaired",
  "productRecon.results.state.accepted": "Accepted",

  // --- Repair (suggest_confirm) ---------------------------------------------------------------------
  "productRecon.repair.open": "Map to item",
  "productRecon.repair.label": "Map a product to an ERPNext item",
  "productRecon.repair.title": "Map the product to an ERPNext item",
  "productRecon.repair.product": "Product {product}.",
  "productRecon.repair.ref": "ERPNext item reference",
  "productRecon.repair.refHint":
    "Type the item reference exactly as it is in ERPNext (up to 180 characters).",
  "productRecon.repair.refInvalid": "Enter an item reference of 1 to 180 characters.",
  "productRecon.repair.review": "Review",
  "productRecon.repair.confirmLabel": "Confirm the product mapping",
  "productRecon.repair.confirmPrompt":
    "Product {product} will be mapped to ERPNext item {ref} and the mapping confirmed. Continue?",
  "productRecon.repair.confirm": "Map and confirm",
  "productRecon.repair.back": "Edit",
  "productRecon.repair.close": "Close",
  "productRecon.repair.needsVersion": "Confirm this suggestion from the item mappings screen.",
  "productRecon.repair.recordedTitle": "Repair recorded",
  "productRecon.repair.outcome.mapped": "The mapping is now confirmed and active.",
  "productRecon.repair.outcome.no_op_echo":
    "The product already had a confirmed, active mapping. Nothing changed.",
  "productRecon.repair.outcome.still_unmapped": "The product is still unmapped.",
  "productRecon.repair.outcome.conflict":
    "The mapping changed at the same time. The product still has no confirmed mapping.",
  "productRecon.repair.outcome.unknown":
    "The server recorded an outcome this version doesn't know.",

  // --- Refused mutations (never retried automatically) -----------------------------------------------
  "productRecon.refusal.rejected": "The server rejected the request as invalid. Nothing changed.",
  "productRecon.refusal.session": "Your session has ended. Sign in again. Nothing changed.",
  "productRecon.refusal.origin":
    "The server rejected the request because it didn't come from this console. Nothing changed.",
  "productRecon.refusal.notFound": "The product or result isn't available to you. Nothing changed.",
  "productRecon.refusal.conflict":
    "Conflict: the mapping changed at the same time, or the request was reused. Refresh and check the state.",
  "productRecon.refusal.rateLimited": "Too many requests. The request wasn't carried out.",
  "productRecon.refusal.error":
    "Couldn't complete the request. The outcome is unknown: refresh before trying again.",
};
