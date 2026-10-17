/**
 * RT-389: who sees which part of the shift variance policy. Mirrors the
 * Backend-Core role lists (AD-CASH-001 DR-10): configuring is owner /
 * tenant_admin; a store's effective policy is also readable by store_manager
 * (read only). Not an authorization decision: the server stays the authority
 * and answers a non-disclosing 404 to anyone else.
 */
const CONFIGURE_ROLES: readonly string[] = ["owner", "tenant_admin"];
const READ_STORE_ROLES: readonly string[] = ["owner", "tenant_admin", "store_manager"];

export function canConfigurePolicy(role: string | null | undefined): boolean {
  return CONFIGURE_ROLES.includes(role ?? "");
}

export function canReadStorePolicy(role: string | null | undefined): boolean {
  return READ_STORE_ROLES.includes(role ?? "");
}

/** A permanent override (no expiry, or beyond the horizon) is owner-only (DR-4). */
export function canApprovePermanent(role: string | null | undefined): boolean {
  return role === "owner";
}
