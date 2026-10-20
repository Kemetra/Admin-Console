import type { common as ar } from "../ar/common";
import type { MessagesOf } from "../types";

export const common: MessagesOf<typeof ar> = {
  "app.title": "Retail Tower Console",
  "app.productTag": "Console",

  "locale.switch.name": "English",
  "locale.switch.action": "Switch to English",

  "theme.darkMode": "Dark mode",

  "app.crash.title": "Something went wrong",
  "app.crash.body": "Reload the page to continue. If it happens again, contact support.",
  "app.crash.reload": "Reload the page",

  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.save": "Save",
  "common.tryAgain": "Try again",
  "common.loading": "Loading…",

  "errors.forbidden": "You do not have permission to perform this action.",
  "errors.notFound": "This resource is not available.",
  "errors.server": "Something went wrong. Try again.",
  "errors.generic": "The request could not be completed.",

  "rateLimit.title": "Too many requests",
  "rateLimit.wait": {
    one: "You can try again in {count} second.",
    other: "You can try again in {count} seconds.",
  },
  "rateLimit.ready": "You can try again now.",
  "rateLimit.dismiss": "Dismiss",
  "rateLimit.gate": { one: "Wait {count}s", other: "Wait {count}s" },

  "format.dateTime": "{date}, {time}",
  "format.dateTimeUtc": "{date}, {time} UTC",
  "format.duration.hours": { one: "{count} hour", other: "{count} hours" },
  "format.duration.minutes": { one: "{count} minute", other: "{count} minutes" },
  "format.duration.seconds": { one: "{count} second", other: "{count} seconds" },

  // RT-753 (UX-10): shared table selection. The count always names its scope.
  "table.selection.column": "Select",
  "table.selection.selectPage": "Select all rows on this page",
  "table.selection.selectRow": "Select {value}",
  "table.selection.open": "Open",
  "table.selection.openRow": "Open {value}",
  "table.selection.pageCount": {
    zero: "No rows selected on this page",
    one: "1 selected on this page",
    other: "{count} selected on this page",
  },
  "table.selection.allMatching": {
    zero: "No matching rows",
    one: "The only matching row is selected",
    other: "All {count} matching rows are selected",
  },
  "table.selection.selectAllMatching": {
    zero: "No matching rows",
    one: "Select the only matching row",
    other: "Select all {count} matching rows",
  },
  "table.selection.clear": "Clear selection",

  "role.owner": "Owner",
  "role.tenant_admin": "Tenant admin",
  "role.store_manager": "Store manager",
  "role.platform_admin": "Platform admin",
  "role.manager": "Manager",
  "role.cashier": "Cashier",
  "role.unknown": "Unknown role",
};
