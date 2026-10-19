import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// The client layer is the network boundary; stub it (C-5: no live DP2).
vi.mock("@/lib/client", () => ({
  getActiveContext: vi.fn(),
  switchActiveTenant: vi.fn(),
  switchActiveStore: vi.fn(),
  clearActiveStore: vi.fn(),
  refreshSession: vi.fn(),
}));

import { useActiveContext } from "@/context/useActiveContext";
import * as client from "@/lib/client";
import { createQueryClient } from "@/lib/query";

function wrapper({ children }: { children: ReactNode }) {
  const qc = createQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const ctx = (over: Record<string, unknown> = {}) => ({
  status: 200,
  data: {
    user: { id: "u1", email: "a@b.co", is_platform_admin: false },
    active_tenant: { id: "t1", name: "Northstar Retail" },
    active_store: { id: "s1", name: "Cairo Festival City" },
    active_role_code: "tenant_admin",
    memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail" }],
    ...over,
  },
});

describe("useActiveContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("exposes the server-resolved context read-only after fetch", async () => {
    vi.mocked(client.getActiveContext).mockResolvedValue(ctx() as never);
    const { result } = renderHook(() => useActiveContext(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.context?.active_tenant?.name).toBe("Northstar Retail");
    expect(result.current.context?.active_store?.name).toBe("Cairo Festival City");
    expect(result.current.sessionLost).toBe(false);
  });

  test("401 context + failed refresh -> sessionLost (S5), no context", async () => {
    vi.mocked(client.getActiveContext).mockResolvedValue({ status: 401 } as never);
    vi.mocked(client.refreshSession).mockResolvedValue({ status: 401 } as never);
    const { result } = renderHook(() => useActiveContext(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessionLost).toBe(true);
    expect(result.current.context).toBeUndefined();
    expect(client.refreshSession).toHaveBeenCalledTimes(1);
  });

  test("401 context + successful refresh -> retries, returns context", async () => {
    vi.mocked(client.getActiveContext)
      .mockResolvedValueOnce({ status: 401 } as never)
      .mockResolvedValueOnce(ctx() as never);
    vi.mocked(client.refreshSession).mockResolvedValue({ status: 200 } as never);
    const { result } = renderHook(() => useActiveContext(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.sessionLost).toBe(false);
    expect(result.current.context?.active_tenant?.name).toBe("Northstar Retail");
  });

  test("switchTenant calls the mutator then re-fetches getActiveContext", async () => {
    vi.mocked(client.getActiveContext)
      .mockResolvedValueOnce(ctx() as never)
      .mockResolvedValueOnce(
        ctx({ active_tenant: { id: "t2", name: "Helios Markets" }, active_store: null }) as never,
      );
    vi.mocked(client.switchActiveTenant).mockResolvedValue({ status: 200 } as never);

    const { result } = renderHook(() => useActiveContext(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.switchTenant("t2");

    expect(client.switchActiveTenant).toHaveBeenCalledWith("t2");
    await waitFor(() => expect(result.current.context?.active_tenant?.name).toBe("Helios Markets"));
    // tenant switch cleared the store backend-side; re-fetch reflects it
    expect(result.current.context?.active_store).toBeNull();
    // getActiveContext re-fetched (initial + after switch)
    expect(client.getActiveContext).toHaveBeenCalledTimes(2);
  });

  test("does not optimistically mutate; context reflects only re-fetched truth", async () => {
    vi.mocked(client.getActiveContext).mockResolvedValue(ctx() as never);
    vi.mocked(client.switchActiveStore).mockResolvedValue({ status: 200 } as never);

    const { result } = renderHook(() => useActiveContext(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Mutator resolves but re-fetch returns the SAME store → no local optimistic jump
    await result.current.switchStore("s9");
    expect(client.switchActiveStore).toHaveBeenCalledWith("s9");
    expect(result.current.context?.active_store?.id).toBe("s1");
  });
  // RT-621: a 429 never becomes "signed out".
  test("429 context read -> rateLimited, not sessionLost; no refresh", async () => {
    vi.mocked(client.getActiveContext).mockResolvedValue({ status: 429 } as never);
    const { result } = renderHook(() => useActiveContext(), { wrapper });

    await waitFor(() => expect(result.current.rateLimited).toBe(true));
    expect(result.current.sessionLost).toBe(false);
    expect(client.refreshSession).not.toHaveBeenCalled();
  });

  test("401 context + refresh refused with 429 -> rateLimited, not sessionLost", async () => {
    vi.mocked(client.getActiveContext).mockResolvedValue({ status: 401 } as never);
    vi.mocked(client.refreshSession).mockResolvedValue({ status: 429 } as never);
    const { result } = renderHook(() => useActiveContext(), { wrapper });

    await waitFor(() => expect(result.current.rateLimited).toBe(true));
    expect(result.current.sessionLost).toBe(false);
    expect(result.current.context).toBeUndefined();
  });

  test("a 429 on a re-read keeps the context on screen", async () => {
    vi.mocked(client.getActiveContext)
      .mockResolvedValueOnce(ctx() as never)
      .mockResolvedValue({ status: 429 } as never);
    vi.mocked(client.switchActiveStore).mockResolvedValue({ status: 200 } as never);
    const { result } = renderHook(() => useActiveContext(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.switchStore("s9").catch(() => {});

    await waitFor(() => expect(result.current.rateLimited).toBe(true));
    expect(result.current.sessionLost).toBe(false);
    expect(result.current.context?.active_tenant?.name).toBe("Northstar Retail");
  });
});
