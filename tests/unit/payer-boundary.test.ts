import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as client from "@/lib/client";
import { describe, expect, test } from "vitest";

/**
 * 017 payer boundary (CON-G1 / SC-001, VG-1..VG-4). The payer wrappers consume
 * EXACTLY the two settlement payer ops via the generated client, send the create
 * idempotency header, and 017's OWN code reaches NO other settlement op (no
 * receivable/claim/reconcile/apply-payment/POS-intent). Mirrors rf2-boundary:
 * the forbidden-op scan is scoped to the slice's own files (src/payers/**) — the
 * shared client.ts holds EVERY slice's wrappers, so it cannot be the scope.
 */
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

const clientSrc = stripComments(readFileSync(join(process.cwd(), "src/lib/client.ts"), "utf8"));
const payerSrc = filesUnder(join(process.cwd(), "src/payers"))
  .map((f) => stripComments(readFileSync(f, "utf8")))
  .join("\n");

describe("payer wrappers — surface", () => {
  test("VG-1: both payer wrappers are exported", () => {
    expect(typeof client.consoleCreatePayerAccount).toBe("function");
    expect(typeof client.consoleListPayerAccounts).toBe("function");
  });

  test("VG-1: wrappers call the generated payer-accounts path (no hand-rolled fetch)", () => {
    expect(clientSrc).toContain('"/api/v1/settlement/payer-accounts"');
    expect(clientSrc).not.toMatch(/\bfetch\s*\(/);
  });

  test("create sends the Idempotency-Key header (FR-005)", () => {
    expect(clientSrc).toMatch(/"Idempotency-Key"\s*:/);
  });

  test("VG-2: 017's own code reaches NO other settlement op (only the two payer ops)", () => {
    for (const forbidden of [
      "consoleGetReceivable",
      "consoleListReceivables",
      "consoleSubmitClaim",
      "consoleReconcileRemittance",
      "consoleApplyPayment",
      "posRecordSettlementIntent",
    ]) {
      expect(payerSrc).not.toContain(forbidden);
    }
  });

  test("RT-421: the retired 018/019 wrappers are not exported (settlement.yaml 2.0.0)", () => {
    for (const retired of [
      "consoleListReceivables",
      "consoleGetReceivable",
      "consoleSubmitClaim",
      "consoleReconcileRemittance",
      "consoleApplyPayment",
    ]) {
      expect(Object.keys(client)).not.toContain(retired);
    }
  });

  test("RT-421: the create body carries no creditTerms (2.0.0 is strict: it would be a 400)", () => {
    expect(clientSrc).not.toMatch(/creditTerms|credit_terms/);
    expect(payerSrc).not.toMatch(/creditTerms|credit_terms/);
  });

  test("RT-421: the Console never calls ERPNext/Frappe from the payer screens", () => {
    expect(payerSrc).not.toMatch(/frappe|erpnext\.com|\/api\/resource|\/api\/method/i);
  });

  test("VG-3: 017's own code sets no Authorization/Bearer header (cookie transport only)", () => {
    expect(payerSrc).not.toMatch(/[Aa]uthorization\s*:/);
    expect(payerSrc).not.toMatch(/[Bb]earer\s+/);
  });
});
