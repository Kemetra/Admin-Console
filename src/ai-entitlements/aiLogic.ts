/**
 * RT-665: the view model of the tenant's AI plan & usage panel.
 *
 * `toPanelModel` reads the server's decision and projects it for display. It
 * decides nothing: availability, the reason and every meter figure are the
 * server's (the RT-662 contract); an exhausted meter is a fact on its row, never
 * a verdict on the feature. Nothing outside the contract's tenant-facing fields
 * is copied, so a stray price, plan name, token cost or credit balance in a body
 * can never be rendered. A body that is not the contract's shape yields
 * `undefined` (a load failure for the caller), never a throw.
 *
 * The role picks the projection and the body can only narrow it: a store_manager
 * always gets the minimal one (D-6), even if a full body arrives. A full-view role
 * whose body is not `view: "full"` is a load failure (the server never does this),
 * not a minimal list under a plan title.
 */
import type { AiPlanView } from "./aiAccess";

/** What the panel says about one feature. The reason codes themselves are never copy. */
export type FeatureStatus =
  | "available"
  | "notInPlan"
  | "trialEnded"
  | "readOnly"
  | "switchedOff"
  | "temporarilyUnavailable";

export type PlanStateKey =
  | "none"
  | "trial"
  | "active"
  | "grace"
  | "expired"
  | "cancelled"
  | "unknown";

export type MeterWindow = "day" | "month" | "unknown";

export interface MeterModel {
  meter: string;
  window: MeterWindow;
  /** The store a per-store meter belongs to; null for a tenant meter. */
  storeRef: string | null;
  limit: number;
  used: number;
  reserved: number;
  remaining: number;
  /** The next UTC window boundary, as the server states it. */
  resetsAt: string;
  /** `remaining` is 0 under a limit above 0: the allowance of this window is used up. */
  allowanceUsed: boolean;
  /** The limit is 0: this window grants no allowance at all (not "used up"). */
  noAllowance: boolean;
}

export interface FullFeatureModel {
  featureId: string;
  status: FeatureStatus;
  optedOut: boolean;
  /** When the owner last changed the opt-out; null when never. */
  optedOutAt: string | null;
  meters: MeterModel[];
}

export interface MinimalFeatureModel {
  featureId: string;
  available: boolean;
}

export interface FullPanelModel {
  kind: "full";
  state: PlanStateKey;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  evaluatedAt: string | null;
  features: FullFeatureModel[];
}

export interface MinimalPanelModel {
  kind: "minimal";
  evaluatedAt: string | null;
  features: MinimalFeatureModel[];
}

export type PanelModel = FullPanelModel | MinimalPanelModel;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const STATES: readonly PlanStateKey[] = [
  "none",
  "trial",
  "active",
  "grace",
  "expired",
  "cancelled",
];

function stateOf(value: unknown): PlanStateKey {
  return STATES.find((s) => s === value) ?? "unknown";
}

/** The four reasons a tenant may be told; anything else (or none) is "temporarily unavailable". */
const REASON_STATUS: Readonly<Record<string, FeatureStatus>> = {
  not_entitled: "notInPlan",
  trial_expired: "trialEnded",
  grace_read_only: "readOnly",
  feature_disabled_tenant: "switchedOff",
};

function statusOf(item: Json): FeatureStatus {
  if (item.availability === "available") return "available";
  const reason = asString(item.unavailableReason);
  const known = reason !== null && Object.hasOwn(REASON_STATUS, reason);
  return known ? REASON_STATUS[reason] : "temporarilyUnavailable";
}

function windowOf(value: unknown): MeterWindow {
  return value === "day" || value === "month" ? value : "unknown";
}

function meterOf(item: unknown): MeterModel | undefined {
  if (!isObject(item)) return undefined;
  const { meter, resetsAt, limit, used, reserved, remaining } = item;
  if (typeof meter !== "string" || typeof resetsAt !== "string") return undefined;
  if (![limit, used, reserved, remaining].every(isCount)) return undefined;
  return {
    meter,
    window: windowOf(item.window),
    storeRef: asString(item.storeRef),
    limit: limit as number,
    used: used as number,
    reserved: reserved as number,
    remaining: remaining as number,
    resetsAt,
    allowanceUsed: remaining === 0 && limit !== 0,
    noAllowance: limit === 0,
  };
}

function fullFeatureOf(item: unknown): FullFeatureModel | undefined {
  if (!isObject(item) || typeof item.featureId !== "string") return undefined;
  const optOut = isObject(item.optOut) ? item.optOut : {};
  const meters = Array.isArray(item.meters) ? item.meters : [];
  const status = statusOf(item);
  return {
    featureId: item.featureId,
    status,
    optedOut: optOut.optedOut === true,
    optedOutAt: asString(optOut.changedAt),
    // An entitled feature that is unavailable (switched off, trial ended, read only) can
    // still carry meters; "12 left" under "switched off" would mislead, so only a usable
    // feature shows its allowance.
    meters: status === "available" ? meters.flatMap((m) => meterOf(m) ?? []) : [],
  };
}

function minimalFeatureOf(item: unknown): MinimalFeatureModel | undefined {
  if (!isObject(item) || typeof item.featureId !== "string") return undefined;
  return { featureId: item.featureId, available: item.availability === "available" };
}

/**
 * The panel model for a body and the view the role may see, or `undefined` when
 * the body is not a view at all.
 */
export function toPanelModel(data: unknown, view: AiPlanView): PanelModel | undefined {
  if (!isObject(data) || !Array.isArray(data.features)) return undefined;
  // The contract's discriminator: a body that names no known view is not a view at all.
  if (data.view !== "full" && data.view !== "minimal") return undefined;
  const evaluatedAt = asString(data.evaluatedAt);

  if (view === "full") {
    if (data.view !== "full") return undefined;
    return {
      kind: "full",
      state: stateOf(data.state),
      effectiveFrom: asString(data.effectiveFrom),
      effectiveUntil: asString(data.effectiveUntil),
      evaluatedAt,
      features: data.features.flatMap((f) => fullFeatureOf(f) ?? []),
    };
  }
  return {
    kind: "minimal",
    evaluatedAt,
    features: data.features.flatMap((f) => minimalFeatureOf(f) ?? []),
  };
}
