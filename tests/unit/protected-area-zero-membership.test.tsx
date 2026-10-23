import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-844: the `/` guard for a user with zero memberships. NoAccess is only for
 * a user who genuinely has none: a platform admin is sent to /platform, or into
 * the support session's tenant when one is active. Role x memberships x session.
 */
const getActiveContext = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    getActiveContext: (...a: unknown[]) => getActiveContext(...a),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  };
});
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listTenants: async () => ({ status: 200, data: [], error: undefined }) };
});

import { ActiveContextProvider } from "@/context/ActiveContextProvider";
import { createQueryClient } from "@/lib/query";
import { ProtectedArea } from "@/shell/ProtectedArea";
import { platformRoutes } from "@/shell/platformRoutes";

const admin = { id: "u1", email: "ops@kemetra.test", display_name: "Ops", is_platform_admin: true };
const plain = { id: "u2", email: "amal@x.eg", display_name: "Amal", is_platform_admin: false };
const tenant = { id: "t1", name: "Delta Markets" };
const member = (id: string) => ({ tenant_id: id, tenant_name: `Tenant ${id}`, role_code: "owner" });

const FUTURE = "2099-01-01T00:00:00Z";
function session(over: Partial<{ tenant_id: string; status: "active" | "expired" }> = {}) {
  return {
    id: "s1",
    tenant_id: over.tenant_id ?? "t1",
    purpose: "incident",
    ticket_ref: "SUP-1",
    status: over.status ?? "active",
    expires_at: FUTURE,
    renewal_cap_at: FUTURE,
  };
}

function Where(): React.JSX.Element {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function mount(ctx: unknown): void {
  getActiveContext.mockResolvedValue({ status: 200, data: ctx });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={["/"]}>
        <ActiveContextProvider>
          <Where />
          <Routes>
            {platformRoutes}
            <Route path="/" element={<ProtectedArea />}>
              <Route index element={<h1>Tenant surface</h1>} />
            </Route>
          </Routes>
        </ActiveContextProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const sessionView = () => screen.findByRole("heading", { name: "Read-only support session" });
const noAccess = () => screen.findByRole("heading", { name: /no assigned access/i });
const platformHome = () => screen.findByRole("heading", { name: "Organizations", level: 1 });

beforeEach(() => getActiveContext.mockReset());

describe("zero memberships at /", () => {
  test("platform admin with an active session lands in the session's tenant view", async () => {
    mount({ user: admin, active_tenant: tenant, memberships: [], support_session: session() });
    expect(await sessionView()).toBeDefined();
    expect(screen.queryByRole("heading", { name: /no assigned access/i })).toBeNull();
    expect(screen.getByRole("region", { name: "Support session" })).toBeDefined();
  });

  test("platform admin with an expired session still sees the session shell, not no-access", async () => {
    mount({
      user: admin,
      active_tenant: tenant,
      memberships: [],
      support_session: session({ status: "expired" }),
    });
    expect(await screen.findByText("Support session expired.")).toBeDefined();
    expect(screen.queryByRole("heading", { name: /no assigned access/i })).toBeNull();
  });

  test.each([
    ["no session, no active tenant", null, null],
    ["a session but no active tenant", null, session()],
    ["an active tenant but no session", tenant, null],
    ["an active tenant that is not the session's tenant", tenant, session({ tenant_id: "t9" })],
  ])(
    "platform admin with %s is sent to /platform",
    async (_case, active_tenant, support_session) => {
      mount({ user: admin, active_tenant, memberships: [], support_session });
      expect(await platformHome()).toBeDefined();
      expect(screen.getByTestId("where").textContent).toBe("/platform/tenants");
      expect(screen.queryByRole("heading", { name: "Tenant surface" })).toBeNull();
    },
  );

  test("non-admin with no memberships gets no-access", async () => {
    mount({ user: plain, active_tenant: null, memberships: [], support_session: null });
    expect(await noAccess()).toBeDefined();
    expect(screen.getByTestId("where").textContent).toBe("/");
  });

  test("non-admin never gets the session shell, even if the context carries a session", async () => {
    mount({ user: plain, active_tenant: tenant, memberships: [], support_session: session() });
    expect(await noAccess()).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Tenant surface" })).toBeNull();
  });

  test("a missing is_platform_admin flag is not an admin", async () => {
    mount({
      user: { id: "u3", email: "x@y.z" },
      active_tenant: tenant,
      memberships: [],
      support_session: session(),
    });
    expect(await noAccess()).toBeDefined();
  });
});

describe("memberships are unchanged", () => {
  test("one membership, active tenant, no session: the tenant surface", async () => {
    mount({ user: plain, active_tenant: tenant, memberships: [member("t1")] });
    expect(await screen.findByRole("heading", { name: "Tenant surface" })).toBeDefined();
  });

  test("admin with a membership and a session: the session view (RT-781)", async () => {
    mount({
      user: admin,
      active_tenant: tenant,
      memberships: [member("t1")],
      support_session: session(),
    });
    expect(await sessionView()).toBeDefined();
  });

  test("many memberships, no active tenant, no session: the scope gate", async () => {
    mount({ user: plain, active_tenant: null, memberships: [member("t1"), member("t2")] });
    expect(await screen.findByRole("heading", { name: /select your context/i })).toBeDefined();
  });

  test("admin with many memberships and no active tenant stays on the scope gate at /", async () => {
    mount({ user: admin, active_tenant: null, memberships: [member("t1"), member("t2")] });
    expect(await screen.findByRole("heading", { name: /select your context/i })).toBeDefined();
  });
});
