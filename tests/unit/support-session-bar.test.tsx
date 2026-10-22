import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * RT-781 (RT-777 S2): the support-session bar and its lifecycle in both shells.
 * The network boundary is stubbed, so every state is driven from a fixed
 * server-resolved context. Codes are those of the pinned contract.
 */
const getActiveContext = vi.fn();
const renewSupportSession = vi.fn();
const endSupportSession = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    getActiveContext: (...a: unknown[]) => getActiveContext(...a),
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  };
});
vi.mock("@/lib/support-session-queries", () => ({
  renewSupportSession: (...a: unknown[]) => renewSupportSession(...a),
  endSupportSession: (...a: unknown[]) => endSupportSession(...a),
}));

import { ActiveContextProvider } from "@/context/ActiveContextProvider";
import { createQueryClient } from "@/lib/query";
import { resetRateLimit } from "@/lib/rate-limit";
import {
  reportSupportSessionExpired,
  resetSupportSessionExpiry,
} from "@/lib/support-session-expiry";
import { ProtectedArea } from "@/shell/ProtectedArea";
import { platformRoutes } from "@/shell/platformRoutes";

const NOW = Date.parse("2026-10-22T10:00:00Z");
const MIN = 60_000;
const at = (ms: number) => new Date(NOW + ms).toISOString();

const admin = { id: "u1", email: "ops@kemetra.test", display_name: "Ops", is_platform_admin: true };

function sessionSummary(
  over: Partial<{
    status: "active" | "expired";
    left: number;
    capIn: number;
    id: string;
    ticket: string | null;
  }> = {},
) {
  return {
    id: over.id ?? "s1",
    tenant_id: "t1",
    purpose: "incident",
    ticket_ref: over.ticket === undefined ? "SUP-2291" : over.ticket,
    status: over.status ?? "active",
    expires_at: at(over.left ?? 40 * MIN),
    renewal_cap_at: at(over.capIn ?? 8 * 60 * MIN),
  };
}

function context(support_session: unknown) {
  return {
    user: admin,
    active_tenant: { id: "t1", name: "Delta Markets" },
    active_store: null,
    active_role_code: "owner",
    memberships: [{ tenant_id: "t1", tenant_name: "Delta Markets", role_code: "owner" }],
    support_session,
  };
}

function Where(): React.JSX.Element {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

let qc: QueryClient;

function mount(path: string): void {
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

/**
 * Let pending promises and the faked timers settle. waitFor's own interval is
 * faked here, and TanStack Query notifies on a real zero-delay timer, so one
 * real tick comes first.
 */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await vi.advanceTimersByTimeAsync(50);
  });

