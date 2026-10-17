import type { devices as ar } from "../ar/devices";
import type { MessagesOf } from "../types";

export const devices: MessagesOf<typeof ar> = {
  // --- Navigation ------------------------------------------------------------
  "devices.nav.section": "Point of sale",
  "devices.nav.label": "Devices",

  // --- List ------------------------------------------------------------------
  "devices.list.title": "Devices",
  "devices.list.sub": "Point-of-sale devices paired in {tenant}.",
  "devices.list.orderNote":
    "Ordered by the server: custody exceptions first, then active devices soonest to expire, then revoked. Retired devices are hidden by default; choose the Retired state to see them.",
  "devices.list.staleNote":
    "Devices can't be ordered by last seen yet: the server doesn't record it so far.",
  "devices.list.scopePrompt": "Select a tenant to view devices.",
  "devices.list.caption": "Point-of-sale devices, exceptions first",
  "devices.list.loadingNoun": "devices",
  "devices.list.empty": "No devices are paired.",
  "devices.list.emptyHint":
    "A device appears here once it is paired to a store with a pairing code.",
  "devices.list.emptyFiltered": "No devices match these filters.",
  "devices.list.emptyFilteredHint": "Change or clear the filters to see the other devices.",
  "devices.list.unavailable": "Devices are not available to you.",
  "devices.list.storeUnavailable": "This store's devices are not available to you.",
  "devices.list.storeUnavailableHint": "Choose another store or clear the filter.",
  "devices.list.filterRejected":
    "The server rejected these filters. Check the values and try again.",
  "devices.list.loadFailed": "Devices could not be loaded.",
  "devices.list.sessionExpired": "Your session has expired. Sign in again.",
  "devices.list.inlineError":
    "The rest of the rows could not be loaded. The rows shown are from the last successful load.",
  "devices.list.clearFilters": "Clear filters",
  "devices.list.retry": "Retry",
  "devices.list.loaded": "Loaded: {count}",
  "devices.list.loadMore": "Load more",
  "devices.list.col.device": "Device",
  "devices.list.col.store": "Store",
  "devices.list.col.trust": "Trust state",
  "devices.list.col.attention": "Needs attention",
  "devices.list.col.expires": "Credential expires",
  "devices.list.col.lastSeen": "Last seen",
  "devices.list.unknownStore": "Unknown store",
  "devices.list.unlabelled": "No label",
  "devices.list.noAttention": "No recorded exception",

  // --- Attention ---------------------------------------------------------------
  "devices.attention.custody": "Custody exception: open shift",
  "devices.attention.pastExpiry": "Expiry passed (not enforced yet)",

  // --- Filters -----------------------------------------------------------------
  "devices.filter.label": "Filter devices",
  "devices.filter.store": "Store",
  "devices.filter.allStores": "All stores",
  "devices.filter.unlistedStore": "A store not in your list",
  "devices.filter.trust": "Trust state",
  "devices.filter.trustAny": "Active and revoked (default)",
  "devices.filter.apply": "Apply",
  "devices.filter.clear": "Clear",

  // --- Trust state -------------------------------------------------------------
  "devices.trust.active": "Active",
  "devices.trust.revoked": "Revoked",
  "devices.trust.retired": "Retired",
  "devices.trust.unknown": "Unknown state",

  // --- Revoke reason -----------------------------------------------------------
  "devices.reason.lost": "Lost",
  "devices.reason.stolen": "Stolen",
  "devices.reason.suspected_compromise": "Suspected compromise",
  "devices.reason.hardware_failure": "Hardware failure",
  "devices.reason.replaced": "Replaced by another device",
  "devices.reason.moved": "Moved to another store",
  "devices.reason.retired": "Retired",
  "devices.reason.admin_error": "Admin error",
  "devices.reason.other": "Other reason",
  "devices.reason.notRecorded": "No reason recorded",
  "devices.reason.unknown": "Unknown reason",

  // --- Last seen ---------------------------------------------------------------
  "devices.lastSeen.unknown": "Unknown",
  "devices.lastSeen.source.activity": "Last authenticated request from the device",
  "devices.lastSeen.source.unknown": "Unknown source",
  "devices.lastSeen.notHealth":
    "Last seen does not mean the device is healthy. Device health is not reported yet.",

  // --- Detail ------------------------------------------------------------------
  "devices.detail.back": "Back to devices",
  "devices.detail.loadingNoun": "device",
  "devices.detail.notFound": "This device is not available.",
  "devices.detail.loadFailed": "This device could not be loaded.",
  "devices.detail.retry": "Retry",
  "devices.detail.zoneNote": "Times are in {zone}.",
  "devices.detail.unlabelledTitle": "Unlabelled device",
  "devices.detail.tabs": "Device sections",
  "devices.detail.tab.overview": "Overview",
  "devices.detail.tab.history": "History",

  "devices.custody.title": "Open custody exception",
  "devices.custody.body":
    "This device was revoked while shift {shift} was open on it. The shift stays open on this device until it is closed and synced; it does not move to another device.",

  "devices.field.deviceId": "Device ID",
  "devices.field.label": "Label",
  "devices.field.store": "Store",
  "devices.field.trust": "Trust state",
  "devices.field.pairedAt": "Paired at",
  "devices.field.expiresAt": "Credential expires",
  "devices.field.expiryNote":
    "The expiry is reported but not enforced yet: the device stays active after it.",
  "devices.field.lastSeen": "Last seen",
  "devices.field.lastSeenSource": "Last seen source",

  // --- History -------------------------------------------------------------------
  "devices.history.events": "Events",
  "devices.history.paired": "Paired",
  "devices.history.revoked": "Revoked",
  "devices.history.retired": "Retired",
  "devices.history.by": "By",
  "devices.history.actorNotRecorded": "Not recorded",
  "devices.history.reason": "Reason",
  "devices.history.note": "Note",
  "devices.history.noRevoke": "This device has not been revoked.",
  "devices.history.chain": "Replacement chain",
  "devices.history.replaces": "Replaces",
  "devices.history.replacedBy": "Replaced by",
  "devices.history.noLink": "None, or the device is in a store outside your access.",

  // --- Lifecycle actions (RT-372) -------------------------------------------------
  "devices.actions.label": "Device lifecycle actions",
  "devices.actions.hint":
    "Each action is separate, and shows what the server says it will do before you confirm.",
  "devices.actions.revoke": "Revoke",
  "devices.actions.retire": "Retire",
  "devices.actions.closed": "This device is retired. There are no further actions on it.",

  "devices.flow.review": "Review impact",
  "devices.flow.back": "Back",
  "devices.flow.done": "Done",
  "devices.flow.checking": "Asking the server what will happen…",
  "devices.flow.error.notFound": "This device is no longer available to you.",
  "devices.flow.error.generic":
    "The server could not complete the action. Check the device's state before you try again.",
  "devices.flow.error.session": "Your session has ended. Sign in again.",
  "devices.flow.error.validation": "The server rejected a value. Check the fields and try again.",
  "devices.flow.error.unmetNote":
    "The server needs a note for this revoke: what happened and where the drawer cash is.",
  "devices.flow.error.unmetAcknowledge":
    "The server needs your confirmation that the shift stays as an unresolved exception.",
  "devices.flow.error.changed":
    "The situation changed since the preview. The server's fresh answer is below.",
  "devices.text.required": "This field is required.",
  "devices.text.tooLong": "Use at most 500 characters.",
  "devices.text.invalid": "The text contains a character that isn't allowed.",

  // --- Impact (the server's answer, rendered) ---------------------------------------
  "devices.impact.title": "What the server says will happen",
  "devices.impact.loadFailed": "The impact could not be loaded from the server.",
  "devices.impact.retry": "Retry",
  "devices.impact.snapshot":
    "As of {time}. This is a snapshot, not a reservation: the server decides again when you confirm.",
  "devices.impact.verdict.allowed": "Allowed by the server.",
  "devices.impact.verdict.allowedCustody":
    "Allowed, with a custody exception. The open shift stays on this device as an unresolved exception: it is not closed, counted or moved.",
  "devices.impact.verdict.forbidden":
    "Not available to your role. A recovery revoke (hardware failure with an open shift) can only be made by an owner or a tenant admin. Ask one of them to do it.",
  "devices.impact.verdict.noChange": "Nothing will change: this has already happened.",
  "devices.impact.blocked.cashSession":
    "Blocked: this device has an open shift. Close the shift on the till and let it sync, then try again. If the till is lost, make a security revoke first. There is no override.",
  "devices.impact.blocked.cashSessionRetire":
    "Blocked: this device has an open shift. Close the shift on the till and let it sync, then try again. A security revoke protects a lost till, but retire stays blocked until the shift is closed or the custody exception is reconciled. There is no override.",
  "devices.impact.blocked.custodyException":
    "Blocked: this revoked device still has an open shift (an unresolved custody exception). It can't be retired until that is resolved. There is no override.",
  "devices.impact.blocked.retired": "Blocked: this device is retired.",
  "devices.impact.blocked.unknown":
    "Blocked: the server refused this action for a reason this console doesn't know. No action is offered.",
  "devices.impact.field.state": "Trust state now",
  "devices.impact.field.openShift": "Open shift",
  "devices.impact.openShift.none": "None",
  "devices.impact.openShift.line": "Opened {time} ({source})",
  "devices.impact.source.cash_up": "cash-up",
  "devices.impact.source.legacy": "legacy",
  "devices.impact.field.cashFacts": "Cash facts",
  "devices.impact.cashFacts.value": {
    one: "The server has received {count} fact, the latest {time}",
    other: "The server has received {count} facts, the latest {time}",
  },
  "devices.impact.cashFacts.note":
    "Only what the server has received. Anything the till hasn't synced yet isn't counted.",
  "devices.impact.cashFacts.unknown":
    "Unknown: a legacy shift has no received cash-up facts (not zero).",
  "devices.impact.field.custody": "Custody exception now",
  "devices.impact.custody.none": "None",
  "devices.impact.custody.shift": "Shift {shift} is open on this device",
  "devices.impact.field.sessions": "Operator sessions that would end",
  "devices.impact.field.codes": "Pending pairing codes that would be cancelled",
  "devices.impact.cascade.none": "Not applicable: this device is already revoked.",

  // --- Revoke ---------------------------------------------------------------------
  "devices.revoke.title": "Revoke device",
  "devices.revoke.intro": "Revoking ends this device's credential for good. There is no un-revoke.",
  "devices.revoke.group.security": "Security events",
  "devices.revoke.group.securityHelp":
    "For real security events only: the device is lost, stolen or suspected compromised. They are not a workaround when another reason is blocked.",
  "devices.revoke.group.other": "Other reasons",
  "devices.revoke.reasonRequired": "Choose a reason.",
  "devices.revoke.note": "Note",
  "devices.revoke.noteHelp": "Optional. No personal data or PIN.",
  "devices.revoke.noteHelpRequired": "Required. No personal data or PIN.",
  "devices.revoke.noteRecovery": "What happened, and where is the drawer cash?",
  "devices.revoke.acknowledge":
    "I understand the open shift stays as an unresolved custody exception on this device.",
  "devices.revoke.acknowledgeRequired": "Confirm that you understand before revoking.",
  "devices.revoke.confirm": "Revoke device",
  "devices.revoke.done": "The device is revoked.",
  "devices.revoke.alreadyRevoked": "This device was already revoked. Nothing changed.",

  // --- Retire ---------------------------------------------------------------------
  "devices.retire.title": "Retire device",
  "devices.retire.intro":
    "Retiring closes the device out for good: it is never paired, replaced or moved again. Its history stays. There is no un-retire.",
  "devices.retire.reason": "Why is this device retired?",
  "devices.retire.reasonHelp":
    "For example: End of life, returned to vendor. No personal data or PIN.",
  "devices.retire.confirm": "Retire device",
  "devices.retire.done": "The device is retired.",
  "devices.retire.alreadyRetired": "This device was already retired. Nothing changed.",
  "devices.retire.checkingCodes": "Checking for pending pairing codes…",
  "devices.retire.codesLoadFailed":
    "The pending pairing codes could not be checked. Try again before retiring.",
  "devices.retire.pendingCodes": {
    one: "{count} live pairing code is set to replace or move this device. Retiring cancels it, and this device can then never be replaced or moved.",
    other:
      "{count} live pairing codes are set to replace or move this device. Retiring cancels them, and this device can then never be replaced or moved.",
  },
  "devices.retire.pendingCodesHelp": "Pair the new terminal first, or confirm below.",
  "devices.retire.pendingCodesConfirm": "Retire anyway and cancel the replacement codes",
  "devices.retire.pendingCodesRequired": "Confirm cancelling the replacement codes to continue.",

  // --- Replace, move and pairing codes (RT-372 part B) ---------------------------
  "devices.actions.replace": "Replace",
  "devices.actions.move": "Move to another store",
  "devices.list.pairingCodes": "Pairing codes",

  "devices.issue.title.replace": "Replace device",
  "devices.issue.title.move": "Move device to another store",
  "devices.issue.title.pair": "Issue pairing code",
  "devices.issue.intro.replace":
    "Replacing pairs a new terminal in the same store with a pairing code. When the new terminal pairs, this device is revoked; its sales, shifts and cash facts stay with it.",
  "devices.issue.intro.move":
    "Moving pairs a new terminal in another store with a pairing code. A device never changes store: the new terminal is a new device, and this one is revoked when it pairs.",
  "devices.issue.intro.pair": "A pairing code creates a new device in the store you choose.",
  "devices.issue.field.store": "Store",
  "devices.issue.field.targetStore": "Target store",
  "devices.issue.field.storeChoose": "Choose a store",
  "devices.issue.field.terminalLabel": "New terminal's label (optional)",
  "devices.issue.field.terminalLabelHelp":
    "Printed on receipts and in the sale number, so keep it unique within the store. If empty, the server derives one.",
  "devices.issue.field.ttl": "Valid for, in minutes (optional)",
  "devices.issue.field.ttlHelp": "Default 60, at most 1440.",
  "devices.issue.bindingTitle": "Receipt and printer details",
  "devices.issue.bindingHelp":
    "The terminal pins these at pairing and prints them on receipts. The server doesn't hold them, so you provide them here.",
  "devices.issue.field.branchName": "Store name on receipts",
  "devices.issue.field.branchAddress": "Store address on receipts",
  "devices.issue.field.taxRegistrationId": "Tax registration id",
  "devices.issue.field.printerVendorId": "Printer vendor id ({bus})",
  "devices.issue.field.printerProductId": "Printer product id ({bus})",
  "devices.issue.field.usbHelp": "As 0x followed by four hex digits, for example 0x04B8.",
  "devices.issue.field.printerComPort": "Printer {port} port (optional)",
  "devices.issue.problem.usbId": "Use 0x followed by four hex digits.",
  "devices.issue.problem.tooLong": "Use at most {max} characters.",
  "devices.issue.problem.ttl": "Enter a whole number from 1 to 1440.",
  "devices.issue.confirm": "Issue pairing code",
  "devices.issue.error.notFound": "The device or store is not available to you.",
  "devices.issue.error.storeNotFound": "The store is not available to you.",
  "devices.issue.error.alreadyPending":
    "A live pairing code already replaces this device. Cancel it from the pending codes first, or wait for it to expire.",
  "devices.issue.error.alreadyReplaced":
    "This device has already been replaced. A device is replaced only once.",
  "devices.issue.error.keyConflict":
    "The server did not confirm this attempt, and it can't be repeated with the same key. Open the pending codes, cancel any stray code, then issue a new one.",
  "devices.issue.error.inProgress":
    "The server is still handling an earlier request. Don't retry now: open the pending codes shortly, cancel any stray code, then issue a new one.",
  "devices.issue.error.unknownOutcome":
    "No answer came from the server, so we don't know whether a code was issued. Open the pending codes, cancel any stray code, then issue a new one.",
  "devices.issue.viewCodes": "View pending pairing codes",
  "devices.issue.issued.title": "Pairing code issued",
  "devices.issue.issued.code": "Pairing code",
  "devices.issue.issued.once":
    "Shown only once. The server does not keep it. Type it into the new terminal now. If you lose it, cancel it from the pending codes and issue a new one.",
  "devices.issue.issued.valid": {
    one: "Valid for {count} minute, until {time}.",
    other: "Valid for {count} minutes, until {time}.",
  },
  "devices.issue.issued.replaceHelp":
    "The new terminal will be paired in {store}. When it pairs, the current device is revoked.",
  "devices.issue.issued.blockedHelp":
    "If a shift opens on the current device before the new terminal is paired, pairing is refused ({code}) and the code stays pending. Close the shift on the current device, let it sync, then enter the code again before it expires.",

  "devices.revoke.nextStep": "Next step: pair a replacement terminal.",
  "devices.revoke.offerReplace": "Replace this device",

  // --- Pending pairing codes ---------------------------------------------------------
  "devices.codes.title": "Pairing codes",
  "devices.codes.sub":
    "Live pending pairing codes in {tenant}. A code is shown only when it is issued; it is never listed here.",
  "devices.codes.back": "Back to devices",
  "devices.codes.issue": "Issue pairing code",
  "devices.codes.caption": "Live pending pairing codes, newest first",
  "devices.codes.loadingNoun": "pairing codes",
  "devices.codes.empty": "No pairing codes are pending.",
  "devices.codes.emptyHint": "Every issued code that is not yet used or expired appears here.",
  "devices.codes.unavailable": "Pairing codes are not available to you.",
  "devices.codes.loadFailed": "Pairing codes could not be loaded.",
  "devices.codes.retry": "Retry",
  "devices.codes.loaded": "Loaded: {count}",
  "devices.codes.loadMore": "Load more",
  "devices.codes.col.terminal": "New terminal",
  "devices.codes.col.kind": "Kind",
  "devices.codes.col.store": "Store",
  "devices.codes.col.replaces": "Replaces",
  "devices.codes.col.expires": "Expires",
  "devices.codes.col.actions": "Action",
  "devices.codes.kind.pair": "New pairing",
  "devices.codes.kind.replace": "Replace",
  "devices.codes.kind.move": "Move",
  "devices.codes.kind.unknown": "Unknown kind",
  "devices.codes.replaces.none": "None",
  "devices.codes.replaces.outside": "A device outside your access",
  "devices.codes.cancel": "Cancel code",
  "devices.codes.cancelConfirm":
    "Cancel the pairing code for {label}? It can't be used afterwards.",
  "devices.codes.cancelKeep": "Keep code",
  "devices.codes.cancelled": "The code is cancelled.",
  "devices.codes.alreadyCancelled": "The code was already cancelled. Nothing changed.",
  "devices.codes.error.used":
    "This code was already used, so it can't be cancelled. Revoke the device it paired instead.",
  "devices.codes.error.notFound": "This code is not available to you.",
  "devices.codes.error.generic": "The code could not be cancelled. Try again.",
};
