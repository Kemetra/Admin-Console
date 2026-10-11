import {
  type ClaimDraft,
  type RemittanceDraft,
  validateClaimDraft,
  validateRemittanceDraft,
} from "@/receivables/receivableForms";
import {
  type ReceivableListPage,
  flattenReceivablePages,
  nextReceivableCursor,
  receivableStateKey,
  reconciliationOutcomeKey,
} from "@/receivables/receivableListLogic";
import { type WriteCopy, classifyWriteOutcome } from "@/receivables/settlementWriteOutcome";
import { describe, expect, test } from "vitest";

/**
 * 018 receivables/claims pure logic — no client, no generated types. Mirrors the
 * 017 payer pure-logic shape: keyset pagination + form validation as pure
 * functions, tested against synthetic data.
 */
function page(items: string[], nextCursor: string | null): ReceivableListPage {
  return { items: items.map((receivableRef) => ({ receivableRef })), nextCursor };
}

describe("nextReceivableCursor", () => {
  test("present cursor -> that cursor", () => {
    expect(nextReceivableCursor(page(["a"], "CUR1"))).toBe("CUR1");
  });
  test("null cursor -> undefined (last page)", () => {
    expect(nextReceivableCursor(page(["a"], null))).toBeUndefined();
  });
});

describe("flattenReceivablePages", () => {
  test("flattens pages in order", () => {
    expect(
      flattenReceivablePages([page(["a", "b"], "C"), page(["c"], null)]).map(
        (r) => r.receivableRef,
      ),
    ).toEqual(["a", "b", "c"]);
  });
  test("empty -> []", () => {
    expect(flattenReceivablePages([page([], null)])).toEqual([]);
  });
});

function claim(over: Partial<ClaimDraft> = {}): ClaimDraft {
  return { payerRef: "11111111-1111-1111-1111-111111111111", receivableRefs: ["r1"], ...over };
}

describe("validateClaimDraft", () => {
  test("valid minimal claim -> no errors", () => {
    expect(validateClaimDraft(claim())).toEqual({});
  });
  test("missing payerRef -> error (a message key, not copy)", () => {
    expect(validateClaimDraft(claim({ payerRef: "" })).payerRef).toEqual({
      messageKey: "receivables.form.payerRequired",
    });
  });
  test("zero receivables -> error (contract minItems 1)", () => {
    expect(validateClaimDraft(claim({ receivableRefs: [] })).receivableRefs).toEqual({
      messageKey: "receivables.form.receivablesRequired",
    });
  });
  test("over 500 receivables -> error (contract maxItems 500) with the limit as a param", () => {
    const refs = Array.from({ length: 501 }, (_, i) => `r${i}`);
    expect(validateClaimDraft(claim({ receivableRefs: refs })).receivableRefs).toEqual({
      messageKey: "receivables.form.receivablesTooMany",
      params: { max: 500 },
    });
  });
  test("exactly 500 -> ok", () => {
    const refs = Array.from({ length: 500 }, (_, i) => `r${i}`);
    expect(validateClaimDraft(claim({ receivableRefs: refs })).receivableRefs).toBeUndefined();
  });
});

function remit(over: Partial<RemittanceDraft> = {}): RemittanceDraft {
  return { remittedAmount: "100.00", ...over };
}

describe("validateRemittanceDraft", () => {
  test("valid amount -> no errors", () => {
    expect(validateRemittanceDraft(remit())).toEqual({});
  });
  test("zero remittance -> OK (a full-rejection remittance is valid, remittedAmount>=0)", () => {
    expect(validateRemittanceDraft(remit({ remittedAmount: "0" })).remittedAmount).toBeUndefined();
  });
  test("non-numeric amount -> error (a message key, not copy)", () => {
    expect(validateRemittanceDraft(remit({ remittedAmount: "abc" })).remittedAmount).toEqual({
      messageKey: "receivables.form.amountInvalid",
    });
  });
  test("negative amount -> error (Money is non-negative exact-decimal)", () => {
    expect(
      validateRemittanceDraft(remit({ remittedAmount: "-5.00" })).remittedAmount,
    ).toBeDefined();
  });
  test("too many fractional digits -> error (scale 4)", () => {
    expect(
      validateRemittanceDraft(remit({ remittedAmount: "1.23456" })).remittedAmount,
    ).toBeDefined();
  });
});

