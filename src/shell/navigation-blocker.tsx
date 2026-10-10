/**
 * RT-268 — blocks in-app navigation (links, back/forward) while a form holds
 * unsaved work and asks Stay / Discard. Needs a data router (App uses
 * createBrowserRouter). A post-save redirect carrying SAVED_NAVIGATION passes
 * straight through.
 */
import { useEffect, useRef } from "react";
import { type Blocker, type Location, useBlocker } from "react-router";
import { SAVED_NAVIGATION, useDirtyGuard } from "./dirty-guard";

function isSavedRedirect(location: Location): boolean {
  const state = location.state as { dirtyGuard?: string } | null;
  return state?.dirtyGuard === SAVED_NAVIGATION.dirtyGuard;
}

function changesPage(from: Location, to: Location): boolean {
  return from.pathname !== to.pathname || from.search !== to.search;
}

/** Apply the user's answer, unless the blocked navigation is already gone. */
function resolveBlocked(blocker: Blocker, leave: boolean): void {
  if (blocker.state !== "blocked") return;
  if (leave) blocker.proceed();
  else blocker.reset();
}

export function NavigationBlocker(): null {
  const guard = useDirtyGuard();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !isSavedRedirect(nextLocation) &&
      changesPage(currentLocation, nextLocation) &&
      guard.isDirty(),
  );
  const latest = useRef(blocker);
  latest.current = blocker;

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    void guard.confirmLeave().then((leave) => resolveBlocked(latest.current, leave));
  }, [blocker.state, guard]);

  return null;
}
