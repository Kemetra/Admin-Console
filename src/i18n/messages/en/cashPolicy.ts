import type { cashPolicy as ar } from "../ar/cashPolicy";
import type { MessagesOf } from "../types";

export const cashPolicy: MessagesOf<typeof ar> = {
  // --- Sections ------------------------------------------------------------
  "cashPolicy.tenant.title": "Shift variance policy",
  "cashPolicy.tenant.sub":
    "The default for every store in this tenant. A store can have its own override.",
  "cashPolicy.store.title": "Shift variance policy",
  "cashPolicy.store.sub":
    "The policy this store's terminals receive, and the store override if there is one.",
  "cashPolicy.loadingNoun": "the policy",
  "cashPolicy.unavailable": "The shift variance policy is not available to you.",
  "cashPolicy.loadFailed": "The policy could not be loaded.",
  "cashPolicy.sessionExpired": "Your session has expired. Sign in again.",
  "cashPolicy.retry": "Retry",
  "cashPolicy.refresh": "Refresh",
  "cashPolicy.readOnly": "You can view this policy. Only an owner or tenant admin can change it.",

  // --- Values and sources ----------------------------------------------------
  "cashPolicy.value.none": "No approval needed: the cashier closes alone",
  "cashPolicy.value.limit": "Approval needed when the variance is over {amount}",
  "cashPolicy.source.system": "System default",
  "cashPolicy.source.tenant": "Tenant default",
  "cashPolicy.source.store": "Store override",

  // --- Current policy fields -----------------------------------------------------
  "cashPolicy.field.default": "Current default",
  "cashPolicy.field.effective": "Effective policy",
  "cashPolicy.field.source": "Source",
  "cashPolicy.field.tenantDefault": "Tenant default",
  "cashPolicy.field.override": "Store override",
  "cashPolicy.field.reason": "Reason",
  "cashPolicy.field.changedAt": "In effect since",
  "cashPolicy.field.changedBy": "Published by",
  "cashPolicy.field.until": "Expires",
  "cashPolicy.field.approvedBy": "Approved by owner",
  "cashPolicy.override.none": "No override. This store follows the tenant default.",
  "cashPolicy.override.permanent": "Permanent",
  "cashPolicy.override.noExpiry": "No expiry",
  "cashPolicy.override.permanentNote":
    "An override with no expiry, or an expiry more than {days} days after publishing, is permanent. Only an owner can publish it.",

  // --- Forms ----------------------------------------------------------------------
  "cashPolicy.form.tenantTitle": "Change the default",
  "cashPolicy.form.overrideTitle": "Set a store override",
  "cashPolicy.form.mode": "Policy type",
  "cashPolicy.form.modeNone": "No limit: the cashier always closes alone",
  "cashPolicy.form.modeLimit": "Limit: approval needed when the variance is over the limit",
  "cashPolicy.form.limitAmount": "Variance limit",
  "cashPolicy.form.limitHint":
    "A variance equal to the limit closes with the cashier alone. Zero asks for approval on any variance.",
  "cashPolicy.form.currency": "Currency",
  "cashPolicy.form.reason": "Reason",
  "cashPolicy.form.reasonHint": "1 to 200 characters. Do not enter personal data.",
  "cashPolicy.form.expiry": "Expiry (optional)",
  "cashPolicy.form.expiryHint": "In {zone}. Leave empty for a permanent override.",
  "cashPolicy.form.applyNow": "Apply now",
  "cashPolicy.form.applyNowHint":
    "Applies from each terminal's next cash-session open. A session already open keeps its value.",
  "cashPolicy.form.clearTitle": "Remove the override",
  "cashPolicy.form.clearReason": "Reason for removing",
  "cashPolicy.form.clear": "Remove override",
  "cashPolicy.form.saved": "The policy was applied.",
  "cashPolicy.form.cleared": "The override was removed.",

  // --- History -----------------------------------------------------------------------
  "cashPolicy.history.title": "Revision history",
  "cashPolicy.history.caption": "Shift variance policy revisions, newest first",
  "cashPolicy.history.empty": "No revisions yet.",
  "cashPolicy.history.loadMore": "Load more",
  "cashPolicy.history.loadFailed": "The revision history could not be loaded.",
  "cashPolicy.history.kind.set": "Set",
  "cashPolicy.history.kind.clear": "Removed",
  "cashPolicy.history.state.current": "Current",
  "cashPolicy.history.state.superseded": "Superseded",
  "cashPolicy.history.state.expired": "Expired",
  "cashPolicy.history.expiredNote": "This override expired and no longer applies.",
  "cashPolicy.history.col.when": "Date",
  "cashPolicy.history.col.change": "Change",
  "cashPolicy.history.col.value": "Value",
  "cashPolicy.history.col.reason": "Reason",
  "cashPolicy.history.col.by": "By",
  "cashPolicy.history.col.state": "State",
  "cashPolicy.history.noValue": "No value",

  // --- Errors ------------------------------------------------------------------------
  "cashPolicy.error.reasonRequired": "Enter a reason for the change.",
  "cashPolicy.error.reasonTooLong": "The reason is longer than 200 characters.",
  "cashPolicy.error.amountInvalid":
    "Enter a valid amount with at most two decimal places, for example 1250.50.",
  "cashPolicy.error.expiryInvalid": "Enter a valid date and time.",
  "cashPolicy.error.expiryRequiredForAdmin":
    "Set an expiry. Only an owner can publish an override with no expiry.",
  "cashPolicy.error.changedConcurrently":
    "Someone else changed the policy. Refresh to see the latest version, then try again.",
  "cashPolicy.error.keyConflict":
    "The request could not be completed. Check the values and try again.",
  "cashPolicy.error.validation": "The server rejected these values. Check them and try again.",
  "cashPolicy.error.currencyUnsupported": "That currency is not supported. Only EGP is available.",
  "cashPolicy.error.looserThanTenant": "A store override cannot be looser than the tenant default.",
  "cashPolicy.error.expiryNotFuture": "The expiry must be after the current time.",
  "cashPolicy.error.notActive": "There is no active override to remove.",
  "cashPolicy.error.ownerApprovalRequired":
    "Only an owner can publish a permanent override. Ask an owner to publish it, or set a nearer expiry.",
  "cashPolicy.error.originRejected":
    "The request was refused because its origin is not allowed. Reload the page.",
  "cashPolicy.error.forbidden": "You do not have permission to change this policy.",
  "cashPolicy.error.unavailable": "The shift variance policy is not available to you.",
  "cashPolicy.error.sessionExpired": "Your session has expired. Sign in again.",
  "cashPolicy.error.inProgress":
    "The previous request is still being processed. Try again in a moment.",
  "cashPolicy.error.generic": "The request could not be completed. Try again.",
};