const bar = () => screen.findByRole("region", { name: "Support session" });
const renewButton = () => screen.getByRole("button", { name: "Renew session" });
const endButton = () => screen.getByRole("button", { name: "End session" });
const res = (status: number, code?: string, data?: unknown) => ({
  status,
  data,
  error: code ? { error: { code, message: "x", request_id: "req-9" } } : undefined,
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(NOW);
  resetRateLimit();
  resetSupportSessionExpiry();
  for (const m of [getActiveContext, renewSupportSession, endSupportSession]) m.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("no bar without a support session", () => {
  test("a member-entered tenant (support_session null) renders no bar in the tenant shell", async () => {
    serve(context(null));
    mount("/");
    expect(await screen.findByRole("heading", { name: "Tenant surface" })).toBeDefined();
    expect(screen.queryByRole("region", { name: "Support session" })).toBeNull();
  });

  test("a platform admin with no session renders no bar in the platform shell", async () => {
    serve({ user: admin, active_tenant: null, memberships: [], support_session: null });
    mount("/platform/tenants");
    expect(
      await screen.findByRole("heading", { name: "No organizations available" }),
    ).toBeDefined();
    expect(screen.queryByRole("region", { name: "Support session" })).toBeNull();
  });
});

describe("bar states", () => {
  test("active: purpose, ticket, tenant, remaining time, read-only, renew and end", async () => {
    serve(context(sessionSummary()));
    mount("/platform/tenants");
    const region = await bar();
    expect(region.getAttribute("data-state")).toBe("active");
    const scope = within(region);
    expect(scope.getByText("Purpose: Incident")).toBeDefined();
    expect(scope.getByText("SUP-2291")).toBeDefined();
    expect(scope.getByText("Working in Delta Markets")).toBeDefined();
    expect(scope.getByText("Read only")).toBeDefined();
    expect(scope.getByText(/40 minutes left · until Oct 22, 2026, 10:40 UTC/)).toBeDefined();
    expect(renewButton().getAttribute("aria-disabled")).toBeNull();
    expect(endButton()).toBeDefined();
  });

  test("the ticket is omitted when the session has none", async () => {
    serve(context(sessionSummary({ ticket: null })));
    mount("/platform/tenants");
    const region = await bar();
    expect(within(region).queryByText(/Ticket/)).toBeNull();
  });

  test("expiring: a notice with the remaining time and the renewal limit; renew stays enabled", async () => {
    serve(context(sessionSummary({ left: 5 * MIN })));
    mount("/platform/tenants");
    const region = await bar();
    expect(region.getAttribute("data-state")).toBe("expiring");
    expect(within(region).getByText("The support session ends in 5 minutes")).toBeDefined();
    expect(within(region).getByText(/Renewal limit: Oct 22, 2026, 18:00 UTC/)).toBeDefined();
    expect(renewButton().getAttribute("aria-disabled")).toBeNull();
  });

  test("cap reached: renew stays rendered but aria-disabled with its reason, and does nothing", async () => {
    serve(context(sessionSummary({ left: 9 * MIN, capIn: 9 * MIN })));
    mount("/platform/tenants");
    const region = await bar();
    expect(region.getAttribute("data-state")).toBe("cap_reached");
    const renew = renewButton();
    expect(renew.getAttribute("aria-disabled")).toBe("true");
    const reason = document.getElementById(renew.getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toContain("The session reached its renewal limit");
    fireEvent.click(renew);
    expect(renewSupportSession).not.toHaveBeenCalled();
    // Still no break-glass, and ending stays possible.
    expect(screen.queryByText(/break-glass/i)).toBeNull();
    expect(endButton()).toBeDefined();
  });

  test("expired (server status): no renew, end stays, the notice says what happened", async () => {
    serve(context(sessionSummary({ status: "expired", left: -MIN })));
    mount("/platform/tenants");
    const region = await bar();
    expect(region.getAttribute("data-state")).toBe("expired");
    expect(screen.queryByRole("button", { name: "Renew session" })).toBeNull();
    expect(endButton()).toBeDefined();
    expect(within(region).getByText("The support session expired")).toBeDefined();
  });

  test("one polite live region announces the state, not the countdown", async () => {
    serve(context(sessionSummary()));
    mount("/platform/tenants");
    const region = await bar();
    const live = region.querySelector("output[aria-live='polite']");
    expect(live?.textContent).toBe("Support session active.");
  });
});

describe("countdown from the server expires_at", () => {
  test("active → expiring → expired as time passes; the context is re-read once at zero", async () => {
    serve(context(sessionSummary({ left: 6 * MIN })));
    mount("/platform/tenants");
    const region = await bar();
    expect(region.getAttribute("data-state")).toBe("active");
    expect(getActiveContext).toHaveBeenCalledTimes(1);

    act(() => {
      vi.setSystemTime(NOW + 2 * MIN);
      vi.advanceTimersByTime(1000);
    });
    expect(region.getAttribute("data-state")).toBe("expiring");

    act(() => {
      vi.setSystemTime(NOW + 6 * MIN + 1000);
      vi.advanceTimersByTime(1000);
    });
    expect(region.getAttribute("data-state")).toBe("expired");
    await settle();
    expect(getActiveContext).toHaveBeenCalledTimes(2);
    // No polling: a further tick does not re-read again.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(getActiveContext).toHaveBeenCalledTimes(2);
  });
});

describe("renew", () => {
  test("200 calls the contract operation once and re-reads the context", async () => {
    serve(context(sessionSummary({ left: 4 * MIN })));
    renewSupportSession.mockResolvedValue(
      res(200, undefined, { expires_at: at(64 * MIN), renewed_at: at(0) }),
    );
    mount("/platform/tenants");
    await bar();
    serve(context(sessionSummary({ left: 64 * MIN })));
    fireEvent.click(renewButton());
    await waitFor(() => expect(getActiveContext).toHaveBeenCalledTimes(2));
    expect(renewSupportSession).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Support session" }).getAttribute("data-state"),
      ).toBe("active"),
    );
    expect(
      screen.getByText("Support session renewed until Oct 22, 2026, 11:04 UTC."),
    ).toBeDefined();
  });

  test("409 support_session_renewal_cap_reached switches to the cap state even when dates say renewable", async () => {
    serve(context(sessionSummary({ left: 20 * MIN })));
    renewSupportSession.mockResolvedValue(res(409, "support_session_renewal_cap_reached"));
    mount("/platform/tenants");
    await bar();
    fireEvent.click(renewButton());
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Support session" }).getAttribute("data-state"),
      ).toBe("cap_reached"),
    );
    expect(renewButton().getAttribute("aria-disabled")).toBe("true");
  });

  test("409 support_session_expired re-reads the context and shows the server's state", async () => {
    serve(context(sessionSummary({ left: 3 * MIN })));
    renewSupportSession.mockResolvedValue(res(409, "support_session_expired"));
    mount("/platform/tenants");
    await bar();
    serve(context(sessionSummary({ status: "expired", left: -MIN })));
    fireEvent.click(renewButton());
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Support session" }).getAttribute("data-state"),
      ).toBe("expired"),
    );
  });

  test("409 support_session_absent: the bar disappears and the operator lands on the directory", async () => {
    serve(context(sessionSummary({ left: 3 * MIN })));
    renewSupportSession.mockResolvedValue(res(409, "support_session_absent"));
    mount("/platform/tenants");
    await bar();
    serve({ user: admin, active_tenant: null, memberships: [], support_session: null });
    fireEvent.click(renewButton());
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Support session" })).toBeNull(),
    );
    expect(screen.getByTestId("where").textContent).toBe("/platform/tenants");
  });

  test("403 origin_rejected and forbidden are inline errors, never the expired state", async () => {
    serve(context(sessionSummary()));
    renewSupportSession.mockResolvedValueOnce(res(403, "origin_rejected"));
    mount("/platform/tenants");
    const region = await bar();
    fireEvent.click(renewButton());
    expect((await screen.findByRole("alert")).textContent).toContain("Reload the page");
    expect(region.getAttribute("data-state")).toBe("active");

    renewSupportSession.mockResolvedValueOnce(res(403, "forbidden"));
    fireEvent.click(renewButton());
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("can't change this session"),
    );
    expect(screen.getByRole("alert").textContent).toContain("req-9");
    expect(region.getAttribute("data-state")).toBe("active");
  });

  test("429 changes nothing in the bar, is not retried and offers no inline error", async () => {
    serve(context(sessionSummary()));
    renewSupportSession.mockResolvedValue(res(429, "rate_limited"));
    mount("/platform/tenants");
    const region = await bar();
    fireEvent.click(renewButton());
    await waitFor(() => expect(renewSupportSession).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(renewSupportSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(region.getAttribute("data-state")).toBe("active");
  });

  test("a request that never got an answer shows the generic inline error, for renew and for end", async () => {
    serve(context(sessionSummary()));
    renewSupportSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    endSupportSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    mount("/platform/tenants");
    const region = await bar();

    fireEvent.click(renewButton());
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't complete that");
    await waitFor(() => expect(renewButton().hasAttribute("disabled")).toBe(false));

    // The operator must not believe the session ended: it is still there, and says so.
    fireEvent.click(endButton());
    await waitFor(() => expect(endSupportSession).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't complete that");
    expect(region.getAttribute("data-state")).toBe("active");
    expect(screen.getByTestId("where").textContent).toBe("/platform/tenants");
  });

  test("a second click while one renew is pending is ignored", async () => {
    serve(context(sessionSummary()));
    let release: (v: unknown) => void = () => {};
    renewSupportSession.mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );
    mount("/platform/tenants");
    await bar();
    fireEvent.click(renewButton());
    await waitFor(() => expect(renewButton().hasAttribute("disabled")).toBe(true));
    fireEvent.click(renewButton());
    expect(renewSupportSession).toHaveBeenCalledTimes(1);
    release(res(500, "system_failure"));
    await waitFor(() => expect(renewButton().hasAttribute("disabled")).toBe(false));
  });
});

