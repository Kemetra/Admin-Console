import { QueryClientProvider, notifyManager } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

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

/** Renders where the router ended up, so a test can assert the landing URL. */
function LocationProbe(): React.JSX.Element {
  const { pathname, search, hash } = useLocation();
  return <output aria-label="location">{`${pathname}${search}${hash}`}</output>;
}

function renderSignIn(initialEntry = "/signin"): void {
  const qc = createQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ActiveContextProvider>
          <Routes>
            <Route path="/signin" element={<SignInRoute />} />
            <Route path="/" element={<ProtectedArea />}>
              <Route index element={<Overview />} />
              <Route path="audit" element={<h1>Audit</h1>} />
            </Route>
          </Routes>
          <LocationProbe />
        </ActiveContextProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function landedAt(): string {
  return screen.getByRole("status", { name: "location" }).textContent ?? "";
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

/**
 * RT-355: a signed-out user who opened a protected URL (a shared link) is sent
 * to sign-in and, after a sign-in that lands in a tenant, returns to exactly
 * that URL. The chooser and no-access paths still land on `/`.
 */
describe("sign-in returns to the requested page (RT-355)", () => {
  const deepLink = "/audit?actor=u1#top";
  const oneTenant = [{ tenant_id: "t1", tenant_name: "Northstar Retail" }];
  const tenantContext = {
    status: 200,
    data: {
      user: { display_name: "Amal Saleh" },
      active_tenant: { id: "t1", name: "Northstar Retail" },
      active_store: null,
      active_role_code: "tenant_admin",
      memberships: oneTenant,
    },
  };

  // jsdom runs React's post-navigation render before TanStack's default
  // setTimeout-batched notification of the refreshed context, so ProtectedArea
  // briefly sees the stale signed-out entry and redirects. A real browser does
  // not (Playwright: tests/e2e/signin-return.spec.ts). Notify synchronously here
  // so the landing URL can be asserted, then restore the default.
  beforeAll(() => notifyManager.setScheduler((cb) => cb()));
  afterAll(() => notifyManager.setScheduler((cb) => setTimeout(cb, 0)));

  beforeEach(() => {
    getActiveContext.mockReset();
    signIn.mockReset();
    refreshSession.mockReset().mockResolvedValue({ status: 401 });
  });

  test("a deep link survives the sign-in redirect and auto-select returns to it", async () => {
    getActiveContext.mockResolvedValueOnce(signedOut).mockResolvedValue(tenantContext);
    signIn.mockResolvedValue({ status: 200, data: { user: { id: "u1" }, memberships: oneTenant } });

    renderSignIn(deepLink);
    expect(await screen.findByLabelText("Email")).toBeDefined();
    expect(landedAt()).toBe("/signin");
    submitCredentials();

    expect(await screen.findByRole("heading", { name: "Audit" })).toBeDefined();
    expect(landedAt()).toBe(deepLink);
  });

  test("the chooser path lands on / even with a deep link pending", async () => {
    const memberships = [...oneTenant, { tenant_id: "t2", tenant_name: "Helios Markets" }];
    getActiveContext
      .mockResolvedValueOnce(signedOut)
      .mockResolvedValue({ status: 200, data: { active_tenant: null, memberships } });
    signIn.mockResolvedValue({ status: 200, data: { user: { id: "u1" }, memberships } });

    renderSignIn(deepLink);
    expect(await screen.findByLabelText("Email")).toBeDefined();
    submitCredentials();

    expect(await screen.findByRole("heading", { name: /select your context/i })).toBeDefined();
    expect(landedAt()).toBe("/");
  });

  test("the no-access path lands on / even with a deep link pending", async () => {
    getActiveContext
      .mockResolvedValueOnce(signedOut)
      .mockResolvedValue({ status: 200, data: { active_tenant: null, memberships: [] } });
    signIn.mockResolvedValue({ status: 200, data: { user: { id: "u1" }, memberships: [] } });

    renderSignIn(deepLink);
    expect(await screen.findByLabelText("Email")).toBeDefined();
    submitCredentials();

    await vi.waitFor(() => expect(landedAt()).toBe("/"));
    expect(screen.queryByRole("heading", { name: "Audit" })).toBeNull();
  });

  test("opening /signin directly lands on / after an auto-select sign-in", async () => {
    getActiveContext.mockResolvedValueOnce(signedOut).mockResolvedValue(tenantContext);
    signIn.mockResolvedValue({ status: 200, data: { user: { id: "u1" }, memberships: oneTenant } });

    renderSignIn("/signin");
    await signedOutContextSettled();
    submitCredentials();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeDefined();
    expect(landedAt()).toBe("/");
  });
});
