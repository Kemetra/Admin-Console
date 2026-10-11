import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as client from "@/lib/client";
import {
  type ApplyPaymentDraft,
  validateApplyPaymentDraft,
} from "@/settlement-reconciliation/applyPaymentForm";
import { describe, expect, test } from "vitest";

/**
 * 019 apply-payment pure logic + boundary. consoleApplyPayment is 019's OWN
 * surface (cash application, 7-C). Amount is STRICTLY POSITIVE (unlike a
 * remittance, which allows 0) — the contract's payment_application_amount_positive
 * CHECK. version is the optimistic-concurrency int. Pure validation; no client.
 *
 * Boundary (VG): 019's own code (src/settlement-reconciliation/**) reaches
 * consoleApplyPayment + receivable reads ONLY — NOT consoleRepairSaleSync (the
 * GATED 032 posting-retry op, not in the generated client), NOT claim ops (018),
 * NOT payer-CRUD (017).
 */
function draft(over: Partial<ApplyPaymentDraft> = {}): ApplyPaymentDraft {
  return { amount: "50.00", version: 0, ...over };
}

describe("validateApplyPaymentDraft", () => {
  test("valid positive amount -> no errors", () => {
    expect(validateApplyPaymentDraft(draft())).toEqual({});
  });
  test("zero amount -> error (apply requires >0, unlike remittance)", () => {
    // RT-399: a message key, translated at render; never a copy string.
    expect(validateApplyPaymentDraft(draft({ amount: "0" })).amount).toBe(
      "settlement.form.amountInvalid",
    );
  });
  test("negative amount -> error", () => {
    expect(validateApplyPaymentDraft(draft({ amount: "-5.00" })).amount).toBeDefined();
  });
  test("non-numeric -> error", () => {
    expect(validateApplyPaymentDraft(draft({ amount: "abc" })).amount).toBeDefined();
  });
  test("too many fractional digits -> error (scale 4)", () => {
    expect(validateApplyPaymentDraft(draft({ amount: "1.23456" })).amount).toBeDefined();
  });
  test("missing/invalid version -> error", () => {
    // Cast to exercise the runtime guard against a non-integer version.
    expect(
      validateApplyPaymentDraft({ amount: "50.00", version: undefined as unknown as number })
        .version,
    ).toBe("settlement.form.versionInvalid");
  });
});

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
function filesUnder(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) filesUnder(full, acc);
    else if (/\.(ts|tsx)$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("apply-payment wrapper — surface", () => {
  test("VG-1: consoleApplyPayment wrapper is exported + calls the generated path", () => {
    expect(typeof client.consoleApplyPayment).toBe("function");
    const clientSrc = stripComments(readFileSync(join(process.cwd(), "src/lib/client.ts"), "utf8"));
    expect(clientSrc).toContain('"/api/v1/settlement/receivables/{receivableRef}/apply-payment"');
  });

  test("VG-2: 019's own code reaches NO gated/foreign op (no RepairSaleSync, no claim, no payer-CRUD)", () => {
    const reconSrc = filesUnder(join(process.cwd(), "src/settlement-reconciliation"))
      .map((f) => stripComments(readFileSync(f, "utf8")))
      .join("\n");
    for (const forbidden of [
      "consoleRepairSaleSync", // GATED 032 posting-retry — not built here
      "consoleSubmitClaim",
      "consoleReconcileRemittance",
      "consoleCreatePayerAccount",
    ]) {
      expect(reconSrc).not.toContain(forbidden);
    }
  });
});
