import { TenantAiPlanSection } from "@/ai-entitlements/TenantAiPlanSection";
import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  STORE_ID,
  TENANT_ID,
  apiError,
  availableFeature,
  exhaustedFeature,
  fullActive,
  fullNone,
  minimalView,
} from "./ai-plan-fixtures";

/**
 * RT-665 panel (AD-AI-ENT-001 D-6). Owner / tenant_admin: the full view.
 * store_manager: the minimal view, no plan, meter or commercial detail.
 * store_staff and everyone else: nothing rendered and nothing requested. The
 * runtime is not built (RT-664), so 404 / 501 / 503 are a neutral "not
 * available yet", with no banner and no error detail.
 */
let role: string | undefined = "owner";
let activeTenant: string | undefined = TENANT_ID;
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => ({
    context: { active_tenant: { id: activeTenant }, active_role_code: role },
  }),
}));

const read = vi.fn();
vi.mock("@/lib/ai-entitlements-queries", () => ({
  consoleGetTenantAiEntitlements: (...a: unknown[]) => read(...a),
}));

function renderSection(props: { tenantId?: string; enabled?: boolean } = {}) {
  const qc = createQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <TenantAiPlanSection tenantId={props.tenantId ?? TENANT_ID} enabled={props.enabled ?? true} />
    </QueryClientProvider>,
  );
}

const ok = (data: unknown) => ({ status: 200, data });

/** The section's region, once its read has settled (the loading line is gone). */
async function loadedRegion(name?: string): Promise<HTMLElement> {
  const region = await screen.findByRole("region", name ? { name } : undefined);
  await waitFor(() => expect(region.querySelector("[aria-busy='true']")).toBeNull());
  return region;
}

beforeEach(() => {
  role = "owner";
  activeTenant = TENANT_ID;
  read.mockReset();
  setLocale("en");
});
afterEach(() => cleanup());

describe("who gets the panel, and who is never asked", () => {
  test.each(["store_staff", "cashier", "manager", "platform_admin", "", "unknown_role", undefined])(
    "role %s: nothing rendered, nothing requested",
    async (r) => {
      role = r;
      const { container } = renderSection();
      await Promise.resolve();
      expect(container.innerHTML).toBe("");
      expect(read).not.toHaveBeenCalled();
    },
  );

  test("a tenant that is not the active tenant: nothing rendered, nothing requested", async () => {
    const { container } = renderSection({ tenantId: "0190f000-0000-7000-8000-0000000000ff" });
    await Promise.resolve();
    expect(container.innerHTML).toBe("");
    expect(read).not.toHaveBeenCalled();
  });

  test("with the flag off (a production build before RT-664) nothing is rendered or requested", async () => {
    const { container } = renderSection({ enabled: false });
    await Promise.resolve();
    expect(container.innerHTML).toBe("");
    expect(read).not.toHaveBeenCalled();
  });

  test.each(["owner", "tenant_admin", "store_manager"])(
    "%s asks for its own tenant once",
    async (r) => {
      role = r;
      read.mockResolvedValue(ok(r === "store_manager" ? minimalView : fullActive));
      renderSection();
      await loadedRegion();
      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith(TENANT_ID);
    },
  );
});

