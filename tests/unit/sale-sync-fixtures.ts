/** RT-726 shared test data: sale sync-ops payloads for one Cairo sale. */
import type { DeadLetterDetail, SaleSyncStatus } from "@/lib/sale-sync-ops-queries";

export const STORE = "0190f000-0000-7000-8000-0000000007a1";
export const OTHER_STORE = "0190f000-0000-7000-8000-0000000007a2";
export const SALE = "0190f000-0000-7000-8000-0000000007b1";
export const SALE_2 = "0190f000-0000-7000-8000-0000000007b2";
export const CORRELATION = "0190f000-0000-7000-8000-0000000007c1";
export const REQUEST_ID = "11111111-2222-4333-8444-555555555555";

export function deadLetter(over: Partial<DeadLetterDetail> = {}): DeadLetterDetail {
  return {
    classification: "needs-repair",
    reasonCode: "validation_error",
    retryCount: 3,
    quarantinedAt: "2026-10-07T10:31:00Z",
    resolvedAt: null,
    ...over,
  };
}

export function syncStatus(over: Partial<SaleSyncStatus> = {}): SaleSyncStatus {
  return {
    saleRef: SALE,
    storeId: STORE,
    syncStatus: "failed-needs-repair",
    sourceSystem: "pos",
    externalId: "POS-CAI-0042",
    processedAt: null,
    deadLetter: deadLetter(),
    ...over,
  };
}

export function timeline(entries: unknown[] = defaultEntries()) {
  return { saleRef: SALE, entries };
}

export function defaultEntries() {
  return [
    { at: "2026-10-07T10:30:04Z", event: "sale.captured", correlationId: null },
    { at: "2026-10-07T10:31:00Z", event: "sync.needs_repair", correlationId: CORRELATION },
  ];
}

export function repairItem(over: Record<string, unknown> = {}) {
  return {
    saleRef: SALE,
    storeId: STORE,
    syncStatus: "failed-needs-repair",
    sourceSystem: "pos",
    externalId: "POS-CAI-0042",
    reasonCode: "validation_error",
    retryCount: 3,
    quarantinedAt: "2026-10-07T10:31:00Z",
    ...over,
  };
}

export const ok = <T>(data: T) => ({ status: 200, data });

export const failure = (status: number, code = "x", retryAfter?: number) => ({
  status,
  error: { error: { code, message: "x", request_id: REQUEST_ID } },
  retryAfter,
});

export function ctx(role: string | null = "owner", tenant = true) {
  return {
    context: {
      user: { id: "u1", display_name: "Amal Saleh" },
      active_tenant: tenant ? { id: "t1", name: "Northstar Retail" } : null,
      active_store: null,
      active_role_code: role,
      memberships: [{ tenant_id: "t1", tenant_name: "Northstar Retail", role_code: role }],
    },
    switchTenant: () => {},
    switchStore: () => {},
    clearStore: () => {},
  };
}
