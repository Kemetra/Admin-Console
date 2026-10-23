import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-782 (RT-777 S3): the tenant directory and the support-session start
 * drawer, against a stubbed network boundary. Every status and code is that of
 * the pinned contracts: `listTenants` (TenantSummary: id, slug, name) and
 * `openSupportSession` (201, 400, 401, 403, 404 TenantNotFound, 409
 * already_member, 429, 500).
 */
const getActiveContext = vi.fn();
const switchActiveTenant = vi.fn();
const listTenants = vi.fn();
const openSupportSession = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    getActiveContext: (...a: unknown[]) => getActiveContext(...a),
    switchActiveTenant: (...a: unknown[]) => switchActiveTenant(...a),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  };
});
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return { ...actual, listTenants: (...a: unknown[]) => listTenants(...a) };
});
vi.mock("@/lib/support-session-queries", () => ({
  openSupportSession: (...a: unknown[]) => openSupportSession(...a),
  renewSupportSession: vi.fn(),
  endSupportSession: vi.fn(),
}));

import { ActiveContextProvider } from "@/context/ActiveContextProvider";
import { createQueryClient } from "@/lib/query";
import { resetRateLimit } from "@/lib/rate-limit";
import { resetSupportSessionExpiry } from "@/lib/support-session-expiry";
import { ProtectedArea } from "@/shell/ProtectedArea";
import { platformRoutes } from "@/shell/platformRoutes";

const admin = { id: "u1", email: "ops@kemetra.test", display_name: "Ops", is_platform_admin: true };
const DELTA = "0190f000-0000-7000-8000-0000000000d1";
const NILE = "0190f000-0000-7000-8000-0000000000d2";
const RAYAN = "0190f000-0000-7000-8000-0000000000d3";
const TENANTS = [
  { id: DELTA, slug: "delta-markets", name: "Delta Markets" },
  { id: NILE, slug: "nile-pharma", name: "Nile Pharma" },
  { id: RAYAN, slug: "rayan", name: "Rayan Trading" },
];

const noSession = (memberships: unknown[] = []) => ({
  user: admin,
  active_tenant: null,
  active_store: null,
  memberships,
  support_session: null,
});

const session = (tenantId: string, over: Record<string, unknown> = {}) => ({
  id: "s1",
  tenant_id: tenantId,
  purpose: "incident",
  ticket_ref: null,
  status: "active",
  expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
  renewal_cap_at: new Date(Date.now() + 8 * 60 * 60_000).toISOString(),
  ...over,
});

const inSession = (tenantId: string, name: string, over: Record<string, unknown> = {}) => ({
  user: admin,
  active_tenant: { id: tenantId, name },
  active_store: null,
  memberships: [],
  support_session: session(tenantId, over),
});

const ok = (data: unknown) => ({ status: 200, data, error: undefined });
const res = (status: number, code?: string, requestId = "req-9") => ({
  status,
  data: undefined,
  error: code ? { error: { code, message: "x", request_id: requestId } } : undefined,
});