/**
 * RT-399: raw `state` / `outcome` codes drive copy; they are not copy. Each maps
 * to a catalog label key; an unknown code (the lifecycle grows additively) gets
 * a localized fallback instead of leaking the raw value.
 */
describe("receivable label keys", () => {
  test("each lifecycle state maps to its own label key", () => {
    for (const state of ["open", "partially_applied", "settled", "claimed", "flagged"]) {
      expect(receivableStateKey(state)).toBe(`receivables.state.${state}`);
    }
  });
  test("an unknown state -> the localized fallback", () => {
    expect(receivableStateKey("reversal_consumed")).toBe("receivables.state.unknown");
  });
  test("each reconciliation outcome maps to its own label key; unknown -> fallback", () => {
    expect(reconciliationOutcomeKey("settled")).toBe("receivables.outcome.settled");
    expect(reconciliationOutcomeKey("partial")).toBe("receivables.outcome.partial");
    expect(reconciliationOutcomeKey("flagged")).toBe("receivables.outcome.flagged");
    expect(reconciliationOutcomeKey("hasOwnProperty")).toBe("receivables.outcome.unknown");
  });
});

const COPY: WriteCopy = {
  validation: "receivables.claim.errors.validation",
  unauthenticated: "receivables.errors.sessionExpired",
  forbidden: "receivables.claim.errors.forbidden",
  conflict: "receivables.claim.errors.conflict",
  error: "receivables.claim.errors.generic",
};

function write(status: number, code?: string) {
  return {
    status,
    headers: new Headers(),
    error: code || status >= 400 ? { error: { code, request_id: "req-x" } } : undefined,
  };
}

/**
 * The shared settlement-write classifier keeps its kinds and attaches the
 * calling drawer's message key (RT-399), so the drawer renders `t(messageKey)`.
 */
describe("classifyWriteOutcome", () => {
  test("2xx -> ok / replayed (no copy)", () => {
    expect(classifyWriteOutcome(write(201), COPY)).toEqual({ kind: "ok" });
    const replay = { ...write(200), headers: new Headers({ "Idempotent-Replayed": "true" }) };
    expect(classifyWriteOutcome(replay, COPY)).toEqual({ kind: "replayed" });
  });
  test("400 idempotency_key_* -> regenerate-key (not user-facing)", () => {
    expect(classifyWriteOutcome(write(400, "idempotency_key_required"), COPY)).toEqual({
      kind: "regenerate-key",
    });
  });
  test("each operator-facing outcome carries the drawer's message key", () => {
    expect(classifyWriteOutcome(write(400, "validation_failure"), COPY)).toEqual({
      kind: "validation",
      messageKey: COPY.validation,
      requestId: "req-x",
    });
    expect(classifyWriteOutcome(write(401), COPY)).toEqual({
      kind: "unauthenticated",
      messageKey: COPY.unauthenticated,
    });
    expect(classifyWriteOutcome(write(403), COPY)).toMatchObject({
      kind: "forbidden",
      messageKey: COPY.forbidden,
    });
    expect(classifyWriteOutcome(write(409, "idempotency_key_conflict"), COPY)).toMatchObject({
      kind: "key-conflict",
      messageKey: COPY.conflict,
    });
    expect(classifyWriteOutcome(write(409), COPY)).toMatchObject({
      kind: "conflict",
      messageKey: COPY.conflict,
    });
    expect(classifyWriteOutcome(write(503), COPY)).toMatchObject({
      kind: "error",
      messageKey: COPY.error,
      requestId: "req-x",
    });
  });
});
