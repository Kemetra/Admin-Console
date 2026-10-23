/**
 * RT-782 (RT-777 S3): pure rules for opening a support session, no React and
 * no network. Everything here is taken from the pinned
 * `platform-support-sessions.openapi.yaml`:
 *
 *  - `OpenSupportSessionRequest` is `additionalProperties: false` with
 *    `tenant_id`, `purpose` and the optional `ticket_ref`. The body is built key
 *    by key from those three, so no other draft field can reach it. There is no
 *    free-text reason (DEC-1; RT-414 decision 4).
 *  - `SupportPurpose` is a closed enum; `TicketRef` is its pattern, 1–64 chars.
 *  - Outcomes: 201, 400, 401, 403 (`forbidden`, `origin_rejected`), 404
 *    `TenantNotFound` (non-disclosing: unknown, deleted and forbidden look the
 *    same), 409 `already_member`, 429, 500. A suspended tenant is not refused:
 *    it opens a read-only session like any other 201.
 *
 * Client validation is a fail-fast guard only; the server stays authoritative.
 */
import type { components } from "@/generated/schema";
import type { MessageKey } from "@/i18n";

export type SupportPurpose = components["schemas"]["SupportPurpose"];
export type OpenSupportSessionRequest = components["schemas"]["OpenSupportSessionRequest"];

export const SUPPORT_PURPOSES = [
  "customer_support",
  "incident",
  "onboarding",
] as const satisfies readonly SupportPurpose[];

/** `TicketRef.pattern` (maxLength 64 is implied by `{0,63}` after the first character). */
export const TICKET_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:#/-]{0,63}$/;

export interface StartDraft {
  purpose: string;
  ticketRef: string;
}

export interface StartDraftErrors {
  purpose?: MessageKey;
  ticketRef?: MessageKey;
}

export type BuiltRequest =
  | { ok: true; body: OpenSupportSessionRequest }
  | { ok: false; errors: StartDraftErrors };

function isPurpose(value: string): value is SupportPurpose {
  return (SUPPORT_PURPOSES as readonly string[]).includes(value);
}

/** The request body, or the field errors that keep it from being sent. */
export function buildOpenRequest(tenantId: string, draft: Readonly<StartDraft>): BuiltRequest {
  const ticket = draft.ticketRef.trim();
  const errors: StartDraftErrors = {};
  if (!isPurpose(draft.purpose)) errors.purpose = "platform.start.purpose.required";
  if (ticket !== "" && !TICKET_REF_PATTERN.test(ticket)) {
    errors.ticketRef = "platform.start.ticket.invalid";
  }
  if (errors.purpose || errors.ticketRef || !isPurpose(draft.purpose)) {
    return { ok: false, errors };
  }
  const body: OpenSupportSessionRequest = { tenant_id: tenantId, purpose: draft.purpose };
  if (ticket !== "") body.ticket_ref = ticket;
  return { ok: true, body };
}

export type OpenOutcome =
  /** 201: the session is open and the tenant is active. */
  | { kind: "opened" }
  /** 404 `TenantNotFound`: one state for unknown, deleted and forbidden. */
  | { kind: "not-found"; requestId?: string }
  /** 409 `already_member`: use the normal tenant switch. */
  | { kind: "already-member" }
  /** 429: the shared gate owns it; never retried. */
  | { kind: "rate-limited" }
  /** 401: the context read decides (refresh, then sign-in). */
  | { kind: "unauthenticated" }
  /** 400, 403, 5xx and anything unexpected. */
  | { kind: "failed"; messageKey: MessageKey; requestId?: string };

interface OpenResult {
  status: number;
  error?: { error?: { code?: string; request_id?: string } };
}

function failureKey(status: number, code: string | undefined): MessageKey {
  if (status !== 403) return "platform.start.error.failed";
  return code === "origin_rejected"
    ? "platform.session.error.originRejected"
    : "platform.start.error.forbidden";
}

export function classifyOpen(result: OpenResult): OpenOutcome {
  const code = result.error?.error?.code;
  const requestId = result.error?.error?.request_id;
  if (result.status === 201) return { kind: "opened" };
  if (result.status === 404) return { kind: "not-found", requestId };
  if (result.status === 409 && code === "already_member") return { kind: "already-member" };
  if (result.status === 429) return { kind: "rate-limited" };
  if (result.status === 401) return { kind: "unauthenticated" };
  return { kind: "failed", messageKey: failureKey(result.status, code), requestId };
}
