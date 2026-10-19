/**
 * RT-724: who sees the unknown-items queue in the navigation. The list and
 * inspect routes are `@Roles("owner", "tenant_admin", "store_manager")` in
 * Backend-Core (a 403 for anyone else), so the nav entry mirrors that. Not an
 * authorization decision: the server stays the authority, and the actions on
 * the queue are never hidden by role (VG-5).
 */
export const READ_ROLES = ["owner", "tenant_admin", "store_manager"] as const;

export function canReadUnknownItems(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}