describe("owner / tenant_admin: the full view", () => {
  test.each(["owner", "tenant_admin"])("%s sees plan, dates, statuses and meters", async (r) => {
    role = r;
    read.mockResolvedValue(ok(fullActive));
    renderSection();
    const region = await loadedRegion("AI plan & usage");
    const panel = within(region);

    expect(panel.getByText("Active")).toBeDefined();
    expect(panel.getByText("Plan status")).toBeDefined();
    expect(panel.getByText(/Effective from/)).toBeDefined();
    expect(panel.getByText(/Effective until/)).toBeDefined();
    expect(panel.getByText("ai.briefing.daily")).toBeDefined();

    // The five tenant-facing states, plus the one for an unreasoned refusal.
    expect(panel.getAllByText("Available").length).toBeGreaterThan(0);
    expect(panel.getByText("Not in your plan")).toBeDefined();
    expect(panel.getByText("Trial ended")).toBeDefined();
    expect(panel.getByText(/Read only: saved results stay available/)).toBeDefined();
    expect(panel.getByText("Switched off by your account owner")).toBeDefined();
    expect(panel.getByText("Temporarily unavailable")).toBeDefined();
  });

  test("meters show limit, used, reserved, remaining and the reset time", async () => {
    read.mockResolvedValue(ok({ ...fullActive, features: [availableFeature] }));
    renderSection();
    const region = await loadedRegion();
    expect(within(region).getByText(/12 of 20 requests left, resets/)).toBeDefined();
    expect(within(region).getByText("Limit 20, used 7, in progress 1")).toBeDefined();
    expect(within(region).getByText("ai.briefing.requests")).toBeDefined();
    const reset = region.querySelector("time[datetime='2026-10-20T00:00:00Z']");
    expect(reset?.textContent).toMatch(/UTC/);
  });

  test("an exhausted meter reads 'Allowance used, resets <time>' beside an Available feature", async () => {
    read.mockResolvedValue(ok({ ...fullActive, features: [exhaustedFeature] }));
    renderSection();
    const region = await loadedRegion();
    expect(within(region).getByText("Available")).toBeDefined();
    expect(within(region).getByText(/Allowance used, resets/)).toBeDefined();
    expect(within(region).getByText(/Store allowance/)).toBeDefined();
    expect(region.textContent).toContain(STORE_ID);
  });

  test("an unavailable feature shows no allowance line, and a zero limit says so", async () => {
    read.mockResolvedValue(
      ok({
        ...fullActive,
        features: [
          { ...fullActive.features[4], meters: [fullActive.features[0].meters[0]] },
          {
            ...exhaustedFeature,
            meters: [{ ...fullActive.features[0].meters[0], limit: 0, remaining: 0 }],
          },
        ],
      }),
    );
    renderSection();
    const region = await loadedRegion();
    expect(within(region).queryByText(/requests left/)).toBeNull();
    expect(within(region).getByText(/No allowance in this window, resets/)).toBeDefined();
    expect(within(region).queryByText(/Allowance used/)).toBeNull();
  });

  test("a full-view role whose body is minimal is a load failure", async () => {
    read.mockResolvedValue(ok(minimalView));
    renderSection();
    expect((await screen.findByRole("alert")).textContent).toContain("could not be loaded");
    expect(screen.queryByText("Not available — ask your account owner")).toBeNull();
  });

  test("an opt-out shows who switched it off and when", async () => {
    read.mockResolvedValue(ok(fullActive));
    renderSection();
    const region = await loadedRegion();
    expect(region.querySelector("time[datetime='2026-10-12T08:15:00Z']")).not.toBeNull();
  });

  test("state none: no dates, every feature shown as not in the plan", async () => {
    read.mockResolvedValue(ok(fullNone));
    renderSection();
    const region = await loadedRegion();
    expect(within(region).getByText("No AI plan")).toBeDefined();
    expect(within(region).queryByText(/Effective from/)).toBeNull();
    expect(within(region).getByText("Not in your plan")).toBeDefined();
  });

  test("an unknown state or reason never reaches the screen as a code", async () => {
    read.mockResolvedValue(
      ok({
        ...fullActive,
        state: "paused",
        features: [{ ...fullActive.features[2], unavailableReason: "spend_cap_reached" }],
      }),
    );
    renderSection();
    const region = await loadedRegion();
    expect(within(region).getByText("Status not available")).toBeDefined();
    expect(within(region).getByText("Temporarily unavailable")).toBeDefined();
    expect(region.textContent).not.toMatch(/paused|spend_cap|cap_reached/);
  });

  test("never shows a price, token cost, credit balance or plan name, even if the body carries one", async () => {
    read.mockResolvedValue(
      ok({
        ...fullActive,
        price: "49.00 EGP",
        planName: "ai_ops",
        creditBalance: 1200,
        spendCap: 500,
        features: fullActive.features.map((f) => ({ ...f, tokenCost: 0.42, unitPrice: "0.10" })),
      }),
    );
    renderSection();
    const region = await loadedRegion();
    expect(region.textContent).not.toMatch(
      /49\.00|EGP|ai_ops|1,?200|spend|0\.42|0\.10|price|credit|token/i,
    );
  });

  test("has no grant control and no opt-out write control", async () => {
    read.mockResolvedValue(ok(fullActive));
    renderSection();
    const region = await loadedRegion();
    expect(within(region).queryAllByRole("button")).toHaveLength(0);
    expect(within(region).queryAllByRole("switch")).toHaveLength(0);
    expect(within(region).queryAllByRole("checkbox")).toHaveLength(0);
    expect(region.querySelector("form, input, select, textarea")).toBeNull();
  });
});

