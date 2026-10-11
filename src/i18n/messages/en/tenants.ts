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
  "stores.list.sub": "Stores in {tenant}.",
  "stores.list.add": "New store",
  "stores.list.caption": "Stores",
  "stores.list.loadingNoun": "stores",
  "stores.list.empty": "No stores in {tenant} yet.",
  "stores.list.retry": "Retry",

  "stores.field.name": "Name",
  "stores.field.code": "Code",
  "stores.field.state": "State",
  "stores.field.id": "Store ID",

  "stores.state.active": "active",
  "stores.state.inactive": "inactive",

  "stores.detail.loadingNoun": "store",
  "stores.detail.back": "Back to stores",
  "stores.detail.edit": "Edit",
  "stores.detail.softDelete": "Soft-delete",

  "stores.form.createTitle": "New store",
  "stores.form.editTitle": "Edit store",
  "stores.form.create": "Create store",
  "stores.form.saveChanges": "Save changes",
  "stores.form.scopeLine": "Creating in tenant {tenant}.",
  "stores.form.active": "Active",

  "stores.scope.prompt":
    "Select a tenant before managing stores. Use the tenant selector in the scope bar above to choose where you are working.",

  "stores.errors.codeConflict":
    "That store code is already in use in this tenant. Choose a different one.",
  "stores.errors.scopeRequired": "Select a tenant before managing stores.",
};
