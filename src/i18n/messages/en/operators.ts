import type { operators as ar } from "../ar/operators";
import type { MessagesOf } from "../types";

export const operators: MessagesOf<typeof ar> = {
  "operators.title": "Operators",
  "operators.scopePrompt.message":
    "Select a tenant to manage its operators. Use the tenant selector in the scope bar above to choose where you are working.",

  "operators.list.subtitle": "Members of {tenant}.",
  "operators.list.invite": "Invite member",
  "operators.list.notFound": "Members are not available for this tenant.",
  "operators.list.loadingNoun": "members",
  "operators.list.empty": "No other members in this tenant yet.",
  "operators.list.caption": "Operators",
  "operators.list.col.member": "Member",
  "operators.list.col.role": "Role",
  "operators.list.col.storeAccess": "Store access",
  "operators.list.col.state": "State",

  "operators.state.active": "Active",
  "operators.state.revoked": "Revoked",

  "operators.storeAccess.all": "All stores",
  "operators.storeAccess.specific": "Specific stores",
  "operators.storeAccess.count": { one: "{count} store", other: "{count} stores" },

  "operators.form.email": "Email",
  "operators.form.role": "Role",
  "operators.form.storeAccess": "Store access",
  "operators.form.storeIdsPlaceholder": "Store ids, comma-separated",

  "operators.invite.title": "Invite member",
  "operators.invite.scopeLine": "Inviting to tenant {tenant}.",
  "operators.invite.submit": "Send invitation",
  "operators.invite.retrying": { one: "Retrying in {count}s…", other: "Retrying in {count}s…" },
  "operators.invite.errors.selectTenant": "Select a tenant before inviting members.",
  "operators.invite.errors.validation": "Check the invitation details and try again.",
  "operators.invite.errors.forbidden":
    "You do not have permission to invite members to this tenant.",
  "operators.invite.errors.pendingExists": "An invitation is already pending for this email.",
  "operators.invite.errors.keyConflict":
    "That invitation could not be completed. Please try again.",
  "operators.invite.errors.tooLong": "The invitation is taking too long. Try again.",
  "operators.invite.errors.generic": "Something went wrong sending the invitation. Try again.",

  "operators.edit.title": "Edit member",
  "operators.edit.scopeLine": "Editing {name}.",
  "operators.edit.save": "Save changes",
  "operators.edit.notFound": "This member could not be found.",
  "operators.edit.revoke.title": "Revoke membership",
  "operators.edit.revoke.open": "Revoke membership",
  "operators.edit.revoke.confirm": "Revoke",
  "operators.edit.revoke.resource": "{name}'s membership",
};