function Where(): React.JSX.Element {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

let qc: QueryClient;

function mount(path = "/platform/tenants"): void {
  qc = createQueryClient();
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
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

function serve(ctx: unknown): void {
  getActiveContext.mockResolvedValue({ status: 200, data: ctx });
}

/** A switch the server accepts: the re-read context has that tenant active. */
function switchesTo(tenantId: string, name: string): void {
  switchActiveTenant.mockImplementation(async () => {
    serve({
      ...noSession([{ tenant_id: tenantId, tenant_name: name, role_code: "owner" }]),
      active_tenant: { id: tenantId, name },
      active_role_code: "owner",
    });
    return { status: 200, data: {} };
  });
}

const heading = () => screen.findByRole("heading", { level: 1, name: "Organizations" });
const table = () => screen.findByRole("table", { name: "Organizations list" });
const dialog = () => screen.findByRole("dialog");
const startFor = (name: string) =>
  screen.findByRole("button", { name: `Start support session: ${name}` });

async function openDrawer(name = "Delta Markets"): Promise<HTMLElement> {
  fireEvent.click(await startFor(name));
  return dialog();
}

function fill(drawer: HTMLElement, purpose: string, ticket = ""): void {
  fireEvent.change(within(drawer).getByLabelText(/Purpose/), { target: { value: purpose } });
  fireEvent.change(within(drawer).getByLabelText(/Ticket reference/), {
    target: { value: ticket },
  });
}

const submit = (drawer: HTMLElement) =>
  fireEvent.click(within(drawer).getByRole("button", { name: "Start support session" }));

beforeEach(() => {
  resetRateLimit();
  resetSupportSessionExpiry();
  for (const m of [getActiveContext, switchActiveTenant, listTenants, openSupportSession]) {
    m.mockReset();
  }
  listTenants.mockResolvedValue(ok(TENANTS));
});
afterEach(() => cleanup());

describe("directory states", () => {
  test("rows: name and slug only, no status and no store counts, with the read-only note", async () => {
    serve(noSession());
    mount();
    await heading();
    const rows = within(await table())
      .getAllByRole("row")
      .slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Delta Markets")).toBeDefined();
    expect(within(rows[0]).getByText("delta-markets")).toBeDefined();
    expect(screen.getByText("Showing 3 of 3")).toBeDefined();
    expect(
      screen.getByText("A suspended organization opens in a read-only session."),
    ).toBeDefined();
    const headers = within(await table())
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["Organization", "Action"]);
    expect(listTenants).toHaveBeenCalledTimes(1);
  });

  test("empty: a successful zero-row list says so, with no table", async () => {
    listTenants.mockResolvedValue(ok([]));
    serve(noSession());
    mount();
    await heading();
    expect(await screen.findByText("No organizations")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
  });

  test("error: names the failure, carries the request id and retries on demand", async () => {
    listTenants.mockResolvedValueOnce(res(500, "system_failure", "req-500"));
    serve(noSession());
    mount();
    expect(await screen.findByText("Couldn't load the organizations.")).toBeDefined();
    expect(screen.getByText("req-500")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await table()).toBeDefined();
    expect(listTenants).toHaveBeenCalledTimes(2);
  });

  test("429: says the cause, never 'failed', and is not auto-retried", async () => {
    listTenants.mockResolvedValue(res(429, "rate_limited"));
    serve(noSession());
    mount();
    expect(await screen.findByText(/because of too many requests/)).toBeDefined();
    expect(screen.queryByText("Couldn't load the organizations.")).toBeNull();
    expect(listTenants).toHaveBeenCalledTimes(1);
  });

  test("search: client-side over name and slug, with the shown count and a no-match state", async () => {
    serve(noSession());
    mount();
    await table();
    const search = screen.getByLabelText("Search by organization name or slug");
    fireEvent.change(search, { target: { value: "PHARMA" } });
    expect(within(await table()).getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Showing 1 of 3")).toBeDefined();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(await screen.findByText("No organization matches “zzz”.")).toBeDefined();
    expect(screen.queryByRole("table")).toBeNull();
    expect(listTenants).toHaveBeenCalledTimes(1);
  });
});

describe("row actions are completable (UX Addendum A3)", () => {
  test("a tenant the caller is a member of offers the normal switch, not a support session", async () => {
    serve(noSession([{ tenant_id: NILE, tenant_name: "Nile Pharma", role_code: "owner" }]));
    switchesTo(NILE, "Nile Pharma");
    mount();
    await table();
    expect(screen.queryByRole("button", { name: "Start support session: Nile Pharma" })).toBeNull();
    expect(screen.getByText("You're a member")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Open organization: Nile Pharma" }));
    await waitFor(() => expect(switchActiveTenant).toHaveBeenCalledWith(NILE));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/"));
    expect(openSupportSession).not.toHaveBeenCalled();
  });

  test("a refused switch (non-2xx, context unchanged) is said and keeps the operator here", async () => {
    serve(noSession([{ tenant_id: NILE, tenant_name: "Nile Pharma", role_code: "owner" }]));
    switchActiveTenant.mockResolvedValue(res(403, "forbidden"));
    mount();
    await table();
    fireEvent.click(screen.getByRole("button", { name: "Open organization: Nile Pharma" }));
    expect(
      await screen.findByText(
        "The organization wasn't opened: the server refused the switch, and nothing changed.",
      ),
    ).toBeDefined();
    expect(screen.getByTestId("where").textContent).toBe("/platform/tenants");
  });

  test("an accepted switch whose context re-read fails is not called refused", async () => {
    serve(noSession([{ tenant_id: NILE, tenant_name: "Nile Pharma", role_code: "owner" }]));
    switchActiveTenant.mockImplementation(async () => {
      getActiveContext.mockRejectedValue(new TypeError("Failed to fetch"));
      return { status: 200, data: {} };
    });
    mount();
    await table();
    fireEvent.click(screen.getByRole("button", { name: "Open organization: Nile Pharma" }));
    expect(
      await screen.findByText(/Couldn't confirm the organization opened/, {}, { timeout: 5000 }),
    ).toBeDefined();
    expect(screen.queryByText(/the server refused the switch/)).toBeNull();
  });

  test("a stale switch failure is cleared when a support-session drawer opens", async () => {
    serve(noSession([{ tenant_id: NILE, tenant_name: "Nile Pharma", role_code: "owner" }]));
    switchActiveTenant.mockRejectedValue(new TypeError("Failed to fetch"));
    openSupportSession.mockResolvedValue(res(409, "already_member"));
    mount();
    await table();
    fireEvent.click(screen.getByRole("button", { name: "Open organization: Nile Pharma" }));
    await screen.findByText(/request didn't get through/);
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    await within(drawer).findByText("You're a member of this organization");
    expect(within(drawer).queryByText(/request didn't get through/)).toBeNull();
  });

  test("a switch that never got an answer is said, keeps the operator here, and allows one switch at a time", async () => {
    serve(noSession([{ tenant_id: NILE, tenant_name: "Nile Pharma", role_code: "owner" }]));
    let fail: (e: unknown) => void = () => undefined;
    switchActiveTenant.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        fail = reject;
      }),
    );
    mount();
    await table();
    const open = screen.getByRole("button", { name: "Open organization: Nile Pharma" });
    fireEvent.click(open);
    fireEvent.click(open);
    await act(async () => fail(new TypeError("Failed to fetch")));
    expect(
      await screen.findByText(
        "Couldn't open the organization because the request didn't get through. Try again.",
      ),
    ).toBeDefined();
    expect(switchActiveTenant).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("where").textContent).toBe("/platform/tenants");
  });

  test("after a 409, a switch that never got an answer is said inside the drawer", async () => {
    serve(noSession());
    openSupportSession.mockResolvedValue(res(409, "already_member"));
    switchActiveTenant.mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    fireEvent.click(
      await within(drawer).findByRole("button", { name: "Use the normal organization switch" }),
    );
    expect(await within(drawer).findByText(/request didn't get through/)).toBeDefined();
    expect(screen.getByTestId("where").textContent).toBe("/platform/tenants");
  });
});

describe("start drawer: validation and the request body", () => {
  test("the drawer names the tenant, the scope, the duration and the suspended rule", async () => {
    serve(noSession());
    mount();
    const drawer = await openDrawer();
    expect(drawer.getAttribute("aria-label")).toBe("Support session: Delta Markets");
    expect(within(drawer).getByText(/Read only: nothing in the organization/)).toBeDefined();
    expect(within(drawer).getByText(/60 minutes/)).toBeDefined();
    expect(within(drawer).getByText(/If the organization is suspended/)).toBeDefined();
    expect(within(drawer).getByText(/sees it in the audit log/)).toBeDefined();
    // DEC-1: no free-text reason field.
    expect(drawer.querySelectorAll("textarea")).toHaveLength(0);
    expect(within(drawer).queryByText(/You have a current support session/)).toBeNull();
  });

  test("no purpose: refused before any request, with the error on the field", async () => {
    serve(noSession());
    mount();
    const drawer = await openDrawer();
    submit(drawer);
    expect(await within(drawer).findByText("Choose the session's purpose.")).toBeDefined();
    expect(
      within(drawer)
        .getByLabelText(/Purpose/)
        .getAttribute("aria-invalid"),
    ).toBe("true");
    expect(openSupportSession).not.toHaveBeenCalled();
  });

  test("a ticket that breaks the contract pattern is refused before any request", async () => {
    serve(noSession());
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident", "ops@kemetra.test");
    submit(drawer);
    expect(await within(drawer).findByText(/That ticket reference isn't valid/)).toBeDefined();
    expect(openSupportSession).not.toHaveBeenCalled();
  });

  test("the body carries tenant_id and purpose only when no ticket is given", async () => {
    serve(noSession());
    openSupportSession.mockResolvedValue({ status: 201, data: session(DELTA) });
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    await waitFor(() => expect(openSupportSession).toHaveBeenCalledTimes(1));
    const body = openSupportSession.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(["purpose", "tenant_id"]);
    expect(body).toEqual({ tenant_id: DELTA, purpose: "incident" });
  });

  test("the body carries exactly the three contract keys with a ticket", async () => {
    serve(noSession());
    openSupportSession.mockResolvedValue({ status: 201, data: session(DELTA) });
    mount();
    const drawer = await openDrawer();
    fill(drawer, "customer_support", "SUP-2291");
    submit(drawer);
    await waitFor(() => expect(openSupportSession).toHaveBeenCalledTimes(1));
    const body = openSupportSession.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(["purpose", "tenant_id", "ticket_ref"]);
    expect(body.ticket_ref).toBe("SUP-2291");
  });

  test("a second click while the open is pending sends one request", async () => {
    serve(noSession());
    let release: (v: unknown) => void = () => undefined;
    openSupportSession.mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    submit(drawer);
    fireEvent.submit(drawer.querySelector("form") as HTMLFormElement);
    await act(async () => release({ status: 201, data: session(DELTA) }));
    expect(openSupportSession).toHaveBeenCalledTimes(1);
  });
});

describe("start drawer: outcomes", () => {
  test("201: re-reads the context, closes the drawer and shows the session bar, read-only", async () => {
    serve(noSession());
    openSupportSession.mockImplementation(async () => {
      serve(inSession(DELTA, "Delta Markets"));
      return { status: 201, data: session(DELTA) };
    });
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    const bar = await screen.findByRole("region", { name: "Support session" });
    expect(within(bar).getByText("Working in Delta Markets")).toBeDefined();
    expect(within(bar).getByText("Read only")).toBeDefined();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("where").textContent).toBe("/platform/tenants");
  });

  test("suspended tenant: a 201 is the same read-only session; no not-available state, no break-glass", async () => {
    serve(noSession());
    openSupportSession.mockImplementation(async () => {
      serve(inSession(RAYAN, "Rayan Trading"));
      return { status: 201, data: session(RAYAN) };
    });
    mount();
    const drawer = await openDrawer("Rayan Trading");
    fill(drawer, "customer_support");
    submit(drawer);
    const bar = await screen.findByRole("region", { name: "Support session" });
    expect(within(bar).getByText("Read only")).toBeDefined();
    expect(screen.queryByText("Organization not available")).toBeNull();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/break.?glass|emergency write/);
  });

  test("404 TenantNotFound: the one non-disclosing state, no session, back to the directory", async () => {
    serve(noSession());
    openSupportSession.mockResolvedValue(res(404, "not_found", "req-404"));
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    expect(await within(drawer).findByText("Organization not available")).toBeDefined();
    expect(within(drawer).getByText(/No session was started and nothing changed/)).toBeDefined();
    expect(within(drawer).getByText("req-404")).toBeDefined();
    expect(drawer.querySelector("form")).toBeNull();
    fireEvent.click(within(drawer).getByRole("button", { name: "Back to organizations" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // The list is re-read: the tenant may be gone.
    await waitFor(() => expect(listTenants).toHaveBeenCalledTimes(2));
  });

  test("a 404, then another tenant: the drawer starts clean", async () => {
    serve(noSession());
    openSupportSession.mockResolvedValueOnce(res(404, "not_found"));
    mount();
    let drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    await within(drawer).findByText("Organization not available");
    fireEvent.click(within(drawer).getByRole("button", { name: "Back to organizations" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    drawer = await openDrawer("Nile Pharma");
    expect(within(drawer).queryByText("Organization not available")).toBeNull();
    expect(drawer.querySelector("form")).not.toBeNull();
  });

  test("409 already_member: names the cause and offers the normal switch, which works", async () => {
    serve(noSession());
    openSupportSession.mockResolvedValue(res(409, "already_member"));
    switchesTo(DELTA, "Delta Markets");
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    expect(await within(drawer).findByText("You're a member of this organization")).toBeDefined();
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Use the normal organization switch" }),
    );
    await waitFor(() => expect(switchActiveTenant).toHaveBeenCalledWith(DELTA));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/"));
  });

  test("429: names the cause in the drawer, is not retried, and keeps the form", async () => {
    serve(noSession());
    openSupportSession.mockResolvedValue(res(429, "rate_limited"));
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    expect(
      await within(drawer).findByText(/Too many requests, and no session was started/),
    ).toBeDefined();
    expect(openSupportSession).toHaveBeenCalledTimes(1);
    expect(drawer.querySelector("form")).not.toBeNull();
  });

  test.each([
    [403, "forbidden", "Your account can't open a support session. No session was started."],
    [
      403,
      "origin_rejected",
      "The request was rejected because of where it came from. Reload the page and try again.",
    ],
    [500, "system_failure", "Couldn't start the session, and no session was started. Try again."],
    [400, "validation_error", "Couldn't start the session, and no session was started. Try again."],
  ])("%i %s: the copy names the real cause", async (status, code, copy) => {
    serve(noSession());
    openSupportSession.mockResolvedValue(res(status, code, "req-x"));
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    expect(await within(drawer).findByText(copy)).toBeDefined();
    expect(within(drawer).getByText("req-x")).toBeDefined();
  });

  test("a request that never got an answer says so, and no session is assumed", async () => {
    serve(noSession());
    openSupportSession.mockRejectedValue(new TypeError("Failed to fetch"));
    mount();
    const drawer = await openDrawer();
    fill(drawer, "incident");
    submit(drawer);
    expect(
      await within(drawer).findByText(
        "Couldn't start the session, and no session was started. Try again.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole("region", { name: "Support session" })).toBeNull();
  });
});

describe("sequences (UX Addendum checklist 1)", () => {
  test("an expired session, then opening another tenant: the drawer says it replaces, the bar shows the new one", async () => {
    serve(
      inSession(DELTA, "Delta Markets", {
        status: "expired",
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    );
    openSupportSession.mockImplementation(async () => {
      serve({ ...inSession(NILE, "Nile Pharma"), support_session: session(NILE, { id: "s2" }) });
      return { status: 201, data: session(NILE, { id: "s2" }) };
    });
    mount();
    const before = await screen.findByRole("region", { name: "Support session" });
    expect(before.getAttribute("data-state")).toBe("expired");
    const drawer = await openDrawer("Nile Pharma");
    expect(within(drawer).getByText(/Starting this one ends it/)).toBeDefined();
    fill(drawer, "onboarding");
    submit(drawer);
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Support session" }).getAttribute("data-state"),
      ).toBe("active"),
    );
    expect(screen.getByText("Working in Nile Pharma")).toBeDefined();
  });
});
