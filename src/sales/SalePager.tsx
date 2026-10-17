/**
 * RT-587 list notices and paging (spec 012 §8). The result notices are polite
 * status messages; the pager shows the loaded count, Load more while the server
 * returns a cursor, and the end of the walk only for `nextCursor: null`. A
 * refused (400) continuation restarts the walk; any other failure retries it.
 */
import { Banner } from "@/components/Banner";
import { formatNumber, useLocale, useT } from "@/i18n";
import { useEffect, useRef } from "react";
import type { SaleError, SaleListState } from "./useSales";

/**
 * A result notice (empty, not available): the list-state look, announced as a
 * polite status message so a screen reader hears the outcome of a search.
 */
export function Notice({
  message,
  hint,
}: Readonly<{ message: React.ReactNode; hint: string }>): React.JSX.Element {
  return (
    <output className="list-state list-state--empty">
      <span className="list-state__msg">{message}</span>
      <span className="list-state__hint">{hint}</span>
    </output>
  );
}

/** The one non-disclosing state: it never says whether the store exists. */
export function Unavailable(): React.JSX.Element {
  const t = useT();
  return <Notice message={t("sales.list.unavailable")} hint={t("sales.list.unavailableHint")} />;
}

/** A failed continuation: a refused cursor restarts the walk; anything else retries it. */
function InlineFailure({
  list,
  error,
}: Readonly<{ list: SaleListState; error: SaleError }>): React.JSX.Element {
  const t = useT();
  const restart = error.kind === "rejected";
  return (
    <Banner
      variant={restart ? "warning" : "danger"}
      message={t(restart ? "sales.list.cursorRejected" : "sales.list.inlineError")}
      requestId={error.requestId}
      action={
        <button
          type="button"
          className="btn-secondary"
          onClick={restart ? list.restart : list.retry}
        >
          {t(restart ? "sales.list.restart" : "sales.list.retry")}
        </button>
      }
    />
  );
}

/** The walk is over and Load more is gone. */
function walkFinished(list: SaleListState): boolean {
  return list.ended && !list.hasMore;
}

/**
 * Load more unmounts when the last page arrives. If it was used, focus moves to
 * the end-of-list message so keyboard users are not dropped to the page start.
 */
function useEndFocus(list: SaleListState) {
  const endRef = useRef<HTMLOutputElement>(null);
  const pending = useRef(false);
  const finished = walkFinished(list);
  useEffect(() => {
    if (!pending.current || !finished) return;
    pending.current = false;
    endRef.current?.focus();
  }, [finished]);
  const loadMore = () => {
    pending.current = true;
    list.loadMore();
  };
  return { endRef, loadMore };
}

function LoadMore({
  busy,
  onLoad,
}: Readonly<{ busy: boolean; onLoad: () => void }>): React.JSX.Element {
  const t = useT();
  // aria-disabled, not disabled: a disabled button drops keyboard focus while
  // the next page loads. loadMore ignores repeat presses.
  const flag = busy ? true : undefined;
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={onLoad}
      aria-disabled={flag}
      aria-busy={flag}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      {t("sales.list.loadMore")}
    </button>
  );
}

function LoadedCount({ count }: Readonly<{ count: number }>): React.JSX.Element {
  const t = useT();
  const locale = useLocale();
  return (
    <output>
      {t.rich("sales.list.loaded", {
        count: <bdi dir="ltr">{formatNumber(count, locale)}</bdi>,
      })}
    </output>
  );
}

/** Loaded count, the inline continuation error, Load more, and the end of the walk. */
export function Pager({ list }: Readonly<{ list: SaleListState }>): React.JSX.Element {
  const t = useT();
  const { endRef, loadMore } = useEndFocus(list);
  return (
    <>
      {list.inlineError ? <InlineFailure list={list} error={list.inlineError} /> : null}
      <div className="sale-pager">
        <LoadedCount count={list.rows.length} />
        {list.hasMore ? <LoadMore busy={list.isFetchingNextPage} onLoad={loadMore} /> : null}
        {list.ended ? (
          <output ref={endRef} tabIndex={-1}>
            {t("sales.list.ended")}
          </output>
        ) : null}
      </div>
    </>
  );
}
