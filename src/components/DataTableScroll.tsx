/**
 * Inline-axis scroll region around a list table (RT-826, RT-785 decision D4: a
 * wide table scrolls inside its own region, never as a card layout and never by
 * widening `.content`). A scroll container must be keyboard-reachable (axe
 * scrollable-region-focusable), so it is a tab stop; it is named by the table's
 * visually-hidden caption so a screen reader announces "Stores, region".
 */
import { useId } from "react";
import "./data-table.css";

export function DataTableScroll({
  captionId,
  children,
}: Readonly<{ captionId: string; children: React.ReactNode }>): React.JSX.Element {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll container must be keyboard-focusable
    <section className="data-table__scroll" aria-labelledby={captionId} tabIndex={0}>
      {children}
    </section>
  );
}

/** Stable per-instance id linking the region to its table caption. */
export function useCaptionId(): string {
  return `data-table-caption-${useId()}`;
}
