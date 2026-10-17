/**
 * RT-389 publish idempotency. Both publishes are `x-idempotency: required`
 * (16 to 128 printable ASCII characters). A retry of the SAME body (a dropped
 * response, a 5xx, a 425) reuses its key, so the server replays instead of
 * writing a second revision; a different body (including a new
 * `expectedRevisionId` after a refresh) gets a new key, because the same key
 * with another body is a 409 `idempotency_key_conflict`.
 */

/** A v4 UUID: 36 characters, inside `^[\x21-\x7E]{16,128}$`. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/** One publish attempt: the fingerprint of its body and the key that identifies it. */
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
