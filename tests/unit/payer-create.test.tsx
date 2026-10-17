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

const STORES = [
  { id: "6f1c2f6e-1c1d-4a5e-9d8e-0a1b2c3d4e5f", name: "Cairo Festival City" },
  { id: "0b7e51a4-3f9d-4c75-8a3e-52f0c1b9d7aa", name: "New Cairo Mall" },
];

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
        stores={STORES}
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
  // A block body: an arrow that RETURNS the mock would make vitest call it as a
  // cleanup hook (with no arguments) after every test.
  beforeEach(() => {
    consoleCreatePayerAccount.mockReset();
  });

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

  test("the body is exactly the contract: no creditTerms, tenant-wide by default (storeId null)", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(201));
    renderCreate();
    fillAndCreate("  MedCover Insurance  ");
    await waitFor(() => expect(consoleCreatePayerAccount).toHaveBeenCalled());
    const [body] = consoleCreatePayerAccount.mock.calls[0];
    expect(body).toEqual({
      category: "credit_customer",
      displayName: "MedCover Insurance",
      externalRef: null,
      storeId: null,
    });
    expect(Object.keys(body as object)).not.toContain("creditTerms");
  });

  test("scope: Whole tenant first, then the caller's stores; a chosen store is sent as storeId", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(201));
    renderCreate();
    const scope = screen.getByLabelText("Scope") as HTMLSelectElement;
    expect([...scope.options].map((o) => [o.value, o.textContent])).toEqual([
      ["", "Whole tenant (all stores)"],
      [STORES[0].id, "Cairo Festival City"],
      [STORES[1].id, "New Cairo Mall"],
    ]);
    expect(scope.value).toBe("");
    fireEvent.change(scope, { target: { value: STORES[1].id } });
    fillAndCreate();
    await waitFor(() => expect(consoleCreatePayerAccount).toHaveBeenCalled());
    expect((consoleCreatePayerAccount.mock.calls[0][0] as { storeId: string }).storeId).toBe(
      STORES[1].id,
    );
  });

  test("externalRef is the ERPNext Customer link: labelled so, trimmed, and blank means null", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(201));
    renderCreate();
    const field = screen.getByLabelText("ERPNext Customer (optional)");
    expect(screen.queryByLabelText(/external reference/i)).toBeNull();
    fireEvent.change(field, { target: { value: "  CUST-0042  " } });
    fillAndCreate();
    await waitFor(() => expect(consoleCreatePayerAccount).toHaveBeenCalledTimes(1));
    expect(
      (consoleCreatePayerAccount.mock.calls[0][0] as { externalRef: string }).externalRef,
    ).toBe("CUST-0042");
  });

  test("a whitespace-only ERPNext Customer is sent as null, never as a blank (the contract 400s it)", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(201));
    renderCreate();
    fireEvent.change(screen.getByLabelText("ERPNext Customer (optional)"), {
      target: { value: "   " },
    });
    fillAndCreate();
    await waitFor(() => expect(consoleCreatePayerAccount).toHaveBeenCalled());
    expect(
      (consoleCreatePayerAccount.mock.calls[0][0] as { externalRef: null }).externalRef,
    ).toBeNull();
  });

  test("404 (an out-of-scope store) -> a non-disclosing banner, not the generic error", async () => {
    consoleCreatePayerAccount.mockResolvedValue({
      ...result(404, "not_found"),
      error: {
        error: {
          code: "not_found",
          message: "store s9 belongs to tenant t2",
          request_id: "req-404",
        },
      },
    });
    const { onCreated } = renderCreate();
    fillAndCreate();
    expect(
      await screen.findByText("That store can't be used for this payer. Choose another scope."),
    ).toBeDefined();
    expect(screen.queryByText(/belongs to tenant/)).toBeNull();
    expect(screen.queryByText(/something went wrong/i)).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });

  test("422 is handled like a validation failure: one inline message, never the server's words", async () => {
    consoleCreatePayerAccount.mockResolvedValue({
      ...result(422),
      error: { error: { code: "unprocessable", message: "secret cause" } },
    });
    const { onCreated } = renderCreate();
    fillAndCreate();
    expect(await screen.findByText("Check the payer details and try again.")).toBeDefined();
    expect(screen.queryByText(/secret/)).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });

  test("401 -> the session-expired banner", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(401));
    renderCreate();
    fillAndCreate();
    expect(await screen.findByText("Your session has expired. Sign in again.")).toBeDefined();
  });

  test("a retry of the same payer after a 5xx reuses the Idempotency-Key (no second payer)", async () => {
    consoleCreatePayerAccount.mockResolvedValueOnce(result(503)).mockResolvedValueOnce(result(201));
    const { onCreated } = renderCreate();
    fillAndCreate();
    await screen.findByText(/something went wrong/i);
    fireEvent.click(screen.getByRole("button", { name: /create payer/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const [[, first], [, second]] = consoleCreatePayerAccount.mock.calls;
    expect(second).toBe(first);
  });

  test("editing the payer between attempts mints a new key (the old key with another body would 409)", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(503));
    renderCreate();
    fillAndCreate("MedCover Insurance");
    await screen.findByText(/something went wrong/i);
    fillAndCreate("MedCover Insurance Ltd");
    await waitFor(() => expect(consoleCreatePayerAccount).toHaveBeenCalledTimes(2));
    const [[, first], [, second]] = consoleCreatePayerAccount.mock.calls;
    expect(second).not.toBe(first);
  });

  test("409 idempotency_key_conflict -> the next attempt uses a NEW key", async () => {
    consoleCreatePayerAccount
      .mockResolvedValueOnce(result(409, "idempotency_key_conflict"))
      .mockResolvedValueOnce(result(201));
    const { onCreated } = renderCreate();
    fillAndCreate();
    await screen.findByText("That payer could not be created. Please try again.");
    fireEvent.click(screen.getByRole("button", { name: /create payer/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const [[, first], [, second]] = consoleCreatePayerAccount.mock.calls;
    expect(second).not.toBe(first);
  });

  test("a malformed-key 400 is retried once with a fresh key, then stops (no unbounded loop)", async () => {
    consoleCreatePayerAccount.mockResolvedValue(result(400, "idempotency_key_malformed"));
    const { onCreated } = renderCreate();
    fillAndCreate();
    await screen.findByText(/something went wrong/i);
    expect(consoleCreatePayerAccount).toHaveBeenCalledTimes(2);
    const [[, first], [, second]] = consoleCreatePayerAccount.mock.calls;
    expect(second).not.toBe(first);
    expect(onCreated).not.toHaveBeenCalled();
  });

  test("a network failure (the request throws) is a generic banner and the form is usable again", async () => {
    consoleCreatePayerAccount.mockRejectedValue(new TypeError("Failed to fetch"));
    renderCreate();
    fillAndCreate();
    expect(await screen.findByText(/something went wrong/i)).toBeDefined();
    expect(screen.queryByText(/failed to fetch/i)).toBeNull();
    expect(
      (screen.getByRole("button", { name: /create payer/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
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
