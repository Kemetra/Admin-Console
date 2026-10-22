/**
 * RT-781 (RT-777 S2): the ONE place a tenant call refused with 403
 * `support_session_expired` is recognised (contract `SupportSessionRefused`).
 * An openapi-fetch middleware, installed once at boot beside the 429 tracker,
 * bumps a shared counter; the support-session bar reads it so the page switches
 * to the expired state instead of the surface's generic 403 banner.
 *
 * Only status 403 with that exact code counts. `forbidden`, `origin_rejected`,
 * `support_session_required` and `support_session_read_only` are other refusals
 * and stay with the surface that made the call. The renew 409
 * `support_session_expired` is classified by the bar's own action, not here.
 */
import type { components } from "@/generated/schema";
import type { Client, Middleware } from "openapi-fetch";

export const SUPPORT_SESSION_EXPIRED_CODE = "support_session_expired";

/** 403 plus the contract code; the HTTP status is the gate, the code the discriminator. */
export function isSupportSessionExpiredRefusal(status: number, code: unknown): boolean {
  return status === 403 && code === SUPPORT_SESSION_EXPIRED_CODE;
}

export interface SupportSessionExpiryState {
  /** Bumps on every `support_session_expired` refusal (0 = none seen yet). */
  seq: number;
}

let state: SupportSessionExpiryState = { seq: 0 };
const listeners = new Set<() => void>();

export function getSupportSessionExpiryState(): SupportSessionExpiryState {
  return state;
}

export function subscribeSupportSessionExpiry(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportSupportSessionExpired(): void {
  state = { seq: state.seq + 1 };
  for (const listener of listeners) listener();
}

/** Test seam: forget every recorded refusal. */
export function resetSupportSessionExpiry(): void {
  state = { seq: 0 };
  for (const listener of listeners) listener();
}

async function envelopeCode(response: Response): Promise<unknown> {
  try {
    const body = (await response.clone().json()) as Partial<components["schemas"]["Error"]> | null;
    return body?.error?.code;
  } catch {
    return undefined;
  }
}

const expiryMiddleware: Middleware = {
  async onResponse({ response }) {
    if (response.status === 403) {
      const code = await envelopeCode(response);
      if (isSupportSessionExpiredRefusal(response.status, code)) reportSupportSessionExpired();
    }
    return response;
  },
};

/** Installed once at boot (src/main.tsx). Never alters the response. */
// biome-ignore lint/suspicious/noExplicitAny: any generated `paths` type.
export function installSupportSessionExpiryTracking(client: Client<any>): void {
  client.use(expiryMiddleware);
}