describe("store_manager: the minimal view (D-6)", () => {
  beforeEach(() => {
    role = "store_manager";
  });

  test("shows only whether each feature is available, with no plan or commercial wording", async () => {
    read.mockResolvedValue(ok(minimalView));
    renderSection();
    const region = await loadedRegion("AI features in your stores");
    const panel = within(region);
    expect(panel.getByText("ai.briefing.daily")).toBeDefined();
    expect(panel.getByText("Available")).toBeDefined();
    expect(panel.getByText("Not available — ask your account owner")).toBeDefined();
    expect(region.textContent).not.toMatch(/plan|usage|meter|limit|resets|trial|allowance|opt/i);
    expect(panel.queryByText("Not in your plan")).toBeNull();
  });

  test("a full body reaching a store_manager is still shown as the minimal projection", async () => {
    read.mockResolvedValue(ok(fullActive));
    renderSection();
    const region = await loadedRegion("AI features in your stores");
    expect(region.textContent).not.toMatch(
      /plan|usage|requests left|allowance|Trial ended|Switched off/i,
    );
    expect(region.querySelector("time")).toBeNull();
    expect(
      within(region).getAllByText("Not available — ask your account owner").length,
    ).toBeGreaterThan(0);
  });
});

describe("loading, error and unavailable states", () => {
  test("loading", async () => {
    read.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(await screen.findByText(/Loading AI features/)).toBeDefined();
  });

  test.each([404, 501, 503])(
    "%s (no runtime yet, or non-disclosing): a neutral line, no banner, no detail",
    async (status) => {
      read.mockResolvedValue({ status, error: apiError("entitlement_unavailable", "req-secret") });
      renderSection();
      expect(await screen.findByText("AI plan information is not available yet.")).toBeDefined();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(document.body.textContent).not.toMatch(/req-secret|entitlement_unavailable/);
    },
  );

  test("the neutral line for a store_manager has no plan wording", async () => {
    role = "store_manager";
    read.mockResolvedValue({ status: 404 });
    renderSection();
    expect(await screen.findByText("AI feature information is not available yet.")).toBeDefined();
    expect(screen.queryByText(/plan/i)).toBeNull();
  });

  test("401 shows the session message", async () => {
    read.mockResolvedValue({ status: 401, error: apiError("unauthenticated") });
    renderSection();
    expect(await screen.findByText("Your session has expired. Sign in again.")).toBeDefined();
  });

  test("a failure quotes only the request id, and Retry refetches", async () => {
    read.mockResolvedValueOnce({
      status: 500,
      error: apiError("internal_error", "req-500"),
    });
    read.mockResolvedValueOnce(ok(fullActive));
    renderSection();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The AI information could not be loaded.");
    expect(alert.textContent).toContain("req-500");
    expect(alert.textContent).not.toMatch(/internal_error/);
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Active")).toBeDefined();
    expect(read).toHaveBeenCalledTimes(2);
  });

  test("a 429 is the generic failure with retry (the shell banner owns the countdown)", async () => {
    read.mockResolvedValue({ status: 429, error: apiError("rate_limited") });
    renderSection();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The AI information could not be loaded.");
  });

  test("a thrown request is a failure, not a crash", async () => {
    read.mockRejectedValue(new Error("offline"));
    renderSection();
    expect((await screen.findByRole("alert")).textContent).toContain("could not be loaded");
    expect(document.body.textContent).not.toContain("offline");
  });

  test.each([
    ["not an object", ok("nope")],
    ["no features", ok({ view: "full", state: "active" })],
    ["no body", { status: 200 }],
  ])("a body that is %s is a load failure, never a throw", async (_name, response) => {
    read.mockResolvedValue(response);
    renderSection();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
  });
});

describe("Arabic", () => {
  test("renders the full view in Arabic with machine ids isolated LTR", async () => {
    setLocale("ar");
    read.mockResolvedValue(ok(fullActive));
    renderSection();
    const region = await loadedRegion("خطة الذكاء الاصطناعي والاستخدام");
    expect(within(region).getByText("غير مضمّنة في خطتك")).toBeDefined();
    expect(within(region).getByText("انتهت الفترة التجريبية")).toBeDefined();
    const id = within(region).getByText("ai.briefing.daily");
    expect(id.tagName).toBe("BDI");
    expect(id.getAttribute("dir")).toBe("ltr");
  });

  test("the minimal view in Arabic", async () => {
    setLocale("ar");
    role = "store_manager";
    read.mockResolvedValue(ok(minimalView));
    renderSection();
    const region = await loadedRegion("ميزات الذكاء الاصطناعي في متاجرك");
    expect(within(region).getByText("غير متاحة — اسأل مالك الحساب")).toBeDefined();
  });
});