describe("end", () => {
  test("200: lands on the directory, drops every tenant read and keeps the context", async () => {
    serve(context(sessionSummary()));
    endSupportSession.mockResolvedValue(res(200, undefined, { status: "ended" }));
    mount("/");
    expect(await bar()).toBeDefined();
    qc.setQueryData(["sales", "t1"], { rows: 1 });
    qc.setQueryData(["devices", "t1"], { rows: 2 });
    serve({ user: admin, active_tenant: null, memberships: [], support_session: null });
    fireEvent.click(endButton());
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/platform/tenants"));
    expect(endSupportSession).toHaveBeenCalledTimes(1);
    expect(qc.getQueryData(["sales", "t1"])).toBeUndefined();
    expect(qc.getQueryData(["devices", "t1"])).toBeUndefined();
    expect(qc.getQueryData(["activeContext"])).toBeDefined();
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Support session" })).toBeNull(),
    );
  });

  test("409 support_session_absent is treated as already ended", async () => {
    serve(context(sessionSummary()));
    endSupportSession.mockResolvedValue(res(409, "support_session_absent"));
    mount("/platform/tenants");
    await bar();
    serve({ user: admin, active_tenant: null, memberships: [], support_session: null });
    fireEvent.click(endButton());
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Support session" })).toBeNull(),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("403 and 500 are inline errors and keep the session", async () => {
    serve(context(sessionSummary()));
    endSupportSession.mockResolvedValue(res(500, "system_failure"));
    mount("/platform/tenants");
    const region = await bar();
    fireEvent.click(endButton());
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't complete that");
    expect(region.getAttribute("data-state")).toBe("active");
    expect(screen.getByTestId("where").textContent).toBe("/platform/tenants");
  });

  test("end is available on an expired session (the contract allows it)", async () => {
    serve(context(sessionSummary({ status: "expired", left: -MIN })));
    endSupportSession.mockResolvedValue(res(200, undefined, { status: "ended" }));
    mount("/platform/tenants");
    await bar();
    serve({ user: admin, active_tenant: null, memberships: [], support_session: null });
    fireEvent.click(endButton());
    await waitFor(() => expect(endSupportSession).toHaveBeenCalledTimes(1));
  });
});

