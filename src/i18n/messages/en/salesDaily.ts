import type { salesDaily as ar } from "../ar/salesDaily";
import type { MessagesOf } from "../types";

/** English copy for the daily received-sales report (RT-821, VIZ-3). */
export const salesDaily: MessagesOf<typeof ar> = {
  // --- Entry and heading -------------------------------------------------------
  "salesDaily.entry": "Daily received sales",
  "salesDaily.title": "Daily received sales",
  "salesDaily.sub":
    "Sales the server has received per business day in {tenant}, for the store chosen in the scope header or for every store in scope. Read-only.",
  "salesDaily.back": "Sales",

  // --- Range form --------------------------------------------------------------
  "salesDaily.range.label": "Business-date range",
  "salesDaily.range.apply": "Show",
  "salesDaily.range.note": "At most 31 business days, both ends included.",
  "salesDaily.range.rejected":
    "The server rejected this range. Use real dates, at most 31 business days.",

  // --- Context -----------------------------------------------------------------
  "salesDaily.context.calendar": "By each store's local business day",
  "salesDaily.context.zonesPartial": {
    one: "zones of the first {count} store only; the other stores were not read",
    other: "zones of the first {count} stores only; the other stores were not read",
  },
  "salesDaily.context.soFar":
    "Days marked (so far) are not over yet in at least one store, and the range total includes them.",

  // --- Tables ------------------------------------------------------------------
  "salesDaily.table.money.caption":
    "Received sales, voids, returns and legacy refunds per business day",
  "salesDaily.table.money.hint":
    "Each cell: the count, then the total in each currency on its own line. Currencies are never added together.",
  "salesDaily.table.status.caption":
    "Sync state, ERPNext posting state and shift closes per business day",
  "salesDaily.table.status.hint":
    "Sync and ERP states are the state now (as of the read) of each day's received sales, not a backlog on that day.",
  "salesDaily.col.day": "Business day",
  "salesDaily.row.notBegun": "(not yet begun)",
  "salesDaily.row.total": "Range total",
  "salesDaily.row.totalSoFar": "Range total (includes days so far)",

  // --- Chart (RT-823, VIZ-5) ---------------------------------------------------
  "salesDaily.chart.title": "Received sales per business day",
  "salesDaily.chart.summary":
    "A summary of the table below: one bar per business day, in {currency}. Select a bar to go to its row. The exact figures are in the table.",
  "salesDaily.chart.legend":
    "A hatched bar is a day still running (so far). A day with no figure from the server is marked Unknown and has no bar.",
  "salesDaily.chart.currency": "Currency",
  "salesDaily.chart.bar": "{date}: {value} {currency}",
  "salesDaily.chart.barSoFar": "{date}: {value} {currency}, so far",
  "salesDaily.chart.barUnknown": "{date}: unknown",
  "salesDaily.chart.barNotBegun": "{date}: not yet begun",
  "salesDaily.chart.soFar": "So far",
  "salesDaily.chart.unknown": "Unknown",
  "salesDaily.chart.notBegun": "Not begun",
  "salesDaily.chart.empty": "No sales were received in this range.",
  "salesDaily.chart.emptyUnknown": "The server returned no figures for these days.",

  // --- Export (RT-824, VIZ-6) --------------------------------------------------
  "salesDaily.export.button": "Export CSV",
  "salesDaily.export.hint":
    "Downloads the figures in the tables below with this context: scope, stores and time zones, range, as-of time and completeness.",

  // --- Definitions -------------------------------------------------------------
  "salesDaily.about": "What these figures mean",

  // --- States ------------------------------------------------------------------
  "salesDaily.loading": "Loading the report…",
  "salesDaily.failed": "The report could not be loaded.",
  "salesDaily.retry": "Retry",
  "salesDaily.rateLimited": "Too many requests. Try again when the wait ends.",
  "salesDaily.rateLimitedHint": "The banner at the top of the page shows the time left.",
};
