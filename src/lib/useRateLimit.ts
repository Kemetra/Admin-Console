/**
 * RT-621: React view of the shared Retry-After clock (src/lib/rate-limit.ts).
 * Re-renders on every 429 and once a second while a window runs, so a gated
 * control and the banner count down together.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { getRateLimitState, subscribeRateLimit } from "./rate-limit";

export interface RateLimitView {
  /** A Retry-After is still running: gated controls stay disabled. */
  active: boolean;
  /** Whole seconds left, rounded up; 0 when no window runs. */
  secondsLeft: number;
  /** Bumps on every 429 (0 = none seen yet). */
  seq: number;
  /** Epoch ms of the first 429 of the current window. */
  since: number;
}

export function useRateLimit(): RateLimitView {
  const state = useSyncExternalStore(subscribeRateLimit, getRateLimitState, getRateLimitState);
  // The tick only schedules re-renders; the time is read fresh on each render,
  // so the first frame after a 429 does not count from a stale clock.
  const [, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    if (state.until <= Date.now()) return undefined;
    const id = setInterval(tick, 1000);
    const stop = setTimeout(
      () => {
        tick();
        clearInterval(id);
      },
      state.until - Date.now() + 50,
    );
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [state.until]);

  const msLeft = Math.max(0, state.until - Date.now());
  return {
    active: msLeft > 0,
    secondsLeft: Math.ceil(msLeft / 1000),
    seq: state.seq,
    since: state.since,
  };
}
