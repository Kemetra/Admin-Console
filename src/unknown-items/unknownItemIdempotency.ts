/**
 * RT-724 idempotency for the keyed review-queue writes (reopen, bulk dismiss).
 * Both carry a required `Idempotency-Key` (16 to 128 printable ASCII). The key
 * belongs to the request body, not to the click: a manual retry of the SAME
 * body (after a dropped response, a 5xx or a 425) reuses it, so the server
 * replays instead of reopening or dismissing twice; a different body gets a
 * new key, because the same key with another body is a 409
 * `idempotency_key_conflict`. Nothing here retries on its own.
 */
import type { UnknownItemErrorRender } from "@/lib/unknown-items-queries";

/** A v4 UUID: 36 characters, inside `^[\x21-\x7E]{16,128}$`. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** One keyed attempt: the fingerprint of its body and the key that identifies it. */
export interface KeyedAttempt {
  fingerprint: string;
  key: string;
}

export function reuseOrNewKey(
  previous: KeyedAttempt | undefined,
  fingerprint: string,
): KeyedAttempt {
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, key: newIdempotencyKey() };
}

/**
 * Whether a failed attempt's key may be replayed. Only an outcome the server
 * may not have settled (a retryable 5xx, a 425 still in flight) keeps it; every
 * other outcome is final for that key, so the next attempt mints a new one.
 */
export function keepsKey(render: UnknownItemErrorRender): boolean {
  return render.kind === "in-progress" || (render.kind === "banner" && render.retryable);
}