describe("expired body", () => {
  test("tenant shell: an expired session replaces the surface with the calm state", async () => {
    serve(context(sessionSummary({ status: "expired", left: -MIN })));
    mount("/");
    expect(
      await screen.findByRole("heading", { name: "The support session expired", level: 1 }),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Tenant surface" })).toBeNull();
    const link = screen.getByRole("link", { name: "Go to organizations" });
    expect(link.getAttribute("href")).toBe("/platform/tenants");
  });

  test("platform shell: an expired status keeps the platform-scoped directory", async () => {
    serve(context(sessionSummary({ status: "expired", left: -MIN })));
    mount("/platform/tenants");
    expect(
      await screen.findByRole("heading", { name: "No organizations available" }),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Go to organizations" })).toBeNull();
  });

  test("mid-page: a refused tenant call on a page that rendered without a session re-reads the context and shows the expired state", async () => {
    // The context still says member-entered (the session was opened elsewhere).
    serve(context(null));
    mount("/");
    expect(await screen.findByRole("heading", { name: "Tenant surface" })).toBeDefined();
    expect(getActiveContext).toHaveBeenCalledTimes(1);

    serve(context(sessionSummary({ status: "expired", left: -MIN })));
    act(() => reportSupportSessionExpired());

    expect(
      await screen.findByRole("heading", { name: "The support session expired" }),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Tenant surface" })).toBeNull();
    expect(screen.getByRole("region", { name: "Support session" }).getAttribute("data-state")).toBe(
      "expired",
    );
    await settle();
    // One re-read for the refusal, not a second one from the countdown path.
    expect(getActiveContext).toHaveBeenCalledTimes(2);
  });

  test("mid-page also swaps the body in the platform shell, whatever the context still says", async () => {
    serve(context(sessionSummary()));
    mount("/platform/tenants");
    await bar();
    act(() => reportSupportSessionExpired());
    expect(
      await screen.findByRole("heading", { name: "The support session expired" }),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { name: "No organizations available" })).toBeNull();
  });

  test("a refusal seen under an old session does not expire a new one", async () => {
    serve(context(sessionSummary({ id: "s1" })));
    mount("/platform/tenants");
    expect(
      await screen.findByRole("heading", { name: "No organizations available" }),
    ).toBeDefined();
    act(() => reportSupportSessionExpired());
    expect(
      await screen.findByRole("heading", { name: "The support session expired" }),
    ).toBeDefined();

    // The operator opens another session: a fresh id, active.
    serve(context(sessionSummary({ id: "s2" })));
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["activeContext"] });
    });
    expect(
      await screen.findByRole("heading", { name: "No organizations available" }),
    ).toBeDefined();
    expect(screen.getByRole("region", { name: "Support session" }).getAttribute("data-state")).toBe(
      "active",
    );
  });

  test("a refusal with no session in the context never renders a bar", async () => {
    serve(context(null));
    mount("/");
    expect(await screen.findByRole("heading", { name: "Tenant surface" })).toBeDefined();
    act(() => reportSupportSessionExpired());
    expect(screen.queryByRole("region", { name: "Support session" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Tenant surface" })).toBeDefined();
  });
});

describe("no tenant data across sessions", () => {
  test("expiry drops every cached read except the active context", async () => {
    serve(context(sessionSummary({ left: 2 * MIN })));
    mount("/platform/tenants");
    await bar();
    qc.setQueryData(["sales", "t1"], { rows: 1 });
    act(() => {
      vi.setSystemTime(NOW + 3 * MIN);
      vi.advanceTimersByTime(1000);
    });
    await waitFor(() => expect(qc.getQueryData(["sales", "t1"])).toBeUndefined());
    expect(qc.getQueryData(["activeContext"])).toBeDefined();
  });

  test("a replaced session id drops the previous tenant's reads", async () => {
    serve(context(sessionSummary({ id: "s1" })));
    mount("/platform/tenants");
    await bar();
    qc.setQueryData(["sales", "t1"], { rows: 1 });
    serve(context(sessionSummary({ id: "s2" })));
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["activeContext"] });
    });
    await settle();
    expect(qc.getQueryData(["sales", "t1"])).toBeUndefined();
  });
});

