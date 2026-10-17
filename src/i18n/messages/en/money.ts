import type { money as ar } from "../ar/money";
import type { MessagesOf } from "../types";

export const money: MessagesOf<typeof ar> = {
  // --- Payer accounts (017) --------------------------------------------------
  // Navigation (RT-421: owner / tenant_admin only, its own section).
  "payers.nav.section": "Payers",
  "payers.nav.label": "Payer accounts",
  "payers.list.scopePrompt": "Select a tenant to manage its payer accounts.",
  "payers.list.title": "Payer accounts",
  "payers.list.subtitle": "Credit, corporate & insurer payers for {tenant}.",
  "payers.list.create": "Create payer",
  "payers.list.forbidden": "You do not have access to payer accounts for this tenant.",
  "payers.list.loadFailed": "Payer accounts could not be loaded.",
  "payers.list.loadingNoun": "payer accounts",
  "payers.list.empty": "No payer accounts in this tenant yet.",
  "payers.list.caption": "Payer accounts",
  "payers.list.col.payer": "Payer",
  "payers.list.col.category": "Category",
  "payers.list.col.status": "Status",
  "payers.list.col.scope": "Scope",
  "payers.list.col.erpCustomer": "ERPNext Customer",
  "payers.list.erpCustomerUnlinked": "Not linked",
  "payers.list.loadMore": "Load more",
  "payers.list.emptyPage": "No payer accounts on this page yet. Load more to keep looking.",
  "payers.list.sessionExpired": "Your session has expired. Sign in again.",
  "payers.scope.tenant": "Whole tenant",
  "payers.scope.store": "One store",

  "payers.category.credit_customer": "Credit customer",
  "payers.category.corporate": "Corporate",
  "payers.category.insurer": "Insurer",
  "payers.category.unknown": "Unknown category",
  "payers.status.active": "Active",
  "payers.status.suspended": "Suspended",

  "payers.create.title": "Create payer account",
  "payers.create.scopeLine": "Creating a payer in tenant {tenant}.",
  "payers.create.category": "Category",
  "payers.create.displayName": "Display name",
  "payers.create.scope": "Scope",
  "payers.create.scopeTenant": "Whole tenant (all stores)",
  "payers.create.externalRef": "ERPNext Customer (optional)",
  "payers.create.externalRefPlaceholder": "ERPNext Customer ID",
  "payers.create.externalRefHint":
    "The ERPNext Customer this payer is posted against. Leave it blank until the payer is linked.",
  "payers.create.submit": "Create payer",
  "payers.create.errors.validation": "Check the payer details and try again.",
  "payers.create.errors.sessionExpired": "Your session has expired. Sign in again.",
  "payers.create.errors.forbidden":
    "You do not have permission to create payer accounts for this tenant.",
  "payers.create.errors.storeUnavailable":
    "That store can't be used for this payer. Choose another scope.",
  "payers.create.errors.keyConflict": "That payer could not be created. Please try again.",
  "payers.create.errors.conflict": "That payer account could not be created.",
  "payers.create.errors.generic": "Something went wrong creating the payer. Try again.",

  "payers.form.categoryRequired": "Select a payer category.",
  "payers.form.displayNameRequired": "Display name is required.",
  "payers.form.displayNameTooLong": "Display name must be at most {max} characters.",
};
