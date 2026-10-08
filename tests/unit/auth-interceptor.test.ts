import { createAuthRetry } from "@/lib/auth-interceptor";
import { type Mock, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The 401 reactive-refresh interceptor (T009, OQ-2, Scenario S5).
 *
 * Behavior under test (no browser, pure logic):
 *  - A non-401 response passes through untouched.
 *  - A 401 triggers exactly ONE refreshSession; on success the original
 *    request is retried once and its result returned.
 *  - If the refresh itself 401s (or fails), the cache is cleared and a
 *    redirect-to-SF-1 is signalled; the original is NOT retried again.
 *  - Only one refresh happens even if several 401s arrive concurrently.
 */
describe("createAuthRetry", () => {
  let refreshSession: Mock<() => Promise<{ ok: boolean }>>;
  let onSessionLost: Mock<() => void>;

  beforeEach(() => {
    refreshSession = vi.fn();
    onSessionLost = vi.fn();
  });

  test("passes a successful response through without refreshing", async () => {
    const retry = createAuthRetry({ refreshSession, onSessionLost });
    const original = vi.fn().mockResolvedValue({ status: 200, data: "ok" });

    const result = await retry(original);

    expect(result).toEqual({ status: 200, data: "ok" });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(original).toHaveBeenCalledTimes(1);
  });

  test("on 401, refreshes once then retries the original and returns its result", async () => {
    refreshSession.mockResolvedValue({ ok: true });
    const retry = createAuthRetry({ refreshSession, onSessionLost });
    const original = vi
      .fn()
      .mockResolvedValueOnce({ status: 401 })
      .mockResolvedValueOnce({ status: 200, data: "ok" });

    const result = await retry(original);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ status: 200, data: "ok" });
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  test("if refresh also fails, signals session lost and does not retry again", async () => {
    refreshSession.mockResolvedValue({ ok: false });
    const retry = createAuthRetry({ refreshSession, onSessionLost });
    const original = vi.fn().mockResolvedValue({ status: 401 });

    const result = await retry(original);

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(original).toHaveBeenCalledTimes(1);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 401 });
  });

  test("coalesces concurrent 401s into a single refresh", async () => {
    let resolveRefresh: (v: { ok: boolean }) => void = () => {};
    refreshSession.mockReturnValue(
      new Promise((r) => {
        resolveRefresh = r;
      }),
    );
    const retry = createAuthRetry({ refreshSession, onSessionLost });
    const makeOriginal = () =>
      vi.fn().mockResolvedValueOnce({ status: 401 }).mockResolvedValueOnce({ status: 200 });

    const p1 = retry(makeOriginal());
    const p2 = retry(makeOriginal());
    resolveRefresh({ ok: true });
    await Promise.all([p1, p2]);

    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
});
