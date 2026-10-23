import type { platform as ar } from "../ar/platform";
import type { MessagesOf } from "../types";

export const platform: MessagesOf<typeof ar> = {
  "platform.session.region": "Support session",
  "platform.session.badge": "Support access",
  "platform.session.tenant": "Working in {name}",
  "platform.session.tenantExpired": "The session was in {name}",
  "platform.session.purpose": "Purpose: {purpose}",
  "platform.session.purpose.customer_support": "Customer support",
  "platform.session.purpose.incident": "Incident",
  "platform.session.purpose.onboarding": "Onboarding",
  "platform.session.ticket": "Ticket",
  "platform.session.readOnly": "Read only",
  "platform.session.remaining": "{duration} left · until {time}",
  "platform.session.remainingUnderMinute": "Less than a minute left · until {time}",
  "platform.session.expiredAt": "Expired at {time}",
  "platform.session.renew": "Renew session",
  "platform.session.end": "End session",

  "platform.session.live.active": "Support session active.",
  "platform.session.live.expiring": "Support session ends soon.",
  "platform.session.live.cap_reached": "Support session reached its renewal limit.",
  "platform.session.live.expired": "Support session expired.",
  "platform.session.live.renewed": "Support session renewed until {time}.",

  "platform.session.notice.expiring.title": "The support session ends in {duration}",
  "platform.session.notice.expiring.body":
    "It won't extend by itself. Renew it to keep working, or end it when you're done. Renewal limit: {cap}.",
  "platform.session.notice.expiringSoon.title": "The support session ends in under a minute",
  "platform.session.notice.cap.title": "The session reached its renewal limit",
  "platform.session.notice.cap.body":
    "It can't be renewed any further. To keep working, open a new support session and state the purpose.",
  "platform.session.notice.expired.title": "The support session expired",
  "platform.session.notice.expired.body":
    "The session ran out without a renewal, so the organization's data is no longer shown. To keep working, open a new session from {directory}; it replaces this one. Or end the session if you're done.",
  "platform.session.notice.expired.directory": "the Organizations page",
  "platform.session.notice.expired.bodyHere":
    "The session ran out without a renewal, so the organization's data is no longer shown. To keep working, open a new session from the organizations list on this page; it replaces this one. Or end the session if you're done.",

  "platform.session.error.forbidden": "Your account can't change this session.",
  "platform.session.error.originRejected":
    "The request was rejected because of where it came from. Reload the page and try again.",
  "platform.session.error.failed": "Couldn't complete that. Try again.",

  "platform.session.expiredBody.title": "The support session expired",
  "platform.session.expiredBody.body":
    "Nothing changed in the organization, and its data is no longer shown. Open a new session from the Organizations page to keep working.",
  "platform.session.expiredBody.action": "Go to organizations",

  "platform.session.readOnlyBody.title": "Read-only support session",
  "platform.session.readOnlyBody.body":
    "The session is active, but organization screens are not available inside a support session yet, so no organization data is shown and there is nothing to change here.",
  "platform.session.readOnlyBody.action": "Go to organizations",

  "platform.tenants.title": "Organizations",
  "platform.tenants.sub":
    "Every organization on the platform. Open a support session for one organization to look at it, read-only.",
  "platform.tenants.suspendedNote": "A suspended organization opens in a read-only session.",
  "platform.tenants.search.label": "Search by organization name or slug",
  "platform.tenants.caption": "Organizations list",
  "platform.tenants.col.tenant": "Organization",
  "platform.tenants.col.action": "Action",
  "platform.tenants.member": "You're a member",
  "platform.tenants.action.start": "Start support session",
  "platform.tenants.action.startFor": "Start support session: {name}",
  "platform.tenants.action.switch": "Open organization",
  "platform.tenants.action.switchFor": "Open organization: {name}",
  "platform.tenants.count": "Showing {shown} of {total}",
  "platform.tenants.noMatch": "No organization matches “{query}”.",
  "platform.tenants.error.failed": "Couldn't load the organizations.",
  "platform.tenants.error.rateLimited":
    "Couldn't load the organizations because of too many requests. Try again when the countdown ends.",
  "platform.tenants.retry": "Try again",
  "platform.tenants.error.switch":
    "Couldn't open the organization because the request didn't get through. Try again.",
  "platform.tenants.error.switchRefused":
    "The organization wasn't opened: the server refused the switch, and nothing changed.",
  "platform.tenants.error.switchUnconfirmed":
    "Couldn't confirm the organization opened, because reading the state after the switch didn't finish. Reload the page to check.",

  "platform.start.title": "Support session: {name}",
  "platform.start.required": "(required)",
  "platform.start.optional": "(optional)",
  "platform.start.purpose.label": "Purpose",
  "platform.start.purpose.placeholder": "Choose a purpose",
  "platform.start.purpose.required": "Choose the session's purpose.",
  "platform.start.ticket.label": "Ticket reference",
  "platform.start.ticket.hint":
    "Up to 64 characters: English letters, digits and . _ : # / - only, no spaces. The organization's owner sees it in the audit log, so don't put customer data in it.",
  "platform.start.ticket.invalid":
    "That ticket reference isn't valid: start with a letter or digit, and use English letters, digits and . _ : # / - only, up to 64 characters.",
  "platform.start.scope.label": "Scope",
  "platform.start.scope.body":
    "Read only: nothing in the organization is changed from a support session.",
  "platform.start.duration.label": "Duration",
  "platform.start.duration.body":
    "60 minutes, and it doesn't extend by itself. Each renewal extends it by up to 60 minutes, never past 8 hours from the start.",
  "platform.start.suspended.label": "Suspended organization",
  "platform.start.suspended.body": "If the organization is suspended, the session is read-only.",
  "platform.start.replaces": "You have a current support session. Starting this one ends it.",
  "platform.start.submit": "Start support session",
  "platform.start.error.forbidden":
    "Your account can't open a support session. No session was started.",
  "platform.start.error.failed":
    "Couldn't start the session, and no session was started. Try again.",
  "platform.start.error.rateLimited":
    "Too many requests, and no session was started. Wait for the countdown on the button, then try again.",
  "platform.start.notFound.title": "Organization not available",
  "platform.start.notFound.body":
    "This organization can't be opened. No session was started and nothing changed.",
  "platform.start.notFound.back": "Back to organizations",
  "platform.start.member.title": "You're a member of this organization",
  "platform.start.member.body": "You don't need a support session for it, and none was started.",
  "platform.start.member.switch": "Use the normal organization switch",
};
