import type { aiPlan as ar } from "../ar/aiPlan";
import type { MessagesOf } from "../types";

export const aiPlan: MessagesOf<typeof ar> = {
  // --- Sections ------------------------------------------------------------
  "aiPlan.full.title": "AI plan & usage",
  "aiPlan.full.sub": "Read only. What your plan includes, and how much of it has been used.",
  "aiPlan.minimal.title": "AI features in your stores",
  "aiPlan.minimal.sub": "The AI features you can use in the stores you manage.",
  "aiPlan.loadingNoun": "AI features",
  "aiPlan.notYet.full": "AI plan information is not available yet.",
  "aiPlan.notYet.minimal": "AI feature information is not available yet.",
  "aiPlan.loadFailed": "The AI information could not be loaded.",
  "aiPlan.sessionExpired": "Your session has expired. Sign in again.",
  "aiPlan.retry": "Retry",

  // --- Plan facts (owner / tenant_admin) ------------------------------------------
  "aiPlan.field.state": "Plan status",
  "aiPlan.field.effectiveFrom": "Effective from",
  "aiPlan.field.effectiveUntil": "Effective until",
  "aiPlan.field.evaluatedAt": "As of",
  "aiPlan.state.none": "No AI plan",
  "aiPlan.state.trial": "Trial",
  "aiPlan.state.active": "Active",
  "aiPlan.state.grace": "Grace period (read only)",
  "aiPlan.state.expired": "Expired",
  "aiPlan.state.cancelled": "Cancelled",
  "aiPlan.state.unknown": "Status not available",

  // --- Features ----------------------------------------------------------------------
  "aiPlan.features.title": "Features",
  "aiPlan.features.empty": "There are no features to show.",
  "aiPlan.status.available": "Available",
  "aiPlan.status.notInPlan": "Not in your plan",
  "aiPlan.status.trialEnded": "Trial ended",
  "aiPlan.status.readOnly": "Read only: saved results stay available, new requests are paused",
  "aiPlan.status.switchedOff": "Switched off by your account owner",
  "aiPlan.status.temporarilyUnavailable": "Temporarily unavailable",
  "aiPlan.minimal.available": "Available",
  "aiPlan.minimal.unavailable": "Not available — ask your account owner",
  "aiPlan.optOut.since": "Last changed by the owner on {date}",

  // --- Meters -----------------------------------------------------------------------
  "aiPlan.meter.window.day": "per day (UTC)",
  "aiPlan.meter.window.month": "per month (UTC)",
  "aiPlan.meter.window.unknown": "per period",
  "aiPlan.meter.scope.tenant": "Whole-tenant allowance",
  "aiPlan.meter.scope.store": "Store allowance",
  "aiPlan.meter.left": "{remaining} of {limit} requests left, resets {time}",
  "aiPlan.meter.used": "Allowance used, resets {time}",
  "aiPlan.meter.none": "No allowance in this window, resets {time}",
  "aiPlan.meter.detail": "Limit {limit}, used {used}, in progress {reserved}",
};
