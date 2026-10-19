import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TENANT_ID, fullActive } from "./ai-plan-fixtures";

/**
 * RT-665: the tenant page actually mounts the panel (the boundary test only scans
 * the source). The gate defaults to `import.meta.env.DEV`, which is on under
 * vitest, as in a dev build; a production build is covered by the e2e.
 */
vi.mock("@/context/ActiveContextProvider", () => ({
  useActiveContextValue: () => ({
    context: { active_tenant: { id: TENANT_ID }, active_role_code: "owner" },
  }),
}));

const readAi = vi.fn();
vi.mock("@/lib/ai-entitlements-queries", () => ({
  consoleGetTenantAiEntitlements: (...a: unknown[]) => readAi(...a),
}));
vi.mock("@/lib/cash-variance-policy-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cash-variance-policy-queries")>();
  return {
    ...actual,
    consoleGetTenantCashVariancePolicy: () => Promise.resolve({ status: 404 }),
    consoleListTenantCashVariancePolicyRevisions: () => Promise.resolve({ status: 404 }),
  };
});
vi.mock("@/lib/rf2-queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rf2-queries")>();
  return {
    ...actual,
    readTenant: () =>
      Promise.resolve({
        status: 200,
        data: { id: TENANT_ID, slug: "northstar", name: "Northstar Retail", status: "active" },
      }),
  };
});
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useParams: () => ({ tenantId: TENANT_ID }) };
});

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { TenantDetail } from "@/tenants/TenantDetail";

describe("TenantDetail mounts the AI plan panel", () => {
  beforeEach(() => {
    readAi.mockReset();
    setLocale("en");
  });

  test("an owner of the active tenant sees the panel, and the page still renders", async () => {
    readAi.mockResolvedValue({ status: 200, data: fullActive });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <TenantDetail />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("heading", { name: "Northstar Retail" })).toBeDefined();
    expect(await screen.findByRole("region", { name: "AI plan & usage" })).toBeDefined();
    await waitFor(() => expect(readAi).toHaveBeenCalledWith(TENANT_ID));
  });

  test("a missing runtime leaves the tenant page intact", async () => {
    readAi.mockResolvedValue({ status: 404 });
    render(
      <QueryClientProvider client={createQueryClient()}>
        <MemoryRouter>
          <TenantDetail />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("AI plan information is not available yet.")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Northstar Retail" })).toBeDefined();
  });
});
