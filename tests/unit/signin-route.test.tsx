import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

// RT-343: the active context is first fetched while signed out (401, then a
// failed refresh), so the cache holds `session-lost`. A successful sign-in must
// not leave that stale entry in place, whatever the sign-in body lists:
// otherwise ProtectedArea bounces the now-authenticated user back to /signin.
const getActiveContext = vi.fn();
const signIn = vi.fn();
const refreshSession = vi.fn();
const switchActiveTenant = vi.fn(async (_tenantId: string) => ({ status: 200 }));
vi.mock("@/lib/client", () => ({
  getActiveContext: (...a: unknown[]) => getActiveContext(...a),
  signIn: (...a: unknown[]) => signIn(...a),
  refreshSession: (...a: unknown[]) => refreshSession(...a),
  switchActiveTenant: (tenantId: string) => switchActiveTenant(tenantId),
  switchActiveStore: vi.fn(),
  clearActiveStore: vi.fn(),
  signOut: vi.fn(),
}));

import { ActiveContextProvider } from "@/context/ActiveContextProvider";
import { createQueryClient } from "@/lib/query";
import { Overview } from "@/shell/Overview";
import { ProtectedArea } from "@/shell/ProtectedArea";
import { SignInRoute } from "@/shell/SignInRoute";

const signedOut = { status: 401, error: { error: { code: "unauthorized" } } };

function renderSignIn(): void {
  const qc = createQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/signin"]}>
        <ActiveContextProvider>
          <Routes>
            <Route path="/signin" element={<SignInRoute />} />
            <Route path="/" element={<ProtectedArea />}>
              <Route index element={<Overview />} />
            </Route>
          </Routes>
        </ActiveContextProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The signed-out fetch has finished: 401, then the failed refresh. */
async function signedOutContextSettled(): Promise<void> {
  await vi.waitFor(() => expect(refreshSession).toHaveBeenCalled());
  await new Promise((done) => setTimeout(done, 0));
}

function submitCredentials(): void {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.co" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password1" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
}

describe("sign-in route enters the console with a fresh context (RT-343)", () => {
  const tenantContext = {
    status: 200,
    data: {
      user: { display_name: "Amal Saleh" },
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: null,
      active_role_code: "tenant_admin",
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail" }],
    },
  };

  beforeEach(() => {
    getActiveContext.mockReset();
    signIn.mockReset();
    refreshSession.mockReset().mockResolvedValue({ status: 401 });
  });

  test("sign-in body without memberships still enters the shell", async () => {
    getActiveContext.mockResolvedValueOnce(signedOut).mockResolvedValue(tenantContext);
    signIn.mockResolvedValue({ status: 200, data: { user: { id: "u1" }, memberships: [] } });

    renderSignIn();
    await signedOutContextSettled();
    submitCredentials();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeDefined();
  });

  /**
   * Holds the signed-out fetch open, submits, and releases it only once a fresh
   * context fetch has started: if the post-sign-in invalidation joined the
   * stale fetch instead, that second call never comes and this times out.
   */
  async function signInWhileSignedOutFetchRuns(membershipsInBody: unknown[]): Promise<void> {
    let finishSignedOutFetch: (value: unknown) => void = () => {};
    getActiveContext
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            finishSignedOutFetch = done;
          }),
      )
      .mockResolvedValue(tenantContext);
    signIn.mockResolvedValue({
      status: 200,
      data: { user: { id: "u1" }, memberships: membershipsInBody },
    });

    renderSignIn();
    await vi.waitFor(() => expect(getActiveContext).toHaveBeenCalledTimes(1));
    submitCredentials();
    await vi.waitFor(() => expect(getActiveContext).toHaveBeenCalledTimes(2));
    finishSignedOutFetch(signedOut);
  }

  test("a sign-in submitted while the signed-out fetch is still running still enters the shell", async () => {
    await signInWhileSignedOutFetchRuns([]);

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeDefined();
  });

  test("a single-tenant sign-in during the signed-out fetch selects the tenant and enters the shell", async () => {
    await signInWhileSignedOutFetchRuns([{ tenant_id: "t1", tenant_name: "Northstar Retail" }]);

    expect(switchActiveTenant).toHaveBeenCalledWith("t1");
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeDefined();
  });

  test("several memberships land on the scope chooser, not back on sign-in", async () => {
    const memberships = [
      { tenant_id: "t1", tenant_name: "Northstar Retail" },
      { tenant_id: "t2", tenant_name: "Helios Markets" },
    ];
    getActiveContext
      .mockResolvedValueOnce(signedOut)
      .mockResolvedValue({ status: 200, data: { active_tenant: null, memberships } });
    signIn.mockResolvedValue({ status: 200, data: { user: { id: "u1" }, memberships } });

    renderSignIn();
    await signedOutContextSettled();
    submitCredentials();

    expect(await screen.findByRole("heading", { name: /select your context/i })).toBeDefined();
  });
});
