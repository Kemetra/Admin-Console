import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const listAuditEvents = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return { ...actual, listAuditEvents: (...a: unknown[]) => listAuditEvents(...a) };
});

import { useAuditSearch } from "@/audit/useAuditSearch";
import { createQueryClient } from "@/lib/query";

function wrapper({ children }: { children: ReactNode }) {
  const qc = createQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function event(id: string) {
  return { id, occurred_at: "2026-06-01T00:00:00Z", action: "auth.signin", request_id: `r-${id}` };
}

/**
 * Cursor pagination (T012, VG-1, OQ-4). useInfiniteQuery over listAuditEvents:
 * getNextPageParam reads next_cursor (null → no more page); the flattened rows
 * come from data.pages.flatMap; "load more" appends the next page. The query is
 * disabled until searched (pre-query state is reachable).
 */
describe("useAuditSearch pagination", () => {
  beforeEach(() => listAuditEvents.mockReset());

  test("disabled until searched -> no call, no rows (pre-query reachable)", async () => {
    const { result } = renderHook(() => useAuditSearch("t1", null, {}, false), { wrapper });
    // give any (unwanted) query a tick
    await new Promise((r) => setTimeout(r, 20));
    expect(listAuditEvents).not.toHaveBeenCalled();
    expect(result.current.rows).toEqual([]);
  });

  test("searched -> first page rows; next_cursor present -> hasMore true", async () => {
    listAuditEvents.mockResolvedValue({
      status: 200,
      data: { items: [event("a"), event("b")], next_cursor: "CUR1" },
    });
    const { result } = renderHook(() => useAuditSearch("t1", null, {}, true), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.hasMore).toBe(true);
  });

  test("next_cursor null -> hasMore false (no more pages)", async () => {
    listAuditEvents.mockResolvedValue({
      status: 200,
      data: { items: [event("a")], next_cursor: null },
    });
    const { result } = renderHook(() => useAuditSearch("t1", null, {}, true), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.hasMore).toBe(false);
  });

  test("loadMore appends the next page (cursor passed through)", async () => {
    listAuditEvents.mockImplementation(async (q?: { cursor?: string }) =>
      q?.cursor === "CUR1"
        ? { status: 200, data: { items: [event("c")], next_cursor: null } }
        : { status: 200, data: { items: [event("a"), event("b")], next_cursor: "CUR1" } },
    );
    const { result } = renderHook(() => useAuditSearch("t1", null, {}, true), { wrapper });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    expect(result.current.rows).toHaveLength(2);
    result.current.loadMore();
    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(result.current.hasMore).toBe(false);
    // second call carried the cursor
    expect(listAuditEvents).toHaveBeenCalledWith(expect.objectContaining({ cursor: "CUR1" }));
  });

  test("RT-269: page 2 fails -> page-1 rows kept, continuation error (not the full error)", async () => {
    listAuditEvents.mockImplementation(async (q?: { cursor?: string }) =>
      q?.cursor === "CUR1"
        ? { status: 503, error: { error: { request_id: "req-p2" } } }
        : { status: 200, data: { items: [event("a"), event("b")], next_cursor: "CUR1" } },
    );
    const { result } = renderHook(() => useAuditSearch("t1", null, {}, true), { wrapper });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    result.current.loadMore();
    await waitFor(() => expect(result.current.continuationError?.kind).toBe("generic"));
    expect(result.current.continuationError?.requestId).toBe("req-p2");
    expect(result.current.error).toBeUndefined();
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  test("RT-269: retryContinuation re-requests the failed cursor only and appends once", async () => {
    let page2Calls = 0;
    listAuditEvents.mockImplementation(async (q?: { cursor?: string }) => {
      if (q?.cursor === "CUR1") {
        page2Calls += 1;
        return page2Calls === 1
          ? { status: 503, error: { error: { request_id: "req-p2" } } }
          : { status: 200, data: { items: [event("c")], next_cursor: null } };
      }
      return { status: 200, data: { items: [event("a"), event("b")], next_cursor: "CUR1" } };
    });
    const { result } = renderHook(() => useAuditSearch("t1", null, {}, true), { wrapper });
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    result.current.loadMore();
    await waitFor(() => expect(result.current.continuationError).toBeDefined());

    result.current.retryContinuation();
    await waitFor(() => expect(result.current.rows).toHaveLength(3));
    expect(result.current.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(result.current.continuationError).toBeUndefined();
    expect(result.current.hasMore).toBe(false);
    // Page 1 was never re-read: the retry continued from the same cursor, it
    // did not re-stitch the list from a fresh first page.
    const firstPageCalls = listAuditEvents.mock.calls.filter(
      ([q]) => (q as { cursor?: string }).cursor === undefined,
    );
    expect(firstPageCalls).toHaveLength(1);
    expect(page2Calls).toBe(2);
  });

  test("RT-269: first-page failure stays a full error, no continuation error", async () => {
    listAuditEvents.mockResolvedValue({ status: 503, error: { error: { request_id: "req-p1" } } });
    const { result } = renderHook(() => useAuditSearch("t1", null, {}, true), { wrapper });
    await waitFor(() => expect(result.current.error?.kind).toBe("generic"));
    expect(result.current.continuationError).toBeUndefined();
    expect(result.current.rows).toEqual([]);
  });

  test("403 -> error result, no rows", async () => {
    listAuditEvents.mockResolvedValue({ status: 403, error: { error: { request_id: "req-403" } } });
    const { result } = renderHook(() => useAuditSearch("t1", null, {}, true), { wrapper });
    await waitFor(() => expect(result.current.error?.kind).toBe("forbidden"));
    expect(result.current.error?.requestId).toBe("req-403");
    expect(result.current.rows).toEqual([]);
  });
});
