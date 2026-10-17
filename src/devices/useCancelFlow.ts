/**
 * RT-372 — The cancel of a pending pairing code, as the page drives it: which code
 * is awaiting its confirm, and what the last cancel answered. Cancelling is
 * idempotent on the server (`already_cancelled` is a success); a used code can't
 * be cancelled, and a refusal never reads as success.
 */
import type { MessageKey } from "@/i18n";
import type { PairingCodeSummary } from "@/lib/device-queries";
import { useState } from "react";
import { classifyMutationFailure, requestIdOfFailure } from "./lifecycleFailure";
import { useCancelPairingCode } from "./usePairingCodes";

export interface CancelResult {
  key: MessageKey;
  variant: "success" | "warning" | "danger";
  requestId?: string;
}

const CANCEL_FAILURE_KEYS: Readonly<Record<string, MessageKey>> = {
  conflict: "devices.codes.error.used",
  "not-found": "devices.codes.error.notFound",
  session: "devices.list.sessionExpired",
};

/** What a refused cancel reads as: a used code is a warning, the rest are danger. */
function failureResult(res: Parameters<typeof classifyMutationFailure>[0]): CancelResult {
  const failure = classifyMutationFailure(res);
  return {
    key: CANCEL_FAILURE_KEYS[failure.kind] ?? "devices.codes.error.generic",
    variant: failure.kind === "conflict" ? "warning" : "danger",
    requestId: requestIdOfFailure(failure),
  };
}

function successResult(outcome: string): CancelResult {
  return {
    key:
      outcome === "already_cancelled"
        ? "devices.codes.alreadyCancelled"
        : "devices.codes.cancelled",
    variant: "success",
  };
}

export interface CancelFlow {
  confirming: PairingCodeSummary | null;
  result?: CancelResult;
  pending: boolean;
  ask: (code: PairingCodeSummary) => void;
  keep: () => void;
  confirm: (code: PairingCodeSummary) => Promise<void>;
}

export function useCancelFlow(): CancelFlow {
  const cancel = useCancelPairingCode();
  const [confirming, setConfirming] = useState<PairingCodeSummary | null>(null);
  const [result, setResult] = useState<CancelResult | undefined>();

  async function confirm(code: PairingCodeSummary): Promise<void> {
    setResult(undefined);
    try {
      const res = await cancel.mutateAsync(code.pairingCodeId);
      setResult(
        res.status === 200 && res.data ? successResult(res.data.outcome) : failureResult(res),
      );
    } catch {
      setResult({ key: "devices.codes.error.generic", variant: "danger" });
    }
    setConfirming(null);
  }

  return {
    confirming,
    result,
    pending: cancel.isPending,
    ask: setConfirming,
    keep: () => setConfirming(null),
    confirm,
  };
}
