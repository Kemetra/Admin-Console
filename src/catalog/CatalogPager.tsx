/**
 * RT-765 list notices and paging (CAT-C1a). The result notices are polite status
 * messages; the pager shows the loaded count (never a total: the contract has
 * none), Load more while the server returns a cursor, and the end of the walk
 * only for `nextCursor: null`. A refused (400) continuation restarts the walk;
 * any other failure retries it.
 */
import { Banner } from "@/components/Banner";
import { GatedButton } from "@/components/GatedButton";
import { formatNumber, useLocale, useT } from "@/i18n";
import { useEffect, useRef } from "react";
import type { CatalogError, CatalogListState } from "./useCatalog";

/**
 * A result notice (empty, not available): the list-state look, announced as a
 * polite status message so a screen reader hears the outcome of a search.
 */
export function Notice({
  message,
  hint,
  action,
}: Readonly<{
  message: React.ReactNode;
  hint: string;
  action?: React.ReactNode;
}>): React.JSX.Element {
  return (
    <output className="list-state list-state--empty">
      <span className="list-state__msg">{message}</span>
      <span className="list-state__hint">{hint}</span>
      {action ? <span className="list-state__action">{action}</span> : null}
    </output>
  );
}

/** The one non-disclosing state: it never says why the catalog is refused. */
export function Unavailable(): React.JSX.Element {
  const t = useT();
  return (
    <Notice message={t("catalog.list.unavailable")} hint={t("catalog.list.unavailableHint")} />
  );
}

/** A 404 with a store in scope: the store, not the catalog, is the problem. */
export function StoreStale(): React.JSX.Element {
  const t = useT();
  return <Notice message={t("catalog.list.storeStale")} hint={t("catalog.list.storeStaleHint")} />;
}

/**
 * A failed continuation. The rows stay. A refused cursor restarts the walk; a
 * 404 (the store left scope mid-walk) and a 401 (the session ended) cannot
 * succeed on retry, so they say so and offer none; anything else retries.
 */
function InlineFailure({
  list,
  error,
  storeInScope,
}: Readonly<{
  list: CatalogListState;
  error: CatalogError;
  storeInScope: boolean;
}>): React.JSX.Element {
  const t = useT();
  if (error.kind === "not-found") {
    return (
      <Banner
        variant="warning"
        message={t(storeInScope ? "catalog.list.storeStale" : "catalog.list.unavailable")}
        requestId={error.requestId}
      />
    );
  }
  if (error.kind === "session") {
    return (
      <Banner
        variant="danger"
        message={t("catalog.list.sessionExpired")}
        requestId={error.requestId}
      />
    );
  }
  const restart = error.kind === "rejected";
  return (
    <Banner
      variant={restart ? "warning" : "danger"}
      message={t(restart ? "catalog.list.cursorRejected" : "catalog.list.inlineError")}
      requestId={error.requestId}
      action={
        <button
          type="button"
          className="btn-secondary"
          onClick={restart ? list.restart : list.retry}
        >
          {t(restart ? "catalog.list.restart" : "catalog.list.retry")}
        </button>
      }
    />
  );
}

/** The walk is over and Load more is gone. */
function walkFinished(list: CatalogListState): boolean {
  return list.ended && !list.hasMore;
}

/**
 * Load more unmounts when the last page arrives. If it was what asked for that
 * page, focus moves to the end-of-list message so a keyboard user is not
 * dropped back to the top of the page.
 */
function useEndFocus(list: CatalogListState) {
  const endRef = useRef<HTMLOutputElement>(null);
  const askedForMore = useRef(false);
  const finished = walkFinished(list);
  useEffect(() => {
    if (finished && askedForMore.current) {
      askedForMore.current = false;
      endRef.current?.focus();
    }
  }, [finished]);
  const loadMore = () => {
    askedForMore.current = true;
    list.loadMore();
  };
  return { endRef, loadMore };
}

/**
 * aria-disabled, not disabled, while the next page loads: a disabled button
 * drops keyboard focus. `loadMore` ignores repeat presses.
 */
const BUSY_PROPS = { "aria-disabled": true, "aria-busy": true } as const;

function LoadMore({
  busy,
  onLoad,
}: Readonly<{ busy: boolean; onLoad: () => void }>): React.JSX.Element {
  const t = useT();
  return (
    <GatedButton
      type="button"
      className="btn-secondary"
      onClick={onLoad}
      {...(busy ? BUSY_PROPS : {})}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      {t("catalog.list.loadMore")}
    </GatedButton>
  );
}

function LoadedCount({ count }: Readonly<{ count: number }>): React.JSX.Element {
  const t = useT();
  const locale = useLocale();
  return (
    <output>
      {t.rich("catalog.list.loaded", {
        count: <bdi dir="ltr">{formatNumber(count, locale)}</bdi>,
      })}
    </output>
  );
}

/** Loaded count, the inline continuation error, Load more, and the end of the walk. */
export function Pager({
  list,
  storeInScope,
}: Readonly<{ list: CatalogListState; storeInScope: boolean }>): React.JSX.Element {
  const t = useT();
  const { endRef, loadMore } = useEndFocus(list);
  return (
    <>
      {list.inlineError ? (
        <InlineFailure list={list} error={list.inlineError} storeInScope={storeInScope} />
      ) : null}
      <div className="catalog-pager">
        <LoadedCount count={list.rows.length} />
        {list.hasMore ? <LoadMore busy={list.isFetchingNextPage} onLoad={loadMore} /> : null}
        {list.ended ? (
          <output ref={endRef} tabIndex={-1}>
            {t("catalog.list.ended")}
          </output>
        ) : null}
      </div>
    </>
  );
}
