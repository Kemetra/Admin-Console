import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-621 (RT-574 §5 issue 3) component/integration checks with a mocked 429:
 * exact request counts (no storm), no sign-out, a mutation not retried with its
 * input kept, the gated control disabled then re-enabled, and the banner's
 * live region. The wrapper mocks call `reportRateLimited` the way the
 * openapi-fetch middleware does on a real 429 (the middleware itself is
 * covered in rate-limit.test.ts).
 */
const consoleCreatePayerAccount = vi.fn();
const getActiveContext = vi.fn();
const refreshSession = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    consoleCreatePayerAccount: (...a: unknown[]) => consoleCreatePayerAccount(...a),
    getActiveContext: (...a: unknown[]) => getActiveContext(...a),
    refreshSession: (...a: unknown[]) => refreshSession(...a),
  };
});

import { RateLimitBanner } from "@/components/RateLimitBanner";
import { ActiveContextProvider } from "@/context/ActiveContextProvider";
import { createQueryClient } from "@/lib/query";
import { RateLimitError, reportRateLimited, resetRateLimit } from "@/lib/rate-limit";
import { PayerCreate } from "@/payers/PayerCreate";
import { ProtectedArea } from "@/shell/ProtectedArea";

function tooMany(seconds: number) {
  reportRateLimited(seconds);
  return {
    status: 429,
    data: undefined,
    error: { error: { code: "rate_limited", message: "Too many requests.", request_id: "r1" } },
    headers: new Headers({ "retry-after": String(seconds) }),
  };
}

function withClient(qc = createQueryClient()) {
  return function Tree({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  resetRateLimit();
  consoleCreatePayerAccount.mockReset();
  getActiveContext.mockReset();
  refreshSession.mockReset();
});
afterEach(() => {
  resetRateLimit();
});

describe("mutation on 429", () => {
  test("is not retried, keeps the input, and gates the submit with a countdown", async () => {
    consoleCreatePayerAccount.mockImplementation(async () => tooMany(1));
    const Tree = withClient();
    render(
      <Tree>
        <PayerCreate
          activeTenant={{ id: "t1", name: "Northstar Retail" }}
          stores={[]}
          onClose={vi.fn()}
          onCreated={vi.fn()}
        />
      </Tree>,
    );

    const name = screen.getByLabelText(/display name/i) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "MedCover Insurance" } });
    fireEvent.click(screen.getByRole("button", { name: /create payer/i }));

    const submit = await screen.findByRole("button", { name: /create payer.*wait 1s/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(name.value).toBe("MedCover Insurance");

    // The window ends: the control re-enables, and nothing was sent again.
    await waitFor(
      () =>
        expect(
          (screen.getByRole("button", { name: /^create payer$/i }) as HTMLButtonElement).disabled,
        ).toBe(false),
      { timeout: 2500 },
    );
    expect(consoleCreatePayerAccount).toHaveBeenCalledTimes(1);
    expect(name.value).toBe("MedCover Insurance");
  });
});

describe("read on 429", () => {
  test("is retried exactly once, after Retry-After, never after the 1 s default", async () => {
    const calls: number[] = [];
    const queryFn = vi.fn(async () => {
      calls.push(Date.now());
      if (calls.length === 1) {
        reportRateLimited(2);
        throw new RateLimitError(2);
      }
      throw new RateLimitError(2);
    });
    const { result } = renderHook(() => useQuery({ queryKey: ["r"], queryFn }), {
      wrapper: withClient(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 5000 });
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect(calls[1] - calls[0]).toBeGreaterThanOrEqual(1900);
  });

  test("a read with retry:false is sent once", async () => {
    const queryFn = vi.fn(async () => {
      reportRateLimited(1);
      throw new RateLimitError(1);
    });
    const { result } = renderHook(() => useQuery({ queryKey: ["r2"], queryFn, retry: false }), {
      wrapper: withClient(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    await new Promise((r) => setTimeout(r, 1200));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

describe("RateLimitBanner", () => {
  test("announces once in a polite live region, counts down, then offers a retry", async () => {
    const Tree = withClient();
    render(
      <Tree>
        <RateLimitBanner />
      </Tree>,
    );
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe("");
    expect(screen.queryByText("Too many requests")).toBeNull();

    act(() => reportRateLimited(1));

    expect(screen.getByText("Too many requests")).toBeDefined();
    expect(live.textContent).toBe("You can try again in 1 second.");
    const retry = screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(true);

    await waitFor(() => expect(live.textContent).toBe("You can try again now."), {
      timeout: 2500,
    });
    expect((screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  test("is dismissible and re-opens on the next 429", () => {
    const Tree = withClient();
    render(
      <Tree>
        <RateLimitBanner />
      </Tree>,
    );
    act(() => reportRateLimited(30));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Too many requests")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");

    act(() => reportRateLimited(30));
    expect(screen.getByText("Too many requests")).toBeDefined();
  });

  test("the manual retry re-reads the failed queries once and closes the banner", async () => {
    const qc = createQueryClient();
    const queryFn = vi.fn(async () => {
      throw new Error("refused");
    });
    function Failing() {
      useQuery({ queryKey: ["failing"], queryFn, retry: false });
      return null;
    }
    const Tree = withClient(qc);
    render(
      <Tree>
        <Failing />
        <RateLimitBanner />
      </Tree>,
    );
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));
    act(() => reportRateLimited(1));
    const retry = screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement;
    await waitFor(() => expect(retry.disabled).toBe(false), { timeout: 2500 });

    fireEvent.click(retry);

    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Too many requests")).toBeNull();
  });
});

describe("a 429 never reaches the sign-in page", () => {
  function Where(): React.JSX.Element {
    return <output aria-label="location">{useLocation().pathname}</output>;
  }

  function renderProtected(): void {
    const qc = createQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/"]}>
          <ActiveContextProvider>
            <Routes>
              <Route path="/signin" element={<h1>Sign in</h1>} />
              <Route path="/" element={<ProtectedArea />}>
                <Route index element={<h1>Home</h1>} />
              </Route>
            </Routes>
            <Where />
          </ActiveContextProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  test("context read refused with 429: rate-limit banner, no redirect, no refresh", async () => {
    getActiveContext.mockImplementation(async () => tooMany(120));
    renderProtected();

    expect(await screen.findByText("Too many requests")).toBeDefined();
    expect(screen.getByRole("status", { name: "location" }).textContent).toBe("/");
    expect(screen.queryByText("Sign in")).toBeNull();
    expect(refreshSession).not.toHaveBeenCalled();
    // A 120 s wait is not auto-retried: exactly one request.
    expect(getActiveContext).toHaveBeenCalledTimes(1);
  });

  test("the full-page rate-limit state cannot be dismissed into a blank page", async () => {
    getActiveContext.mockImplementation(async () => tooMany(120));
    renderProtected();

    expect(await screen.findByText("Too many requests")).toBeDefined();
    expect(screen.queryByRole("button", { name: "Dismiss" })).toBeNull();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
  });

  test("a 401 whose refresh is refused with 429 (through the interceptor): no redirect", async () => {
    getActiveContext.mockResolvedValue({ status: 401 });
    refreshSession.mockImplementation(async () => tooMany(120));
    renderProtected();

    expect(await screen.findByText("Too many requests")).toBeDefined();
    expect(screen.getByRole("status", { name: "location" }).textContent).toBe("/");
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(getActiveContext).toHaveBeenCalledTimes(1);
  });
});
