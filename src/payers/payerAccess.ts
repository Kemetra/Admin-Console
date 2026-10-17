/**
 * RT-421: who sees the payer screens. Both payer routes are
 * `@Roles("owner", "tenant_admin")` in Backend-Core (a 403 for anyone else), so
 * the nav entry and the page mirror that. Not an authorization decision: the
 * server stays the authority.
 */
export const READ_ROLES = ["owner", "tenant_admin"] as const;

export function canReadPayers(role: string | null | undefined): boolean {
  return (READ_ROLES as readonly string[]).includes(role ?? "");
}
