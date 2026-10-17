/**
 * RT-372 — Run an async action at most once at a time. A pairing-code issue is
 * non-replayable (each call mints a new code under a new idempotency key), so a
 * second click or Enter before React has re-rendered the button as disabled must
 * not start a second request. The guard is a ref, set before the first await and
 * cleared when the action settles.
 */
import { useRef } from "react";

export function useSingleFlight(): (action: () => Promise<void>) => Promise<void> {
  const busy = useRef(false);
  return async (action) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } finally {
      busy.current = false;
    }
  };
}
