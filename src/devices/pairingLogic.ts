/**
 * RT-372 pure helpers for the pairing-code forms. No React, no fetch.
 *
 * The issue form collects the terminal binding the contract requires (decision
 * C1): the branch name and address, the tax registration id and the printer's
 * USB ids, which the POS pins at pairing and prints on receipts. Backend-Core
 * holds no other source for them. These are form checks that mirror the
 * contract's patterns; the server re-validates everything.
 */
import type { MessageKey } from "@/i18n";
import type { PairingCodeIssueRequest } from "@/lib/device-queries";

export interface IssueDraft {
  storeId: string;
  terminalLabel: string;
  ttlMinutes: string;
  branchName: string;
  branchAddress: string;
  taxRegistrationId: string;
  printerVendorId: string;
  printerProductId: string;
  printerComPort: string;
}

export const EMPTY_ISSUE_DRAFT: IssueDraft = {
  storeId: "",
  terminalLabel: "",
  ttlMinutes: "",
  branchName: "",
  branchAddress: "",
  taxRegistrationId: "",
  printerVendorId: "",
  printerProductId: "",
  printerComPort: "",
};

export interface FieldProblem {
  key: MessageKey;
  params?: { max: number };
}

export type IssueProblems = Partial<Record<keyof IssueDraft, FieldProblem>>;

const USB_ID = /^0x[0-9A-Fa-f]{4}$/;
export const TTL_MIN = 1;
export const TTL_MAX = 1440;

const LIMITS = {
  terminalLabel: 64,
  branchName: 256,
  branchAddress: 512,
  taxRegistrationId: 64,
  printerComPort: 32,
} as const;

function textProblem(value: string, max: number, required: boolean): FieldProblem | undefined {
  if (value.includes("\u0000")) return { key: "devices.text.invalid" };
  if (value.trim() === "") return required ? { key: "devices.text.required" } : undefined;
  return value.length > max ? { key: "devices.issue.problem.tooLong", params: { max } } : undefined;
}

export function validateIssueDraft(draft: IssueDraft): IssueProblems {
  const problems: IssueProblems = {};
  const set = (field: keyof IssueDraft, problem: FieldProblem | undefined) => {
    if (problem) problems[field] = problem;
  };
  set("storeId", draft.storeId === "" ? { key: "devices.text.required" } : undefined);
  set("branchName", textProblem(draft.branchName, LIMITS.branchName, true));
  set("branchAddress", textProblem(draft.branchAddress, LIMITS.branchAddress, true));
  set("taxRegistrationId", textProblem(draft.taxRegistrationId, LIMITS.taxRegistrationId, true));
  for (const field of ["printerVendorId", "printerProductId"] as const) {
    const value = draft[field].trim();
    set(
      field,
      value === ""
        ? { key: "devices.text.required" }
        : USB_ID.test(value)
          ? undefined
          : { key: "devices.issue.problem.usbId" },
    );
  }
  set("terminalLabel", textProblem(draft.terminalLabel, LIMITS.terminalLabel, false));
  set("printerComPort", textProblem(draft.printerComPort, LIMITS.printerComPort, false));
  const ttl = draft.ttlMinutes.trim();
  if (ttl !== "") {
    const minutes = Number(ttl);
    const ok = /^\d+$/.test(ttl) && minutes >= TTL_MIN && minutes <= TTL_MAX;
    set("ttlMinutes", ok ? undefined : { key: "devices.issue.problem.ttl" });
  }
  return problems;
}

/**
 * The issue request. `replacesDeviceId` makes it a replace (the device's own
 * store) or a move (another store): the server derives which from the stores,
 * so no kind is sent.
 */
export function buildIssueBody(
  draft: IssueDraft,
  replacesDeviceId?: string,
): PairingCodeIssueRequest {
  const label = draft.terminalLabel.trim();
  const ttl = draft.ttlMinutes.trim();
  const com = draft.printerComPort.trim();
  return {
    storeId: draft.storeId,
    branchName: draft.branchName.trim(),
    branchAddress: draft.branchAddress.trim(),
    taxRegistrationId: draft.taxRegistrationId.trim(),
    printerVendorId: draft.printerVendorId.trim(),
    printerProductId: draft.printerProductId.trim(),
    ...(label === "" ? {} : { terminalLabel: label }),
    ...(ttl === "" ? {} : { ttlMinutes: Number(ttl) }),
    ...(com === "" ? {} : { printerComPort: com }),
    ...(replacesDeviceId ? { replacesDeviceId } : {}),
  };
}

/**
 * A client-generated opaque key (UUID v4: 36 printable characters, inside the
 * contract's 16..128). The issue is non-replayable (RT-82 K3): a key is never
 * reused, so every submit asks for a new one.
 */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
