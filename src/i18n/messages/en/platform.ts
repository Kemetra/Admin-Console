import type { platform as ar } from "../ar/platform";
import type { MessagesOf } from "../types";

export const platform: MessagesOf<typeof ar> = {
  "platform.session.region": "Support session",
  "platform.session.badge": "Support access",
  "platform.session.tenant": "Working in {name}",
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
    "The session ran out without a renewal, so the organization's data is no longer shown. End the session, then open a new one from the organizations directory.",

  "platform.session.error.forbidden": "Your account can't change this session.",
  "platform.session.error.originRejected":
    "The request was rejected because of where it came from. Reload the page and try again.",
  "platform.session.error.failed": "Couldn't complete that. Try again.",

  "platform.session.expiredBody.title": "The support session expired",
  "platform.session.expiredBody.body":
    "Nothing changed in the organization, and its data is no longer shown. Open a new session from the organizations directory to keep working.",
  "platform.session.expiredBody.action": "Go to organizations",

  "platform.session.readOnlyBody.title": "Read-only support session",
  "platform.session.readOnlyBody.body":
    "The session is active, but organization screens are not available inside a support session yet, so no organization data is shown and there is nothing to change here.",
  "platform.session.readOnlyBody.action": "Go to organizations",
};
