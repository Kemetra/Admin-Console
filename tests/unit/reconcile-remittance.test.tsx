import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const consoleReconcileRemittance = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    consoleReconcileRemittance: (...a: unknown[]) => consoleReconcileRemittance(...a),
  };
});

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { ReconcileRemittance } from "@/receivables/ReconcileRemittance";

function renderReconcile(onReconciled = vi.fn()): { onReconciled: typeof onReconciled } {
  const qc = createQueryClient();
  function Tree({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }
  render(
    <Tree>
      <ReconcileRemittance claimRef="c1" onClose={vi.fn()} onReconciled={onReconciled} />
    </Tree>,
  );
  return { onReconciled };
}

function result(status: number, body?: Record<string, unknown>, code?: string) {
  return {
    status,
    data: status === 200 ? body : undefined,
    error: code ? { error: { code, request_id: "req-x" } } : undefined,
    headers: new Headers(),
  };
}

function fillAndReconcile(amount = "100.00"): void {
  fireEvent.change(screen.getByLabelText(/remitted amount/i), { target: { value: amount } });
  fireEvent.click(screen.getByRole("button", { name: /reconcile/i }));
}

/**
 * 018 ReconcileRemittance drawer (VG-1). Validates remittedAmount (Money ≥0,
 * scale ≤4 — 0 is valid = full rejection) → consoleReconcileRemittance with a
 * per-submit Idempotency-Key → on 200 renders the ReconciliationResult
 * (variance + outcome settled|partial|flagged); 400→inline, 403/409→banner.
 * Mirrors 017's PayerCreate / 018's SubmitClaim.
 */
describe("ReconcileRemittance", () => {
  beforeEach(() => consoleReconcileRemittance.mockReset());

  test("non-numeric amount -> client validation, wrapper NOT called", async () => {
    renderReconcile();
    fillAndReconcile("abc");
    expect(await screen.findByText(/valid amount/i)).toBeDefined();
    expect(consoleReconcileRemittance).not.toHaveBeenCalled();
  });

  test("zero remittance is valid (full rejection) -> wrapper called", async () => {
    consoleReconcileRemittance.mockResolvedValue(
      result(200, {
        claimRef: "c1",
        claimedAmount: "100.00",
        remittedAmount: "0.00",
        variance: "100.00",
        outcome: "flagged",
      }),
    );
    renderReconcile();
    fillAndReconcile("0");
    await waitFor(() => expect(consoleReconcileRemittance).toHaveBeenCalled());
  });

  test("200 -> renders variance + outcome; onReconciled called; sends Idempotency-Key", async () => {
    consoleReconcileRemittance.mockResolvedValue(
      result(200, {
        claimRef: "c1",
        claimedAmount: "100.00",
        remittedAmount: "80.00",
        variance: "20.00",
        outcome: "partial",
      }),
    );
    const { onReconciled } = renderReconcile();
    fillAndReconcile("80.00");
    // The outcome renders as its catalog label; amounts through <Money>.
    expect(await screen.findByText("Partial")).toBeDefined();
    expect(screen.getByText("100.00 EGP")).toBeDefined();
    expect(screen.getByText("80.00 EGP")).toBeDefined();
    expect(screen.getByText("20.00 EGP")).toBeDefined();
    await waitFor(() => expect(onReconciled).toHaveBeenCalled());
    const [claimRef, body, key] = consoleReconcileRemittance.mock.calls[0];
    expect(claimRef).toBe("c1");
    // The typed amount goes to the API unchanged (inputs are never formatted).
    expect((body as { remittedAmount: string }).remittedAmount).toBe("80.00");
    expect(String(key)).toMatch(/^[\x21-\x7E]{16,128}$/);
  });

  test("large amounts and a NEGATIVE variance format exactly from the strings (no float)", async () => {
    // Over-remittance at the numeric(19,4) ceiling: claimed − remitted = −1250.5000.
    // Number() would round both amounts to 1e15 and lose the variance entirely.
    consoleReconcileRemittance.mockResolvedValue(
      result(200, {
        claimRef: "c1",
        claimedAmount: "999999999998749.4999",
        remittedAmount: "999999999999999.9999",
        variance: "-1250.5000",
        outcome: "flagged",
      }),
    );
    renderReconcile();
    fillAndReconcile("999999999999999.9999");
    expect(await screen.findByText("999,999,999,998,749.4999 EGP")).toBeDefined();
    expect(screen.getByText("999,999,999,999,999.9999 EGP")).toBeDefined();
    const variance = screen.getByText("-1,250.50 EGP");
    // The sign stays inside the LTR isolate, so RTL never moves it.
    expect(variance.tagName).toBe("BDI");
    expect(variance.getAttribute("dir")).toBe("ltr");
    expect(screen.getByText("Flagged")).toBeDefined();
  });

  test("403 -> permission banner", async () => {
    consoleReconcileRemittance.mockResolvedValue(result(403));
    renderReconcile();
    fillAndReconcile();
    await waitFor(() => expect(screen.getByText(/permission/i)).toBeDefined());
  });

  test("409 -> non-disclosing conflict banner", async () => {
    consoleReconcileRemittance.mockResolvedValue(result(409));
    renderReconcile();
    fillAndReconcile();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(
      screen.getByText("That remittance could not be reconciled. Please try again."),
    ).toBeDefined();
  });

  test("Arabic: title, labels, actions and result render in Arabic only", async () => {
    setLocale("ar");
    consoleReconcileRemittance.mockResolvedValue(
      result(200, {
        claimRef: "c1",
        claimedAmount: "1250.0000",
        remittedAmount: "2500.5000",
        variance: "-1250.5000",
        outcome: "partial",
      }),
    );
    renderReconcile();
    expect(screen.getByRole("heading", { name: "مطابقة السداد" })).toBeDefined();
    expect(screen.getByLabelText("المبلغ المسدَّد")).toBeDefined();
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeDefined();
    fireEvent.change(screen.getByLabelText("المبلغ المسدَّد"), { target: { value: "2500.50" } });
    fireEvent.click(screen.getByRole("button", { name: "مطابقة" }));
    expect(await screen.findByText("تسوية جزئية")).toBeDefined();
    expect(screen.getByText("الفرق")).toBeDefined();
    expect(screen.getByText("-1,250.50 EGP")).toBeDefined();
    expect(screen.getByRole("button", { name: "تم" })).toBeDefined();
    expect(screen.queryByText(/reconcile/i)).toBeNull();
    expect(screen.queryByText(/variance/i)).toBeNull();
  });
});
