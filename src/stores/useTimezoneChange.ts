import type { StoreTimezoneChangePreview, StoreUpdateBody } from "@/lib/rf2-queries";
import { isIanaTimezone } from "@/lib/timezones";
/**
 * The store form's time zone state (RT-477, RT-401). The user picks a zone; if
 * it differs from the store's current one the impact is previewed, and only a
 * reviewed, unblocked preview lets the zone travel with the save. The contract
 * wants `timezone`, `expected_current_timezone` and `timezone_impact_reviewed`
 * together or not at all, so `payload()` returns all three or an empty object.
 */
import { useState } from "react";
import { type TimezonePreviewResult, useTimezonePreview } from "./useStoreQueries";

export interface TimezoneChange {
  zone: string;
  select: (zone: string) => void;
  /** Withdraw the review, e.g. after the store's zone changed under the user. */
  resetReview: () => void;
  reviewed: boolean;
  setReviewed: (reviewed: boolean) => void;
  /** The chosen zone differs from the store's current one. */
  changed: boolean;
  isPreviewing: boolean;
  previewResult: TimezonePreviewResult | undefined;
  /** The server says the change would not change the zone. */
  noOp: boolean;
  /** A shift is open: the server would refuse the change. */
  blocked: boolean;
  /** The form may be saved: nothing to review, or a reviewed unblocked change. */
  canSave: boolean;
  /** The zone fields for `PATCH`, all three together or none. */
  payload: () => ZonePayload;
}

function previewOf(result: TimezonePreviewResult | undefined) {
  return result?.kind === "preview" ? result.preview : undefined;
}

function hasBlocker(preview: StoreTimezoneChangePreview | undefined): boolean {
  return (preview?.blockers.length ?? 0) > 0;
}

type ZonePayload = Pick<
  StoreUpdateBody,
  "timezone" | "expected_current_timezone" | "timezone_impact_reviewed"
>;

/** All three zone fields from a reviewed preview, or none (the contract's all-or-none rule). */
function zonePayload(zone: string, preview: StoreTimezoneChangePreview | undefined): ZonePayload {
  if (!preview || preview.no_op) return {};
  return {
    timezone: zone,
    expected_current_timezone: preview.current_timezone,
    timezone_impact_reviewed: true,
  };
}

interface ReviewState {
  noOp: boolean;
  blocked: boolean;
  /** Nothing to review, or a reviewed unblocked change. */
  canSave: boolean;
}

function reviewState(
  changed: boolean,
  preview: StoreTimezoneChangePreview | undefined,
  reviewed: boolean,
): ReviewState {
  const noOp = preview?.no_op === true;
  const blocked = hasBlocker(preview);
  const ready = preview !== undefined && !blocked && (noOp || reviewed);
  return { noOp, blocked, canSave: !changed || ready };
}

/**
 * @param storeId the store being edited; undefined on create (no preview).
 * @param currentZone the store's stored zone; undefined on create.
 * @param initialZone the zone the select starts on.
 */
export function useTimezoneChange(
  storeId: string | undefined,
  currentZone: string | undefined,
  initialZone: string,
): TimezoneChange {
  // Until the user picks a zone the select follows the store's, so a store that
  // was re-read (someone else changed its zone) is never silently reverted.
  const [picked, setPicked] = useState<string | undefined>();
  // The review is of one preview: a refetched preview (new `now`) asks again.
  const [reviewedAt, setReviewedAt] = useState<string | undefined>();
  const zone = picked ?? currentZone ?? initialZone;
  const changed = Boolean(currentZone) && isIanaTimezone(zone) && zone !== currentZone;
  const { result, isLoading } = useTimezonePreview(storeId, changed ? zone : undefined);
  const preview = previewOf(result);
  const reviewed = preview !== undefined && reviewedAt === preview.now;
  const { noOp, blocked, canSave } = reviewState(changed, preview, reviewed);

  return {
    zone,
    select: (next) => {
      setPicked(next);
      setReviewedAt(undefined);
    },
    resetReview: () => setReviewedAt(undefined),
    reviewed,
    setReviewed: (value) => setReviewedAt(value ? preview?.now : undefined),
    changed,
    isPreviewing: isLoading,
    previewResult: result,
    noOp,
    blocked,
    canSave,
    payload: () => (changed ? zonePayload(zone, preview) : {}),
  };
}
