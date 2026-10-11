/**
 * Sign-in response → next-action decision (SF-1, T021/T023, FR-003-007).
 *
 * Pure logic, no React. Given the `signIn` result, decide what SF-1 should do:
 * show a generic error (401/5xx — never leak account existence), a rate-limit
 * state (429), or, on success, branch on membership count:
 *   0 → no-access (S7) · 1 → auto-select that tenant (OQ-4) · >1 → chooser (S2).
 *
 * RT-399: the error outcome carries a catalog `MessageKey`, never copy; SF-1
 * translates it at render, so a locale switch re-renders it.
 */
import type { MessageKey } from "@/i18n";

/** Backend error envelope: { error: { code, message, request_id } } (schema Error). */
interface BackendError {
  error?: { code?: string; message?: string; request_id?: string };
}

export interface SignInInput {
  status: number;
  data?: { memberships?: Array<{ tenant_id: string; tenant_name?: string }> };
  error?: BackendError;
  retryAfterSeconds?: number;
}

export type SignInResolution =
  | { kind: "auto-select"; tenantId: string }
  | { kind: "choose" }
  | { kind: "no-access" }
  | { kind: "rate-limited"; retryAfterSeconds: number; requestId?: string }
  | { kind: "error"; messageKey: MessageKey; requestId?: string };

const GENERIC_SIGNIN_ERROR: MessageKey = "auth.signIn.errors.failed";

export function resolveSignIn(input: SignInInput): SignInResolution {
  if (input.status === 429) {
    return {
      kind: "rate-limited",
      retryAfterSeconds: input.retryAfterSeconds ?? 0,
      requestId: input.error?.error?.request_id,
    };
  }

  if (input.status >= 400) {
    // 401 and 5xx alike render the SAME generic message (no account-existence
    // leak, FR-003-007). request_id is surfaced for support (VD-4).
    return {
      kind: "error",
      messageKey: GENERIC_SIGNIN_ERROR,
      requestId: input.error?.error?.request_id,
    };
  }

  const memberships = input.data?.memberships ?? [];
  if (memberships.length === 0) {
    return { kind: "no-access" };
  }
  if (memberships.length === 1) {
    return { kind: "auto-select", tenantId: memberships[0].tenant_id };
  }
  return { kind: "choose" };
}
