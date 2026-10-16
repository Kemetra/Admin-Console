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
};
