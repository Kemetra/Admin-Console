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
    "Ordered by the server: custody exceptions first, then active devices soonest to expire, then revoked, then retired.",
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
  "devices.filter.trustAny": "All states",
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
};
