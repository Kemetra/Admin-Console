import type {
  ConnectorHealthView,
  ConnectorInstance,
  DomainSummary,
  PostingBacklogItem,
  ReconciliationRunView,
} from "@/lib/erp-status-queries";

/** RT-560 fixtures, shaped by the generated contract types. */
export const INSTANCE_A = "0190f000-0000-7000-8000-0000000000e1";
export const INSTANCE_B = "0190f000-0000-7000-8000-0000000000e2";
export const STORE_A = "0190f000-0000-7000-8000-0000000000a1";

export function instance(over: Partial<ConnectorInstance> = {}): ConnectorInstance {
  return {
    id: INSTANCE_A,
    display_name: "Northstar ERP",
    erpnext_site_ref: "erp.northstar.eg",
    environment: "pilot",
    created_at: "2026-09-01T08:00:00Z",
    disabled_at: null,
    active_credential: {
      credential_id: "0190f000-0000-7000-8000-0000000000f1",
      instance_id: INSTANCE_A,
      issued_at: "2026-09-01T08:00:00Z",
      expires_at: "2027-03-01T08:00:00Z",
      revoked_at: null,
    },
    ...over,
  };
}

export function healthView(over: Partial<ConnectorHealthView> = {}): ConnectorHealthView {
  return {
    connectorId: INSTANCE_A,
    displayName: "Northstar ERP",
    environment: "pilot",
    erpnextSiteRef: "erp.northstar.eg",
    lastSeenAt: null,
    liveness: "never_seen",
    secondsSinceLastSeen: null,
    connectorVersion: null,
    backlogIndicator: null,
    erpnextReachable: null,
    reportedFieldsAt: null,
    ...over,
  };
}

export function domain(over: Partial<DomainSummary> = {}): DomainSummary {
  return { domain: "posting", status: "ok", headlineCount: 0, detail: null, ...over };
}

export function backlogItem(over: Partial<PostingBacklogItem> = {}): PostingBacklogItem {
  return {
    postingStatusId: "0190f000-0000-7000-8000-0000000000c1",
    kind: "sale_post",
    sourceSystem: "pos",
    externalId: "SALE-0001",
    status: "permanently_rejected",
    rejectionClass: "validation",
    deadLetteredAt: "2026-10-10T09:00:00Z",
    ...over,
  };
}

export function run(over: Partial<ReconciliationRunView> = {}): ReconciliationRunView {
  return {
    runId: "0190f000-0000-7000-8000-0000000000d1",
    storeId: STORE_A,
    kind: "stock",
    trigger: "scheduled",
    status: "completed",
    startedAt: "2026-10-12T02:00:00Z",
    finishedAt: "2026-10-12T02:03:00Z",
    mismatchSummary: { negative_on_hand: 2 },
    ...over,
  };
}
