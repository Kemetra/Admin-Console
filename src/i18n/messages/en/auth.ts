import type { auth as ar } from "../ar/auth";
import type { MessagesOf } from "../types";

export const auth: MessagesOf<typeof ar> = {
  "auth.signIn.title": "Sign in",
  "auth.signIn.subtitle": "Operator access to the command console.",
  "auth.signIn.email.label": "Email",
  "auth.signIn.password.label": "Password",
  "auth.signIn.submit": "Sign in",
  "auth.signIn.submitting": "Signing in",
  "auth.signIn.retryIn": { one: "Try again in {count}s", other: "Try again in {count}s" },
  "auth.signIn.errors.failed": "Sign-in failed. Check your email and password, then try again.",
  "auth.signIn.errors.rateLimited": {
    one: "Too many attempts. You can try again in {count}s.",
    other: "Too many attempts. You can try again in {count}s.",
  },
  "auth.signIn.footer": "Protected platform · all activity is audited",

  "auth.acceptInvitation.title": "Accept your invitation",
  "auth.acceptInvitation.titleInvalid": "Invitation",
  "auth.acceptInvitation.displayName.label": "Display name",
  "auth.acceptInvitation.password.label": "Password",
  "auth.acceptInvitation.password.placeholder": "Required for a new account",
  "auth.acceptInvitation.submit": "Accept invitation",
  "auth.acceptInvitation.submitting": "Accepting",
  "auth.acceptInvitation.errors.invalidLink": "This invitation link is invalid or has expired.",
  "auth.acceptInvitation.goToSignIn": "Go to sign in",
  "auth.acceptInvitation.haveAccess": "Already have access? {signIn}",
  "auth.acceptInvitation.signInLink": "Sign in",

  "auth.noAccess.title": "No assigned access",
  "auth.noAccess.body":
    "You're signed in, but your account has no tenant or store access yet. Contact your administrator to be granted a membership.",
  "auth.noAccess.signOut": "Sign out",
};
