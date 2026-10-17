import { type PayerCreateDraft, validatePayerDraft } from "@/payers/payerCreateForm";
import { describe, expect, test } from "vitest";

/**
 * 017 create-payer form validation (FR / PayerAccountCreate) — pure, no client.
 * Mirrors the contract's PayerAccountCreate: required `category` (enum) +
 * `displayName` (1..200); optional `externalRef`, `storeId`, `creditTerms`
 * (opaque). No tax/credit-terms field invented (NG-8). The client validates only
 * what the contract constrains; the server remains authoritative.
 */
function draft(partial: Partial<PayerCreateDraft>): PayerCreateDraft {
  return { category: "credit_customer", displayName: "Acme", ...partial };
}

describe("validatePayerDraft", () => {
  test("valid minimal draft -> no errors", () => {
    expect(validatePayerDraft(draft({}))).toEqual({});
  });

  test("missing displayName -> required error (a message key, not copy)", () => {
    expect(validatePayerDraft(draft({ displayName: "" })).displayName).toEqual({
      messageKey: "payers.form.displayNameRequired",
    });
  });

  test("whitespace-only displayName -> required error (trimmed)", () => {
    expect(validatePayerDraft(draft({ displayName: "   " })).displayName).toBeDefined();
  });

  test("displayName over 200 chars -> length error with the limit as a param", () => {
    expect(validatePayerDraft(draft({ displayName: "x".repeat(201) })).displayName).toEqual({
      messageKey: "payers.form.displayNameTooLong",
      params: { max: 200 },
    });
  });

  test("the length rule applies to the TRIMMED name, the value that is sent", () => {
    const padded = `  ${"x".repeat(200)}  `;
    expect(validatePayerDraft(draft({ displayName: padded })).displayName).toBeUndefined();
    expect(
      validatePayerDraft(draft({ displayName: `  ${"x".repeat(201)}  ` })).displayName,
    ).toBeDefined();
  });

  test("a store scope is optional: null (tenant-wide) and a store id are both valid", () => {
    expect(validatePayerDraft(draft({ storeId: null }))).toEqual({});
    expect(validatePayerDraft(draft({ storeId: "6f1c2f6e-1c1d-4a5e-9d8e-0a1b2c3d4e5f" }))).toEqual(
      {},
    );
  });

  test("creditTerms is not part of the draft (RT-417: ERPNext owns payment terms)", () => {
    // @ts-expect-error — the removed field must not type-check
    const withTerms: PayerCreateDraft = draft({ creditTerms: { days: 30 } });
    expect(withTerms.category).toBe("credit_customer");
  });

  test("displayName exactly 200 -> ok", () => {
    expect(validatePayerDraft(draft({ displayName: "x".repeat(200) })).displayName).toBeUndefined();
  });

  test("invalid category not in the v1 enum -> category error", () => {
    // @ts-expect-error — exercising runtime guard against an out-of-enum value
    expect(validatePayerDraft(draft({ category: "patient" })).category).toEqual({
      messageKey: "payers.form.categoryRequired",
    });
  });

  test("each v1 category is accepted", () => {
    for (const category of ["credit_customer", "corporate", "insurer"] as const) {
      expect(validatePayerDraft(draft({ category })).category).toBeUndefined();
    }
  });
});
