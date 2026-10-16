import type { MessageKey } from "@/i18n";
import type { Rf2ErrorRender } from "@/lib/rf2-queries";
/**
 * Where a failed store save is shown (RT-400, RT-477): inline on the code or
 * time zone field, as a page banner, or as the scope prompt. The inline errors
 * are catalog keys, never translated strings, so a locale switch re-renders
 * them.
 */
import { useState } from "react";

/**
 * Rejections that make the reviewed preview stale: the zone moved under the
 * user, or a shift opened after the preview was taken.
 */
const TIMEZONE_STALE: ReadonlySet<string> = new Set([
  "stores.errors.timezoneChangedConcurrently",
  "stores.errors.storeHasOpenShift",
]);

export interface StoreFormErrors {
  codeError: MessageKey | undefined;
  timezoneError: MessageKey | undefined;
  banner: Rf2ErrorRender | undefined;
  /** A residual 401: the form gives way to the scope prompt, never a sign-out (OQ-4). */
  scopeLost: boolean;
  /** Route a failure render to its place. */
  show: (render: Rf2ErrorRender) => void;
  setBanner: (render: Rf2ErrorRender | undefined) => void;
  setTimezoneError: (key: MessageKey | undefined) => void;
  /** Clear every error before a new attempt. */
  clear: () => void;
}

/** @param onStaleTimezone called when the reviewed preview went stale (see TIMEZONE_STALE). */
export function useStoreFormErrors(onStaleTimezone: () => void): StoreFormErrors {
  const [codeError, setCodeError] = useState<MessageKey | undefined>();
  const [timezoneError, setTimezoneError] = useState<MessageKey | undefined>();
  const [banner, setBanner] = useState<Rf2ErrorRender | undefined>();
  const [scopeLost, setScopeLost] = useState(false);

  function show(render: Rf2ErrorRender): void {
    if (render.kind === "scope-required") {
      setScopeLost(true);
    } else if (render.kind === "conflict" && render.field === "code") {
      setCodeError(render.messageKey);
    } else if (render.kind === "field-error") {
      setTimezoneError(render.messageKey);
    } else {
      if (render.kind === "banner" && TIMEZONE_STALE.has(render.messageKey)) onStaleTimezone();
      setBanner(render);
    }
  }

  return {
    codeError,
    timezoneError,
    banner,
    scopeLost,
    show,
    setBanner,
    setTimezoneError,
    clear: () => {
      setCodeError(undefined);
      setTimezoneError(undefined);
      setBanner(undefined);
    },
  };
}
