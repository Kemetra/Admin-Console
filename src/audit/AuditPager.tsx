/**
 * SF-6-1 pager (T021, OQ-4). A single primary "Load more" driven by `next_cursor`
 * (hidden when there is no next page). No page numbers, no auto-fetch-until-
 * exhausted. A muted count line shows how many rows are loaded.
 */
import "./audit.css";

export interface AuditPagerProps {
  loadedCount: number;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

export function AuditPager({
  loadedCount,
  hasMore,
  isFetchingNextPage,
  onLoadMore,
}: AuditPagerProps): React.JSX.Element {
  return (
    <div className="audit-pager">
      <span className="audit-pager__count">Showing {loadedCount}</span>
      {hasMore ? (
        <button
          type="button"
          className="btn-secondary"
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? <span className="spinner" aria-hidden="true" /> : null}
          Load more
        </button>
      ) : null}
    </div>
  );
}
