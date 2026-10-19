/**
 * RT-665: who sees which view of the tenant's AI plan & usage. Mirrors the
 * Backend-Core role lists of the RT-662 contract (AD-AI-ENT-001 D-6): owner and
 * tenant_admin read the full view, store_manager the minimal one, store_staff
 * has no route. Not an authorization decision: the server stays the authority
 * and answers a non-disclosing 404 to anyone else. The Console only decides
 * whether to ask at all, so a role without a route never sends the request.
 *
 * A platform admin is admitted by the server for support, but the Console has no
 * such role code in the tenant page (as for the cash policy), so it is not
 * listed here.
 */
const FULL_VIEW_ROLES: readonly string[] = ["owner", "tenant_admin"];
const MINIMAL_VIEW_ROLES: readonly string[] = ["store_manager"];

export type AiPlanView = "full" | "minimal";

/** The view this role is entitled to ask for, or `undefined` for no access. */
export function aiPlanViewFor(role: string | null | undefined): AiPlanView | undefined {
  if (FULL_VIEW_ROLES.includes(role ?? "")) return "full";
  if (MINIMAL_VIEW_ROLES.includes(role ?? "")) return "minimal";
  return undefined;
}
