import type { money as ar } from "../ar/money";
import type { MessagesOf } from "../types";

export const money: MessagesOf<typeof ar> = {
  // --- Payer accounts (017) --------------------------------------------------
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
  "payers.create.externalRef": "External reference (optional)",
  "payers.create.externalRefPlaceholder": "e.g. insurer code",
  "payers.create.submit": "Create payer",
  "payers.create.errors.validation": "Check the payer details and try again.",
  "payers.create.errors.sessionExpired": "Your session has expired. Sign in again.",
  "payers.create.errors.forbidden":
    "You do not have permission to create payer accounts for this tenant.",
  "payers.create.errors.keyConflict": "That payer could not be created. Please try again.",
  "payers.create.errors.conflict": "That payer account could not be created.",
  "payers.create.errors.generic": "Something went wrong creating the payer. Try again.",

  "payers.form.categoryRequired": "Select a payer category.",
  "payers.form.displayNameRequired": "Display name is required.",
  "payers.form.displayNameTooLong": "Display name must be at most {max} characters.",

  // --- Receivables (018) -----------------------------------------------------
  "receivables.list.scopePrompt": "Select a tenant to view its receivables.",
  "receivables.list.title": "Receivables",
  "receivables.list.subtitle": "Money owed against sales for {tenant}.",
  "receivables.list.forbidden": "You do not have access to receivables for this tenant.",
  "receivables.list.loadFailed": "Receivables could not be loaded.",
  "receivables.list.loadingNoun": "receivables",
  "receivables.list.empty": "No receivables in this tenant yet.",
  "receivables.list.caption": "Receivables",
  "receivables.list.col.receivable": "Receivable",
  "receivables.list.col.payer": "Payer",
  "receivables.list.col.outstanding": "Outstanding",
  "receivables.list.col.state": "State",
  "receivables.list.col.erpPosting": "ERP posting",
  "receivables.list.col.action": "Action",
  "receivables.list.notPosted": "not posted",
  "receivables.list.applyPayment": "Apply payment",
  "receivables.list.submitClaim": "Submit claim",

  "receivables.state.open": "Open",
  "receivables.state.partially_applied": "Partially applied",
  "receivables.state.settled": "Settled",
  "receivables.state.claimed": "Claimed",
  "receivables.state.flagged": "Flagged",
  "receivables.state.unknown": "Unknown state",

  "receivables.errors.sessionExpired": "Your session has expired. Sign in again.",

  "receivables.claim.title": "Submit claim",
  "receivables.claim.scopeLine": {
    one: "Submitting a claim for {total} receivable in {tenant}.",
    other: "Submitting a claim for {total} receivables in {tenant}.",
  },
  "receivables.claim.submit": "Submit claim",
  "receivables.claim.errors.validation": "Check the claim and try again.",
  "receivables.claim.errors.forbidden":
    "You do not have permission to submit claims for this tenant.",
  "receivables.claim.errors.conflict": "That claim could not be submitted. Please try again.",
  "receivables.claim.errors.generic": "Something went wrong submitting the claim. Try again.",

  "receivables.form.payerRequired": "Select a payer for this claim.",
  "receivables.form.receivablesRequired": "Select at least one receivable to claim.",
  "receivables.form.receivablesTooMany": "A claim may bundle at most {max} receivables.",
  "receivables.form.amountInvalid": "Enter a valid amount (e.g. 120.00).",

  "receivables.reconcile.title": "Reconcile remittance",
  "receivables.reconcile.outcome": "Outcome {outcome}",
  "receivables.reconcile.claimed": "Claimed",
  "receivables.reconcile.remitted": "Remitted",
  "receivables.reconcile.variance": "Variance",
  "receivables.reconcile.done": "Done",
  "receivables.reconcile.scopeLine": "Reconciling a remittance for claim {claim}.",
  "receivables.reconcile.amount": "Remitted amount",
  "receivables.reconcile.reference": "Remittance reference (optional)",
  "receivables.reconcile.referencePlaceholder": "payer advice reference",
  "receivables.reconcile.submit": "Reconcile",
  "receivables.reconcile.errors.validation": "Check the remittance amount and try again.",
  "receivables.reconcile.errors.forbidden":
    "You do not have permission to reconcile remittances for this tenant.",
  "receivables.reconcile.errors.conflict":
    "That remittance could not be reconciled. Please try again.",
  "receivables.reconcile.errors.generic":
    "Something went wrong reconciling the remittance. Try again.",

  "receivables.outcome.settled": "Settled",
  "receivables.outcome.partial": "Partial",
  "receivables.outcome.flagged": "Flagged",
  "receivables.outcome.unknown": "Unknown outcome",

  // --- Apply payment (019) ---------------------------------------------------
  "settlement.apply.title": "Apply payment",
  "settlement.apply.result": "Payment applied — receivable now {state}",
  "settlement.apply.outstanding": "Outstanding",
  "settlement.apply.done": "Done",
  "settlement.apply.scopeLine":
    "Applying a payment against receivable {receivable} — outstanding {balance}.",
  "settlement.apply.amount": "Amount",
  "settlement.apply.note": "Note (optional)",
  "settlement.apply.submit": "Apply payment",
  "settlement.apply.errors.validation": "Check the amount and try again.",
  "settlement.apply.errors.sessionExpired": "Your session has expired. Sign in again.",
  "settlement.apply.errors.forbidden":
    "You do not have permission to apply payments for this tenant.",
  "settlement.apply.errors.conflict":
    "This receivable changed since it was opened. Reopen it and try again.",
  "settlement.apply.errors.generic": "Something went wrong applying the payment. Try again.",

  "settlement.form.amountInvalid": "Enter an amount greater than zero (e.g. 50.00).",
  "settlement.form.versionInvalid": "A valid receivable version is required.",
};
