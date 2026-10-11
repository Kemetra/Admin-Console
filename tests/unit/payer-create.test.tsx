import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, test, vi } from "vitest";

const consoleCreatePayerAccount = vi.fn();
vi.mock("@/lib/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/client")>();
  return {
    ...actual,
    consoleCreatePayerAccount: (...a: unknown[]) => consoleCreatePayerAccount(...a),
  };
});

import { setLocale } from "@/i18n/locale";
import { createQueryClient } from "@/lib/query";
import { PayerCreate } from "@/payers/PayerCreate";

function renderCreate(onCreated = vi.fn()): { onCreated: typeof onCreated } {
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
      <PayerCreate
        activeTenant={{ id: "t1", name: "Northstar Retail" }}
        onClose={vi.fn()}
        onCreated={onCreated}
      />
    </Tree>,
  );
  return { onCreated };
}

function result(status: number, code?: string, headers: Record<string, string> = {}) {
  return {
    status,
    data: status === 201 ? { payerRef: "p1" } : undefined,
    error: code ? { error: { code, request_id: "req-x" } } : undefined,
    headers: new Headers(headers),
  };
}

function fillAndCreate(displayName = "MedCover Insurance"): void {
  fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: displayName } });
  fireEvent.click(screen.getByRole("button", { name: /create payer/i }));
}

/**
 * 017 PayerCreate drawer (VG-1). Wires validatePayerDraft (client guard) +
 * consoleCreatePayerAccount (idempotency-keyed) + classifyPayerCreateOutcome:
 *   201/replayed -> onCreated; 400 -> inline; 403 -> banner; 409 -> non-disclosing.
 * status/version are NOT in the form (OQ-CON-EDIT deferred; create-only v1).
 */
describe("PayerCreate", () => {
  beforeEach(() => consoleCreatePayerAccount.mockReset());

  test("empty displayName -> client validation, wrapper NOT called", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /create payer/i }));
    expect(await screen.findByText(/display name is required/i)).toBeDefined();
    expect(consoleCreatePayerAccount).not.toHaveBeenCalled();
  });

  test("201 -> onCreated called; create sends an Idempotency-Key", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(201));
    const { onCreated } = renderCreate();
    fillAndCreate();
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    // wrapper called as (body, idempotencyKey)
    const [, key] = consoleCreatePayerAccount.mock.calls[0];
    expect(String(key)).toMatch(/^[\x21-\x7E]{16,128}$/);
  });

  test("400 validation -> inline error, onCreated NOT called", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(400, "validation_failure"));
    const { onCreated } = renderCreate();
    fillAndCreate();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(onCreated).not.toHaveBeenCalled();
  });

  test("403 -> permission banner", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(403));
    renderCreate();
    fillAndCreate();
    await waitFor(() => expect(screen.getByText(/permission/i)).toBeDefined());
  });

  test("409 -> non-disclosing conflict banner", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(409));
    renderCreate();
    fillAndCreate();
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText("That payer account could not be created.")).toBeDefined();
  });

  test("category options are catalog labels; the submitted value stays the raw code", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(201));
    renderCreate();
    const select = screen.getByLabelText("Category") as HTMLSelectElement;
    const options = [...select.options].map((o) => [o.value, o.textContent]);
    expect(options).toEqual([
      ["credit_customer", "Credit customer"],
      ["corporate", "Corporate"],
      ["insurer", "Insurer"],
    ]);
    fireEvent.change(select, { target: { value: "insurer" } });
    fillAndCreate();
    await waitFor(() => expect(consoleCreatePayerAccount).toHaveBeenCalled());
    const [body] = consoleCreatePayerAccount.mock.calls[0];
    expect((body as { category: string }).category).toBe("insurer");
  });

  test("a shown error follows a locale switch (state holds the key, not a string)", async () => {
    renderCreate();
    fireEvent.click(screen.getByRole("button", { name: /create payer/i }));
    expect(await screen.findByText("Display name is required.")).toBeDefined();
    act(() => setLocale("ar"));
    expect(screen.getByText("الاسم المعروض مطلوب.")).toBeDefined();
    expect(screen.queryByText("Display name is required.")).toBeNull();
  });

  test("Arabic: title, labels and actions render in Arabic only", async () => {
    setLocale("ar");
    consoleCreatePayerAccount.mockResolvedValue(result(403));
    renderCreate();
    expect(screen.getByRole("heading", { name: "إضافة حساب جهة دفع" })).toBeDefined();
    expect(screen.getByLabelText("الاسم المعروض")).toBeDefined();
    expect(screen.getByRole("option", { name: "شركة تأمين" })).toBeDefined();
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeDefined();
    fireEvent.change(screen.getByLabelText("الاسم المعروض"), { target: { value: "ميد كوفر" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة جهة دفع" }));
    expect(
      await screen.findByText("ليست لديك صلاحية لإضافة حسابات جهات الدفع في هذه المؤسسة."),
    ).toBeDefined();
    expect(screen.queryByText(/create payer/i)).toBeNull();
    expect(screen.queryByText(/permission/i)).toBeNull();
  });
});
