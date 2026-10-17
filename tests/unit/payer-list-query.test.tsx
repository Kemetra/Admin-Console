import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const consoleListPayerAccounts = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    consoleListPayerAccounts: (...a: unknown[]) => consoleListPayerAccounts(...a),
  };
});

import { createQueryClient } from "@/lib/query";
import { usePayerAccounts } from "@/payers/usePayerAccounts";

function wrapper({ children }: { children: ReactNode }) {
  const qc = createQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function payer(payerRef: string) {
  return {
    payerRef,
    category: "credit_customer",
    displayName: `Acme ${payerRef}`,
    externalRef: null,
    status: "active",
    storeId: null,
    version: 0,
  };
}

/**
 * 017 payer-list query hook (useInfiniteQuery over consoleListPayerAccounts,
 * scope-keyed). Mirrors useAuditSearch: getNextPageParam from nextCursor (null →
 * undefined stops), rows flatten across pages, 403 → forbidden / other → generic.
 */
describe("usePayerAccounts", () => {
  // A block body: an arrow that RETURNS the mock would make vitest call it as a
  // cleanup hook (with no arguments) after every test.
  beforeEach(() => {
    consoleListPayerAccounts.mockReset();
  });

  test("no active tenant -> disabled, no call, no rows", async () => {
    const { result } = renderHook(() => usePayerAccounts(null, {}), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(consoleListPayerAccounts).not.toHaveBeenCalled();
    expect(result.current.rows).toEqual([]);
  });

  test("first page rows; nextCursor present -> hasMore true", async () => {
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: { items: [payer("a"), payer("b")], nextCursor: "CUR1" },
    });
    const { result } = renderHook(() => usePayerAccounts("t1", {}), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.hasMore).toBe(true);
  });

  test("nextCursor null -> hasMore false (last page)", async () => {
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: { items: [payer("a")], nextCursor: null },
    });
    const { result } = renderHook(() => usePayerAccounts("t1", {}), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.hasMore).toBe(false);
  });

  test("403 -> forbidden error, no rows", async () => {
    consoleListPayerAccounts.mockResolvedValue({ status: 403, error: { error: {} } });
    const { result } = renderHook(() => usePayerAccounts("t1", {}), { wrapper });
    await waitFor(() => expect(result.current.error?.kind).toBe("forbidden"));
    expect(result.current.rows).toEqual([]);
  });

  test.each([400, 404, 422, 500])(
    "%s -> a generic error that carries only the request id, never the server's words",
    async (status) => {
      consoleListPayerAccounts.mockResolvedValue({
        status,
        error: { error: { code: "secret_code", message: "secret cause", request_id: "req-9" } },
      });
      const { result } = renderHook(() => usePayerAccounts("t1", {}), { wrapper });
      await waitFor(() => expect(result.current.error).toBeDefined());
      expect(result.current.error).toEqual({ kind: "generic", requestId: "req-9" });
      expect(JSON.stringify(result.current.error)).not.toContain("secret");
    },
  );

  test("401 -> a session error (the interceptor owns the redirect)", async () => {
    consoleListPayerAccounts.mockResolvedValue({ status: 401, error: { error: {} } });
    const { result } = renderHook(() => usePayerAccounts("t1", {}), { wrapper });
    await waitFor(() => expect(result.current.error?.kind).toBe("session"));
  });

  test("an empty page with a non-null cursor is not the end: hasMore stays true and loadMore walks on", async () => {
    consoleListPayerAccounts.mockImplementation((q: { cursor?: string }) =>
      Promise.resolve(
        q.cursor === "CUR1"
          ? { status: 200, data: { items: [payer("a")], nextCursor: null } }
          : { status: 200, data: { items: [], nextCursor: "CUR1" } },
      ),
    );
    const { result } = renderHook(() => usePayerAccounts("t1", {}), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.hasMore).toBe(true);
    result.current.loadMore();
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.hasMore).toBe(false);
    expect(consoleListPayerAccounts).toHaveBeenLastCalledWith({ cursor: "CUR1" });
  });

  test("a failed continuation keeps the rows already fetched and reports the error", async () => {
    consoleListPayerAccounts.mockImplementation((q: { cursor?: string }) =>
      Promise.resolve(
        q.cursor === "CUR1"
          ? { status: 400, error: { error: { request_id: "req-bad-cursor" } } }
          : { status: 200, data: { items: [payer("a")], nextCursor: "CUR1" } },
      ),
    );
    const { result } = renderHook(() => usePayerAccounts("t1", {}), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    result.current.loadMore();
    await waitFor(() => expect(result.current.error?.kind).toBe("generic"));
    expect(result.current.rows).toHaveLength(1);
  });

  test("zero-account tenant -> empty rows, not an error", async () => {
    consoleListPayerAccounts.mockResolvedValue({
      status: 200,
      data: { items: [], nextCursor: null },
    });
    const { result } = renderHook(() => usePayerAccounts("t1", {}), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });
});
