import type { audit as ar } from "../ar/audit";
import type { MessagesOf } from "../types";

export const audit: MessagesOf<typeof ar> = {
  "audit.title": "Audit",
  "audit.header.scope": "{tenant} · {store}",
  "audit.scopePrompt":
    "Select a tenant to search its audit activity. Use the tenant selector in the scope bar above to choose where you are working.",

  "audit.field.time": "Time (UTC)",
  "audit.field.action": "Action",
  "audit.field.actor": "Actor",
  "audit.field.target": "Target",
  "audit.field.store": "Store",
  "audit.field.requestId": "Request ID",

  "audit.filters.actorPlaceholder": "user id",
  "audit.filters.storePlaceholder": "store id",
  "audit.filters.from": "From",
  "audit.filters.to": "To",
  "audit.filters.apply": "Apply",
  "audit.filters.clear": "Clear",

  "audit.prequery": "Search audit activity for {tenant}.",

  "audit.errors.forbidden": "You do not have permission to view audit for this scope.",
  "audit.errors.searchFailed": "Audit search failed. Try again.",

  "audit.list.loadingNoun": "audit events",
  "audit.list.empty": "No audit events match these filters.",
  "audit.list.clearFilters": "Clear filters",

  "audit.continuation.forbidden":
    "Could not load more audit events: you do not have permission. The events above are kept.",
  "audit.continuation.failed": "Could not load more audit events. The events above are kept.",
  "audit.continuation.retry": "Retry",

  "audit.table.caption": "Audit events",
  "audit.table.requestShort": "Req",

  "audit.pager.loaded": "Showing {count}",
  "audit.pager.loadMore": "Load more",

  "audit.inspect.title": "Audit event",
  "audit.inspect.copy": "Copy",
  "audit.inspect.metadata": "Metadata",
  "audit.inspect.noMetadata": "No metadata.",
};
