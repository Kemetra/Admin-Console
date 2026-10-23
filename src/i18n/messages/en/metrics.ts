import type { metrics as ar } from "../ar/metrics";
import type { MessagesOf } from "../types";

/** English copy for the shared KPI claim and the console metric registry (RT-819). */
export const metrics: MessagesOf<typeof ar> = {
  // --- Figures (registry) ------------------------------------------------------
  "metrics.receivedSales.label": "Received sales",
  "metrics.receivedSales.definition":
    "The sales the server has received: their count, and their total in each currency on its own, by the store's local business day at capture. Currencies are never added together.",
  "metrics.receivedSales.unknown":
    "A zero here is a real zero over what was received. A figure that could not be determined shows as Unknown, never as 0.",
  "metrics.voids.label": "Voids",
  "metrics.voids.definition":
    "Received voids: count and total per currency, by the void's own recorded business day, not the sale's.",
  "metrics.voids.unknown":
    "A zero here is a real zero over what was received. A figure that could not be determined shows as Unknown.",
  "metrics.returns.label": "Returns",
  "metrics.returns.definition":
    "Received returns: count and total per currency, by the return's own recorded business day.",
  "metrics.returns.unknown":
    "A zero here is a real zero over what was received. A figure that could not be determined shows as Unknown.",
  "metrics.legacyRefunds.label": "Legacy refunds",
  "metrics.legacyRefunds.definition":
    "Refunds recorded the legacy way: count and total per currency, by their server time in the store's current time zone.",
  "metrics.legacyRefunds.unknown":
    "A zero here is a real zero over what was received. A figure that could not be determined shows as Unknown.",
  "metrics.syncStatus.label": "Sale sync status",
  "metrics.syncStatus.definition":
    "The period's received sales by their processing state on the server now (as of the read). Synced does not mean posted to ERPNext.",
  "metrics.syncStatus.unknown":
    "The four states add up to the received sales count. This is the state now, not a backlog over days.",
  "metrics.erpPosting.label": "ERP posting state",
  "metrics.erpPosting.definition":
    "The period's received sales by their ERPNext posting state now (as of the read). An operational state only, never a tax claim.",
  "metrics.erpPosting.unknown":
    "Unknown means the sale has no posting record yet. Unknown never means not posted.",
  "metrics.shiftCloses.label": "Shift closes",
  "metrics.shiftCloses.definition":
    "Recorded shift closes by the local date of the close (POS clock) in the store's current time zone. No cash amount is added up here.",
  "metrics.shiftCloses.unknown":
    "Approval missing, unknown means the shift froze no policy. It never means no exception.",

  "metrics.zoneRule.fixedAtCapture":
    "The sale's stored business day, cut in the store's zone at capture and never recomputed.",
  "metrics.zoneRule.fixedAtRecord": "The record's own stored business day, fixed when recorded.",
  "metrics.zoneRule.storeCurrentZone":
    "Cut in the store's current time zone, so a zone change moves it between days.",

  // --- Claim states ------------------------------------------------------------
  "metrics.claim.loading": "Loading…",
  "metrics.claim.failed": "Couldn't load this figure.",
  "metrics.claim.reference": "Reference: {id}",
  "metrics.claim.retry": "Retry",
  "metrics.claim.unknown": "Unknown",
  "metrics.claim.unknownNote":
    "This figure could not be determined for the period; it is not zero.",
  "metrics.claim.noAmount": "No amount in this period",
  "metrics.claim.about": "About {label}",
  "metrics.claim.part": "{label}: {count}",
  "metrics.claim.source": "Source: {source}",

  "metrics.part.captured": "Captured",
  "metrics.part.synced": "Synced",
  "metrics.part.failedRetryable": "Failed, retrying",
  "metrics.part.failedNeedsRepair": "Failed, needs repair",
  "metrics.part.posted": "Posted",
  "metrics.part.pending": "Pending",
  "metrics.part.failed": "Failed",
  "metrics.part.unknown": "Unknown",
  "metrics.part.normal": "Normal",
  "metrics.part.forced": "Forced",
  "metrics.part.withVariance": "With variance",
  "metrics.part.approvalMissing.yes": "Approval missing, yes",
  "metrics.part.approvalMissing.no": "Approval missing, no",
  "metrics.part.approvalMissing.unknown": "Approval missing, unknown",

  // --- Context line ------------------------------------------------------------
  "metrics.context.store": "Store: {store}",
  "metrics.context.allInScope": {
    one: "All {count} store in scope, by each store's local business day",
    other: "All {count} stores in scope, by each store's local business day",
  },
  "metrics.context.day": "Business day {date}",
  "metrics.context.range": "Business days {from} to {to}",
  "metrics.context.soFar": "(so far)",
  "metrics.context.zone": "Time zone: {zone}",
  "metrics.context.zones": "Time zones: {zones}",
  "metrics.context.asOf": "As of {asOf}",
  "metrics.context.completeness":
    "Received facts only: anything still queued on a terminal is not counted, so these figures are never complete.",
};
