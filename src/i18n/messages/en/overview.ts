import type { overview as ar } from "../ar/overview";
import type { MessagesOf } from "../types";

/** English copy for the Overview landing (RT-559, spec 009). */
export const overview: MessagesOf<typeof ar> = {
  "overview.refresh": "Refresh",
  "overview.refreshing": "Refreshing…",

  // --- Attention ledger (P-1…P-4) --------------------------------------------
  "overview.attention.title": "Needs your attention",
  "overview.attention.nothingForRole": "No attention items are available to your role here.",
  "overview.count.exact": "{noun}: {count}",
  "overview.count.atLeast": "{noun}: {count} or more",
  "overview.count.none": "None",
  "overview.count.unproven": "The list has more to check",
  "overview.row.loading": "Loading…",
  "overview.row.failed": "Couldn't load.",
  "overview.row.retry": "Retry",

  "overview.stock.label": "Stock discrepancies · {store}",
  "overview.stock.noun": "Negative items",
  "overview.stock.asOf": "as of {asOf}",
  "overview.stock.open": "View store discrepancies",
  "overview.stock.none": "No stores to show discrepancies for.",
  "overview.stock.labelAll": "Stock discrepancies",
  "overview.stock.more": "Some stores aren't shown here. Open stock discrepancies to see them all.",
  "overview.stock.openAll": "View the full list",

  "overview.shift.label": "Shift-close variances with no recorded approver (last 7 days)",
  "overview.shift.noun": "Closes",
  "overview.shift.open": "Review closes",

  "overview.unknown.label": "Unknown items pending review",
  "overview.unknown.noun": "Items",
  "overview.unknown.open": "Review items",

  "overview.receivables.label": "Receivables needing review",
  "overview.receivables.noun": "Receivables",
  "overview.receivables.open": "Open receivables and filter by the “{state}” state",

  // --- Recent activity (P-5) --------------------------------------------------
  "overview.activity.title": "Recent activity",
  "overview.activity.caption": "Latest recorded events in the current scope",
  "overview.activity.col.time": "Time (UTC)",
  "overview.activity.col.actor": "Actor",
  "overview.activity.col.action": "Activity",
  "overview.activity.empty": "No recorded activity in this scope.",
  "overview.activity.failed": "Couldn't load recent activity.",
  "overview.activity.open": "See all recorded events",
  "overview.activity.action.auth": "Sign-in or session",
  "overview.activity.action.context": "Scope change",
  "overview.activity.action.catalog": "Catalog activity",
  "overview.activity.action.unknownItem": "Unknown-items activity",
  "overview.activity.action.shift": "Shift activity",
  "overview.activity.action.sale": "Sales activity",
  "overview.activity.action.settlement": "Receivables and settlement activity",
  "overview.activity.action.erpnext": "ERPNext sync activity",
  "overview.activity.action.operator": "Operator activity",
  "overview.activity.action.tenant": "Tenant activity",
  "overview.activity.action.store": "Store activity",
  "overview.activity.action.other": "Other recorded activity",
};
