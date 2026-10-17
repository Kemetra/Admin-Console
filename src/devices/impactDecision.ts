/**
 * RT-372 — What the console may offer for a server impact preview. The server
 * decides: this reads only the preview's `verdict`, `blockCode` and `requires`,
 * never the device's trust state, the role or the open shift, so it cannot reach
 * a verdict of its own. The contract's extension policy is fail-safe: an unknown
 * verdict is `blocked`, an unknown block code is shown as a refusal that cannot
 * be resolved, and an unknown requirement is unmet. No React, no fetch.
 */
import type { MessageKey } from "@/i18n";

/** The shape `decideImpact` reads; wider than the contract so unknown values survive. */
export interface ImpactLike {
  verdict: string;
  blockCode: string | null;
  requires: readonly string[];
}

export type ImpactDecision =
  | {
      kind: "ready";
      /** The open shift becomes the unresolved custody exception. */
      custody: boolean;
      needs: { note: boolean; acknowledge: boolean };
    }
  | { kind: "blocked"; blockCode: string | null; known: boolean }
  | { kind: "forbidden" }
  | { kind: "no_change" };

/** Why a blocked action is refused, and what to do. An unknown code offers nothing. */
const BLOCK_KEYS: Readonly<Record<string, MessageKey>> = {
  unresolved_cash_session: "devices.impact.blocked.cashSession",
  unresolved_custody_exception: "devices.impact.blocked.custodyException",
  device_retired: "devices.impact.blocked.retired",
};

export function blockedMessageKey(code: string | null): MessageKey {
  return code !== null && Object.hasOwn(BLOCK_KEYS, code)
    ? BLOCK_KEYS[code]
    : "devices.impact.blocked.unknown";
}

/**
 * `owner_or_tenant_admin` is a fact about the caller that the verdict already
 * folded in (`forbidden_recovery` otherwise), so on a proceeding verdict it is
 * met. `note` and `acknowledge_custody_exception` are the request's inputs.
 */
const KNOWN_REQUIREMENTS: ReadonlySet<string> = new Set([
  "owner_or_tenant_admin",
  "note",
  "acknowledge_custody_exception",
]);

const UNKNOWN: ImpactDecision = { kind: "blocked", blockCode: null, known: false };

function blocked({ blockCode }: ImpactLike): ImpactDecision {
  return {
    kind: "blocked",
    blockCode,
    known: blockCode !== null && Object.hasOwn(BLOCK_KEYS, blockCode),
  };
}

function proceeding({ requires }: ImpactLike, custody: boolean): ImpactDecision {
  if (!requires.every((r) => KNOWN_REQUIREMENTS.has(r))) return UNKNOWN;
  return {
    kind: "ready",
    custody,
    needs: {
      note: requires.includes("note"),
      acknowledge: requires.includes("acknowledge_custody_exception"),
    },
  };
}

const BY_VERDICT: Readonly<Record<string, (preview: ImpactLike) => ImpactDecision>> = {
  no_change: () => ({ kind: "no_change" }),
  forbidden_recovery: () => ({ kind: "forbidden" }),
  blocked,
  allowed: (preview) => proceeding(preview, false),
  allowed_with_custody_exception: (preview) => proceeding(preview, true),
};

export function decideImpact(preview: ImpactLike): ImpactDecision {
  return Object.hasOwn(BY_VERDICT, preview.verdict)
    ? BY_VERDICT[preview.verdict](preview)
    : UNKNOWN;
}
