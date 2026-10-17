import type { sales as ar } from "../ar/sales";
import type { MessagesOf } from "../types";

export const sales: MessagesOf<typeof ar> = {
  // --- Navigation ------------------------------------------------------------
  "sales.nav.section": "Transactions",
  "sales.nav.label": "Sales",

  // --- List ------------------------------------------------------------------
  "sales.list.title": "Sales",
  "sales.list.sub": "Sales the server has received for one store in {tenant}. Read-only.",
  "sales.list.scopePrompt": "Select a tenant to view sales.",
  "sales.list.queryPrompt": "Choose a store and a business-date range, then search.",
  "sales.list.queryPromptHint":
    "Nothing is read until both are set. A search covers at most 31 business days.",
  "sales.list.caption": "Sales received by the server, newest first",
  "sales.list.loadingNoun": "sales",
  "sales.list.asOf":
    "Received by the server up to {asOf}. Sales still waiting to sync on a terminal are not included.",
  "sales.list.zoneNote": "Times are in {zone}.",
  "sales.list.empty": "No sales received by the server for this store and range up to {asOf}.",
  "sales.list.emptyHint": "Sales waiting on a terminal appear once they sync.",
  "sales.list.partialPage":
    "No matching sales in the part of the range checked so far. Choose Load more to keep searching.",
  "sales.list.ended": "End of the received sales for this range.",
  "sales.list.unavailable": "These sales are not available to you.",
  "sales.list.unavailableHint": "Choose another store or range.",
  "sales.list.filterRejected":
    "The server rejected this search. Check the store, the dates (at most 31 business days) and the filters.",
  "sales.list.loadFailed": "Sales could not be loaded.",
  "sales.list.sessionExpired": "Your session has expired. Sign in again.",
  "sales.list.inlineError":
    "The rest of the rows could not be loaded. The rows shown are from the last successful load.",
  "sales.list.retry": "Retry",
  "sales.list.cursorRejected":
    "The server did not accept the position of the next page. Start the search again from the first page.",
  "sales.list.restart": "Start again",
  "sales.list.loaded": "Loaded: {count}",
  "sales.list.loadMore": "Load more",
  "sales.list.col.saleNumber": "Sale number",
  "sales.list.col.businessDate": "Business date",
  "sales.list.col.occurredAt": "Occurred",
  "sales.list.col.device": "Terminal",
  "sales.list.col.operator": "Cashier",
  "sales.list.col.total": "Total",
  "sales.list.col.status": "Status",

  // --- Recorded values -------------------------------------------------------
  "sales.value.notRecorded": "Not recorded",
  "sales.value.currentName": "{name} (current name)",
  "sales.device.none": "No device recorded",
  "sales.chip.voided": "Voided",

  // --- Filters ---------------------------------------------------------------
  "sales.filter.label": "Search sales",
  "sales.filter.store": "Store",
  "sales.filter.storePlaceholder": "Choose a store",
  "sales.filter.from": "From business date",
  "sales.filter.to": "To business date",
  "sales.filter.zoneNote":
    "Business dates are in the store's time zone ({zone}), both days included, at most 31 days.",
  "sales.filter.zonePending": "Choose a store: business dates are read in its time zone.",
  "sales.filter.saleNumber": "Sale number",
  "sales.filter.saleNumberNote":
    "Exact match. Sales captured before receipt numbers were recorded have no number and never match.",
  "sales.filter.sync": "Sync status",
  "sales.filter.voided": "Void",
  "sales.filter.voidedTrue": "Voided only",
  "sales.filter.voidedFalse": "Not voided",
  "sales.filter.returns": "Returns",
  "sales.filter.erp": "ERPNext posting",
  "sales.filter.any": "Any",
  "sales.filter.apply": "Search",
  "sales.filter.clear": "Clear",
  "sales.filter.storeRequired": "Choose a store.",
  "sales.filter.datesRequired": "Enter both dates.",
  "sales.filter.dateInvalid": "Enter a real date between 2000 and 2100.",
  "sales.filter.rangeReversed": "The end date can't be before the start date.",
  "sales.filter.spanTooWide": "A search covers at most 31 business days. Narrow the range.",
  "sales.filter.saleNumberTooLong": "A sale number has at most 96 characters.",

  // --- Status codes ------------------------------------------------------------
  "sales.sync.captured": "Captured",
  "sales.sync.synced": "Synced",
  "sales.sync.failedRetryable": "Sync retrying",
  "sales.sync.failedNeedsRepair": "Needs repair",
  "sales.sync.unknownCode": "Unknown sync status",
  "sales.returns.none": "No returns",
  "sales.returns.partial": "Partly returned",
  "sales.returns.full": "Fully returned",
  "sales.returns.unknownCode": "Unknown return state",
  "sales.erp.posted": "Posted to ERPNext",
  "sales.erp.pending": "ERPNext posting pending",
  "sales.erp.failed": "ERPNext posting failed",
  "sales.erp.unknown": "ERPNext posting state unknown",
  "sales.tender.cash": "Cash",
  "sales.tender.card_external": "Card (external terminal)",
  "sales.tender.unknownMethod": "Other method",

  // --- Detail ------------------------------------------------------------------
  "sales.detail.back": "Back to sales",
  "sales.detail.title": "Sale {number}",
  "sales.detail.titleNoNumber": "Sale with no sale number",
  "sales.detail.zoneNote": "Times are in {zone}. Business dates were fixed when the sale was made.",
  "sales.detail.loadingNoun": "sale",
  "sales.detail.notFound": "This sale was not found or is not available to you.",
  "sales.detail.loadFailed": "The sale could not be loaded.",
  "sales.detail.retry": "Retry",
  "sales.detail.missing": "Not recorded for this sale.",
  "sales.section.summary": "Sale",
  "sales.section.receiptHeader": "Receipt header",
  "sales.section.lines": "Lines",
  "sales.section.payments": "Payments",
  "sales.section.void": "Void",
  "sales.section.returns": "Returns",
  "sales.section.erp": "ERPNext posting",
  "sales.section.related": "Related screens",
  "sales.field.saleNumber": "Sale number",
  "sales.field.receiptNumber": "Receipt number",
  "sales.field.businessDate": "Business date",
  "sales.field.occurredAt": "Occurred",
  "sales.field.receivedAt": "Received by the server",
  "sales.field.settledAt": "Time on the receipt",
  "sales.field.store": "Store",
  "sales.field.device": "Terminal",
  "sales.field.operator": "Cashier",
  "sales.field.total": "Total",
  "sales.field.branchName": "Name on the receipt",
  "sales.field.branchAddress": "Address on the receipt",
  "sales.field.taxRegistrationId": "Tax registration ID",
  "sales.unknownStore": "Unknown store",

  // --- Lines -------------------------------------------------------------------
  "sales.lines.caption": "Sale lines",
  "sales.lines.empty": "No lines are recorded for this sale.",
  "sales.lines.orderNotRecorded":
    "The original receipt order was not recorded: the lines are in a stable order that is not the receipt order.",
  "sales.lines.col.sequence": "Position",
  "sales.lines.col.name": "Item",
  "sales.lines.col.quantity": "Quantity",
  "sales.lines.col.unit": "Unit",
  "sales.lines.col.unitPrice": "Unit price",
  "sales.lines.col.amount": "Line amount",
  "sales.lines.col.tax": "Tax",
  "sales.lines.col.returned": "Returned quantity",

  // --- Payments ----------------------------------------------------------------
  "sales.payments.unknown": "Payment details were not recorded for this sale.",
  "sales.payments.caption": "Recorded payments",
  "sales.payments.netNote": "Amounts are net of change, as captured.",
  "sales.payments.col.method": "Method",
  "sales.payments.col.amount": "Amount",
  "sales.payments.col.reference": "Reference",
  "sales.payments.changeGiven": "Change given",

  // --- Void --------------------------------------------------------------------
  "sales.void.none": "This sale is not voided.",
  "sales.void.voidedAt": "Voided at",
  "sales.void.businessDate": "Void business date",
  "sales.void.approved": "Manager approval",
  "sales.void.approvedYes": "Yes",
  "sales.void.approvedNo": "No (legacy void)",
  "sales.void.approverRole": "Approver role",
  "sales.void.approverRoleNote":
    "The approver's current role, which may differ from their role at the time of the void.",

  // --- Returns -----------------------------------------------------------------
  "sales.returns.empty": "No returns are recorded.",
  "sales.returns.recordedAt": "Recorded at",
  "sales.returns.businessDate": "Business date",
  "sales.returns.total": "Return total",
  "sales.returns.caption": "Returned lines",
  "sales.returns.col.item": "Item",
  "sales.returns.col.quantity": "Quantity",
  "sales.returns.col.amount": "Amount",
  "sales.returns.unknownLine": "A line not in this sale",

  // --- ERP ---------------------------------------------------------------------
  "sales.erp.sale": "Sale posting",
  "sales.erp.saleDocument": "ERPNext document",
  "sales.erp.reversal": "Void reversal posting",
  "sales.erp.reversalDocument": "ERPNext reversal document",
  "sales.erp.note":
    "An operational posting state as the server reports it. It is not a tax or fiscal statement.",

  // --- Related -----------------------------------------------------------------
  "sales.related.shiftCloses": "Shift-close exceptions (non-zero variance) that day",
};
