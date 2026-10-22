/**
 * RT-768 (RT-752 D7, UX-08 "Long-form recovery"): the shared error summary of a
 * full-page form. A blocked submit shows it at the top of the form and moves
 * focus to it; it lists each field error in field order as a link that focuses
 * the field. The same errors stay inline on the fields (`aria-invalid` +
 * `aria-describedby`), so the summary adds a way in, not a second copy to fix.
 *
 * What is NOT in it: context errors (stale, retired, origin, 404, 429, 500).
 * Those are a `Banner` above it. Small drawer forms do not use it.
 *
 * A link never navigates: a bare hash link would push a history entry and could
 * trip the unsaved-work guard (RT-268), so the click focuses the field itself.
 * The region is labelled by its heading, so focusing it reads the problem count.
 */
import { useT } from "@/i18n";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import "./form-error-summary.css";

export interface SummaryEntry {
  /** The id of the field the entry points at. */
  fieldId: string;
  /** Already-translated error text: the same words as the inline error. */
  message: string;
}

export interface FormErrorSummaryProps {
  /** In field order. Nothing renders when it is empty. */
  entries: readonly SummaryEntry[];
  ref?: React.Ref<HTMLElement>;
}

function focusField(event: React.MouseEvent<HTMLAnchorElement>, fieldId: string): void {
  event.preventDefault();
  const field = document.getElementById(fieldId);
  field?.focus();
  field?.scrollIntoView?.({ block: "center" });
}

export function FormErrorSummary({
  entries,
  ref,
}: Readonly<FormErrorSummaryProps>): React.JSX.Element | null {
  const t = useT();
  const titleId = useId();
  if (entries.length === 0) return null;
  const title = t("components.errorSummary.title", { count: entries.length });
  return (
    <section ref={ref} className="form-error-summary" aria-labelledby={titleId} tabIndex={-1}>
      <h2 id={titleId} className="form-error-summary__title">
        {title}
      </h2>
      <ul className="form-error-summary__list">
        {entries.map((entry) => (
          <li key={entry.fieldId}>
            <a href={`#${entry.fieldId}`} onClick={(e) => focusField(e, entry.fieldId)}>
              {entry.message}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Focus for the summary. `focusSummary()` is called on every blocked submit,
 * including when the summary is already showing; the focus happens after the
 * render that mounts it, so the first blocked submit works too.
 */
export function useSummaryFocus(): {
  ref: React.RefObject<HTMLElement | null>;
  focusSummary: () => void;
} {
  const ref = useRef<HTMLElement | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (attempt > 0) ref.current?.focus();
  }, [attempt]);
  const focusSummary = useCallback(() => setAttempt((n) => n + 1), []);
  return { ref, focusSummary };
}
