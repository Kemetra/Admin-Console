import type { tenants as ar } from "../ar/tenants";
import type { MessagesOf } from "../types";

export const tenants: MessagesOf<typeof ar> = {
  // --- Tenants ---------------------------------------------------------------
  "tenants.list.title": "Tenants",
  "tenants.list.sub": "Every tenant you can administer.",
  "tenants.list.add": "New tenant",
  "tenants.list.caption": "Tenants",
  "tenants.list.loadingNoun": "tenants",
  "tenants.list.empty": "No tenants yet.",
  "tenants.list.retry": "Retry",

  "tenants.field.name": "Name",
  "tenants.field.slug": "Slug",
  "tenants.field.status": "Status",
  "tenants.field.id": "Tenant ID",

  "tenants.status.active": "active",
  "tenants.status.suspended": "suspended",
  "tenants.status.pending": "pending",
  "tenants.status.unknown": "unknown",

  "tenants.detail.loadingNoun": "tenant",
  "tenants.detail.back": "Back to tenants",
  "tenants.detail.edit": "Edit",
  "tenants.detail.softDelete": "Soft-delete",

  "tenants.form.createTitle": "New tenant",
  "tenants.form.editTitle": "Edit tenant",
  "tenants.form.create": "Create tenant",
  "tenants.form.saveChanges": "Save changes",

  "tenants.errors.slugConflict": "That slug is already in use. Choose a different one.",

  // --- Stores ----------------------------------------------------------------
  "stores.list.title": "Stores",
  "stores.list.sub": "Stores in {tenant}",
  "stores.list.add": "Add store",
  "stores.list.caption": "Stores",
  "stores.list.col.store": "Store",
  "stores.list.loadingNoun": "stores",
  "stores.list.empty": "No stores in this tenant yet.",
  "stores.list.emptyHint": "Add the first store so you can pair point-of-sale devices.",
  "stores.list.loadFailedTitle": "Couldn't load the store list.",
  "stores.list.loadFailedBody": "Nothing changed in your store data. Reload the list to try again.",
  "stores.list.retry": "Reload stores",

  "stores.field.code": "Code",
  "stores.field.state": "Status",
  "stores.field.id": "Store ID",
  "stores.field.timezone": "Time zone",

  "stores.state.active": "Active",
  "stores.state.inactive": "Suspended",

  "stores.detail.loadingNoun": "store",
  "stores.detail.back": "Back to stores",
  "stores.detail.edit": "Edit store",

  "stores.form.createTitle": "Add store",
  "stores.form.editTitle": "Edit {name}",
  "stores.form.section": "Store details",
  "stores.form.nameLabel": "Store name",
  "stores.form.codeLabel": "Store code",
  "stores.form.required": "(required)",
  "stores.form.codeHintCreate": "The code can't be changed after the store is created.",
  "stores.form.codeHintEdit": "Read-only. The code can't be changed after the store is created.",
  "stores.form.idHint": "Quote it when you contact support.",
  "stores.form.create": "Create store",
  "stores.form.saveChanges": "Save store",
  "stores.form.cancelEdit": "Cancel editing",
  "stores.form.scopeLine": "The store will be created in {tenant}.",
  "stores.form.timezoneHintCreate":
    "Store times are shown, and business days counted, in this time zone. Its offset from UTC follows the zone's rules, including daylight saving.",
  "stores.form.timezoneHintEdit":
    "The impact is reviewed before the change is applied, and the zone can't be changed while a shift is open. Its offset from UTC follows the zone's rules, including daylight saving.",
  "stores.form.timezoneGroupCommon": "Common zones",
  "stores.form.timezoneGroupOther": "All other zones",

  // The impact review shown before a time zone change is applied (RT-401).
  "stores.timezone.impact.title": "Impact of the change",
  "stores.timezone.impact.loading": "Checking the impact…",
  "stores.timezone.impact.zones": "Changing from {current} to {proposed}.",
  "stores.timezone.impact.dateChanges": "Today's business date changes from {from} to {to}.",
  "stores.timezone.impact.dateSame": "Today's business date stays {date}.",
  "stores.timezone.impact.noOpenShifts": "No open shifts at this store.",
  "stores.timezone.impact.openShifts": {
    one: "1 shift is open at this store. Close it before changing the time zone.",
    other: "{count} shifts are open at this store. Close them before changing the time zone.",
  },
  "stores.timezone.impact.history":
    "Sales, returns and shifts already recorded keep their business date.",
  "stores.timezone.impact.noChange": "This is already this store's time zone. Nothing to change.",
  "stores.timezone.impact.review": "I've reviewed this impact and want to change the time zone.",

  "stores.status.title": "Store status",
  "stores.status.current": "Current status:",
  "stores.status.suspend": "Suspend store",
  "stores.status.activate": "Activate store",
  "stores.status.confirmLabel": "Confirm: suspend store",
  "stores.status.confirmPrompt": "Suspend {name}? You can activate it again from this page.",

  "stores.scope.prompt":
    "Select a tenant before managing stores. Use the tenant selector in the scope bar above to choose where you are working.",

  "stores.errors.codeConflict":
    "That store code is already in use in this tenant. Choose a different one.",
  "stores.errors.scopeRequired": "Select a tenant before managing stores.",
  "stores.errors.timezoneInvalid": "Choose a valid time zone from the list.",
  "stores.errors.timezoneChangedConcurrently":
    "The store's time zone was changed by someone else, so nothing was saved. Review the impact again before applying.",
  "stores.errors.storeHasOpenShift":
    "This store has an open shift, so its time zone can't be changed now. Close the open shift and try again. Nothing was changed.",
  "stores.errors.editDeniedTitle": "You don't have permission to edit this store.",
  "stores.errors.editDeniedBody":
    "Nothing changed. The tenant owner or an admin can make this change.",
};
