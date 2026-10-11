/**
 * 018 receivable-list keyset pagination — pure helpers (no client/React/generated
 * types). The useInfiniteQuery binding (018-B) calls these: `nextReceivableCursor`
 * is the getNextPageParam rule (null → undefined stops in v5), `flattenReceivablePages`
 * is the data.pages.flatMap projection. Mirrors 017's payerListLogic.
 */
import type { MessageKey } from "@/i18n";

export interface ReceivableRow {
  receivableRef: string;
}

export interface ReceivableListPage {
  items: ReceivableRow[];
  nextCursor: string | null;
}

export function nextReceivableCursor(page: ReceivableListPage): string | undefined {
  return page.nextCursor ?? undefined;
}

export function flattenReceivablePages(pages: readonly ReceivableListPage[]): ReceivableRow[] {
  return pages.flatMap((page) => page.items);
}

// --- Display labels (RT-399) -------------------------------------------------
// Machine codes drive copy; they are not copy (UX-12). The raw `state` /
// `outcome` values stay as the API sent them; only their labels are localized.

const STATE_KEYS: Record<string, MessageKey> = {
  open: "receivables.state.open",
  partially_applied: "receivables.state.partially_applied",
  settled: "receivables.state.settled",
  claimed: "receivables.state.claimed",
  flagged: "receivables.state.flagged",
};

/**
 * The label key for a receivable lifecycle state. The lifecycle grows by
 * additive bumps (e.g. `reversal_consumed` after DP-026), so an unknown state
 * gets a localized fallback, never the raw value.
 */
export function receivableStateKey(state: string): MessageKey {
  return Object.hasOwn(STATE_KEYS, state) ? STATE_KEYS[state] : "receivables.state.unknown";
}

const OUTCOME_KEYS: Record<string, MessageKey> = {
  settled: "receivables.outcome.settled",
  partial: "receivables.outcome.partial",
  flagged: "receivables.outcome.flagged",
};

/** The label key for a remittance reconciliation outcome (settled | partial | flagged). */
export function reconciliationOutcomeKey(outcome: string): MessageKey {
  return Object.hasOwn(OUTCOME_KEYS, outcome)
    ? OUTCOME_KEYS[outcome]
    : "receivables.outcome.unknown";
}
