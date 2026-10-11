/**
 * Role-code → label (RT-266 plan §3.5). `role_code` is a free string in the
 * contract, so an unrecognised code gets a localized fallback; a raw code never
 * reaches the copy (UX-12).
 */
import type { Locale } from "./locale";
import { type MessageKey, translate } from "./translate";

const ROLE_KEYS: Record<string, MessageKey> = {
  owner: "role.owner",
  tenant_admin: "role.tenant_admin",
  store_manager: "role.store_manager",
  platform_admin: "role.platform_admin",
  manager: "role.manager",
  cashier: "role.cashier",
};

/** The message key for a role code (`role.unknown` when unrecognised). */
export function roleKey(code: string): MessageKey {
  return Object.hasOwn(ROLE_KEYS, code) ? ROLE_KEYS[code] : "role.unknown";
}

export function roleLabel(code: string, locale: Locale): string {
  return translate(locale, roleKey(code));
}
