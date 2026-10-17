import { canReadPayers } from "@/payers/payerAccess";
import { describe, expect, test } from "vitest";

/**
 * RT-421: only owner and tenant_admin see the payer screens, mirroring the
 * Backend-Core `@Roles("owner", "tenant_admin")` on both payer routes. The gate
 * mirrors the API for the nav and the page; it is not an authorization decision.
 */
describe("canReadPayers", () => {
  test.each(["owner", "tenant_admin"])("%s may", (role) => {
    expect(canReadPayers(role)).toBe(true);
  });

  test.each(["store_manager", "store_staff", "cashier", "auditor", "", null, undefined])(
    "%s may not",
    (role) => {
      expect(canReadPayers(role)).toBe(false);
    },
  );
});
