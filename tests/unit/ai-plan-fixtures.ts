import type {
  AiFeatureAvailability,
  AiFeatureEntitlement,
  AiRequestMeter,
  TenantAiEntitlementsFull,
  TenantAiEntitlementsMinimal,
} from "@/lib/ai-entitlements-queries";

/**
 * RT-665 contract-shaped fixtures (ai-entitlements.openapi.yaml 1.0.0-draft, RT-662).
 * Each is typed `satisfies` the generated schema, so a contract change that
 * renames or drops a field is a compile error here, not a silent fixture drift.
 */
export const TENANT_ID = "0190f000-0000-7000-8000-000000000001";
export const STORE_ID = "0190f000-0000-7000-8000-0000000000a1";
const EVALUATED_AT = "2026-10-19T09:30:00Z";

export const dayMeter = {
  meter: "ai.briefing.requests",
  unit: "request",
  window: "day",
  storeRef: null,
  limit: 20,
  used: 7,
  reserved: 1,
  remaining: 12,
  resetsAt: "2026-10-20T00:00:00Z",
} satisfies AiRequestMeter;

export const exhaustedMeter = {
  ...dayMeter,
  meter: "ai.ask.requests",
  window: "month",
  limit: 50,
  used: 50,
  reserved: 0,
  remaining: 0,
  resetsAt: "2026-11-01T00:00:00Z",
} satisfies AiRequestMeter;

export const storeMeter = {
  ...dayMeter,
  meter: "ai.briefing.store_requests",
  storeRef: STORE_ID,
} satisfies AiRequestMeter;

export const availableFeature = {
  featureId: "ai.briefing.daily",
  availability: "available",
  unavailableReason: null,
  entitled: true,
  optOut: { optedOut: false, changedAt: null },
  meters: [dayMeter],
} satisfies AiFeatureEntitlement;

export const notInPlanFeature = {
  featureId: "ai.forecast.weekly",
  availability: "unavailable",
  unavailableReason: "not_entitled",
  entitled: false,
  optOut: { optedOut: false, changedAt: null },
  meters: [],
} satisfies AiFeatureEntitlement;

export const trialEndedFeature = {
  featureId: "ai.insights.trial",
  availability: "unavailable",
  unavailableReason: "trial_expired",
  entitled: true,
  optOut: { optedOut: false, changedAt: null },
  meters: [],
} satisfies AiFeatureEntitlement;

export const readOnlyFeature = {
  featureId: "ai.notes.summary",
  availability: "unavailable",
  unavailableReason: "grace_read_only",
  entitled: true,
  optOut: { optedOut: false, changedAt: null },
  meters: [],
} satisfies AiFeatureEntitlement;

export const switchedOffFeature = {
  featureId: "ai.ask.assistant",
  availability: "unavailable",
  unavailableReason: "feature_disabled_tenant",
  entitled: true,
  optOut: { optedOut: true, changedAt: "2026-10-12T08:15:00Z" },
  meters: [],
} satisfies AiFeatureEntitlement;

export const temporarilyUnavailableFeature = {
  featureId: "ai.ops.digest",
  availability: "unavailable",
  unavailableReason: null,
  entitled: true,
  optOut: { optedOut: false, changedAt: null },
  meters: [],
} satisfies AiFeatureEntitlement;

export const exhaustedFeature = {
  ...availableFeature,
  featureId: "ai.ask.assistant.quota",
  meters: [exhaustedMeter, storeMeter],
} satisfies AiFeatureEntitlement;

/** An active plan with one feature in each tenant-facing state. */
export const fullActive = {
  view: "full",
  entitlementVersion: 4,
  optOutVersion: 2,
  state: "active",
  effectiveFrom: "2026-10-01T00:00:00Z",
  effectiveUntil: "2027-10-01T00:00:00Z",
  evaluatedAt: EVALUATED_AT,
  features: [
    availableFeature,
    exhaustedFeature,
    notInPlanFeature,
    readOnlyFeature,
    switchedOffFeature,
    temporarilyUnavailableFeature,
    trialEndedFeature,
  ],
} satisfies TenantAiEntitlementsFull;

/** State `none`: no effective revision, every feature unavailable and not entitled. */
export const fullNone = {
  view: "full",
  entitlementVersion: 0,
  optOutVersion: 0,
  state: "none",
  effectiveFrom: null,
  effectiveUntil: null,
  evaluatedAt: EVALUATED_AT,
  features: [notInPlanFeature],
} satisfies TenantAiEntitlementsFull;

export const minimalFeatures = [
  { featureId: "ai.briefing.daily", availability: "available" },
  { featureId: "ai.forecast.weekly", availability: "unavailable" },
] satisfies AiFeatureAvailability[];

export const minimalView = {
  view: "minimal",
  evaluatedAt: EVALUATED_AT,
  features: minimalFeatures,
} satisfies TenantAiEntitlementsMinimal;

export const apiError = (code: string, requestId = "req-ai-1") => ({
  error: { code, message: "x", request_id: requestId },
});