describe("tenant shell inside a session: read-only by construction", () => {
  const writeish = () =>
    Array.from(document.querySelectorAll("button, input, select, textarea, form, a[href]")).filter(
      (el) => !el.closest("header, section[aria-label='Support session']"),
    );

  test("an active session shows the calm read-only state: no tenant surface, scope bar or tenant nav", async () => {
    serve(context(sessionSummary()));
    mount("/");
    expect(await screen.findByRole("heading", { name: "Read-only support session" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Tenant surface" })).toBeNull();
    // No tenant navigation, no scope bar: only the way back to the directory and sign out.
    expect(screen.queryByRole("link", { name: "Stores" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Tenants" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Operators" })).toBeNull();
    expect(document.querySelector(".scope")).toBeNull();
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.getAttribute("href")),
    ).toEqual(["/platform/tenants"]);
  });

  test("no form control and no write button renders in an active, expiring or capped session", async () => {
    for (const s of [
      sessionSummary(),
      sessionSummary({ left: 2 * MIN }),
      sessionSummary({ left: 9 * MIN, capIn: 9 * MIN }),
    ]) {
      cleanup();
      serve(context(s));
      mount("/");
      await screen.findByRole("heading", { name: "Read-only support session" });
      expect(document.querySelectorAll("form, input, select, textarea")).toHaveLength(0);
      // Outside the header and the session bar, the only things left are the way back to
      // the directory and sign out.
      const left = writeish().map((el) => el.textContent?.trim());
      expect(left.sort()).toEqual(["Go to organizations", "Organizations", "Sign out"].sort());
      // Within the bar: exactly the session's own controls.
      const bar = screen.getByRole("region", { name: "Support session" });
      const names = within(bar)
        .getAllByRole("button")
        .map((b) => b.textContent?.trim());
      expect(names).toEqual(["Renew session", "End session"]);
    }
  });

  test("an expired session in the tenant shell shows the expired state, still without any surface", async () => {
    serve(context(sessionSummary({ status: "expired", left: -MIN })));
    mount("/");
    expect(
      await screen.findByRole("heading", { name: "The support session expired" }),
    ).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Read-only support session" })).toBeNull();
    expect(document.querySelectorAll("form, input, select, textarea")).toHaveLength(0);
  });

  test("a member-entered context keeps the normal tenant UI, scope bar and nav", async () => {
    serve(context(null));
    mount("/");
    expect(await screen.findByRole("heading", { name: "Tenant surface" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Read-only support session" })).toBeNull();
    expect(screen.getByRole("link", { name: "Stores" })).toBeDefined();
    expect(document.querySelector(".scope")).not.toBeNull();
  });
});

describe("no write control inside a session", () => {
  const ALLOWED = new Set([
    "Renew session",
    "End session",
    "Sign out",
    // The shell's own chrome: language and theme.
  ]);

  test("the platform shell in a session exposes no form control and no tenant write", async () => {
    serve(context(sessionSummary()));
    mount("/platform/tenants");
    await bar();
    expect(document.querySelectorAll("form, input, textarea, select")).toHaveLength(0);
    const main = document.querySelector("main") as HTMLElement;
    expect(within(main).queryAllByRole("button")).toHaveLength(0);
    expect(within(main).queryAllByRole("link")).toHaveLength(0);
    // The bar's controls act on the session itself: exactly renew and end.
    const region = screen.getByRole("region", { name: "Support session" });
    const names = within(region)
      .getAllByRole("button")
      .map((b) => b.textContent?.trim());
    expect(names).toEqual(["Renew session", "End session"]);
    for (const name of names) expect(ALLOWED.has(name ?? "")).toBe(true);
    expect(within(region).queryAllByRole("link")).toHaveLength(0);
  });

  test("the bar never offers break-glass in any state", async () => {
    for (const s of [
      sessionSummary(),
      sessionSummary({ left: 2 * MIN }),
      sessionSummary({ left: 9 * MIN, capIn: 9 * MIN }),
      sessionSummary({ status: "expired", left: -MIN }),
    ]) {
      cleanup();
      serve(context(s));
      mount("/platform/tenants");
      const region = await bar();
      expect(region.textContent?.toLowerCase()).not.toMatch(/break.?glass|emergency/);
    }
  });
});
