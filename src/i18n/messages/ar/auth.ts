import type { Messages } from "../types";

/**
 * Arabic copy for the auth surfaces: sign-in (SF-1), accept invitation
 * (SF5-4) and the no-access terminal state (S7). The product word mark
 * «Retail Tower OS» is a proper name and stays Latin in the markup, so it has
 * no key here.
 */
export const auth = {
  "auth.signIn.title": "تسجيل الدخول",
  "auth.signIn.subtitle": "دخول المستخدمين إلى لوحة التحكم.",
  "auth.signIn.email.label": "البريد الإلكتروني",
  "auth.signIn.password.label": "كلمة المرور",
  "auth.signIn.submit": "تسجيل الدخول",
  "auth.signIn.submitting": "جارٍ تسجيل الدخول",
  "auth.signIn.retryIn": {
    zero: "حاول مرة أخرى بعد {count} ثانية",
    one: "حاول مرة أخرى بعد ثانية واحدة",
    two: "حاول مرة أخرى بعد ثانيتين",
    few: "حاول مرة أخرى بعد {count} ثوانٍ",
    many: "حاول مرة أخرى بعد {count} ثانية",
    other: "حاول مرة أخرى بعد {count} ثانية",
  },
  // 401 and 5xx share one message: it must never reveal whether the account
  // exists (FR-003-007).
  "auth.signIn.errors.failed":
    "تعذّر تسجيل الدخول. تحقّق من البريد الإلكتروني وكلمة المرور، ثم حاول مرة أخرى.",
  "auth.signIn.errors.rateLimited": {
    zero: "محاولات كثيرة جدًا. يمكنك المحاولة مرة أخرى بعد {count} ثانية.",
    one: "محاولات كثيرة جدًا. يمكنك المحاولة مرة أخرى بعد ثانية واحدة.",
    two: "محاولات كثيرة جدًا. يمكنك المحاولة مرة أخرى بعد ثانيتين.",
    few: "محاولات كثيرة جدًا. يمكنك المحاولة مرة أخرى بعد {count} ثوانٍ.",
    many: "محاولات كثيرة جدًا. يمكنك المحاولة مرة أخرى بعد {count} ثانية.",
    other: "محاولات كثيرة جدًا. يمكنك المحاولة مرة أخرى بعد {count} ثانية.",
  },
  "auth.signIn.footer": "منصة محمية · يخضع كل نشاط للتدقيق",

  "auth.acceptInvitation.title": "قبول دعوتك",
  "auth.acceptInvitation.titleInvalid": "الدعوة",
  "auth.acceptInvitation.displayName.label": "الاسم المعروض",
  "auth.acceptInvitation.password.label": "كلمة المرور",
  "auth.acceptInvitation.password.placeholder": "مطلوبة عند إنشاء حساب جديد",
  "auth.acceptInvitation.submit": "قبول الدعوة",
  "auth.acceptInvitation.submitting": "جارٍ قبول الدعوة",
  "auth.acceptInvitation.errors.invalidLink": "رابط الدعوة هذا غير صالح أو انتهت صلاحيته.",
  "auth.acceptInvitation.goToSignIn": "الانتقال إلى تسجيل الدخول",
  // {signIn} is the sign-in link, labelled by auth.acceptInvitation.signInLink.
  "auth.acceptInvitation.haveAccess": "لديك صلاحية وصول بالفعل؟ {signIn}",
  "auth.acceptInvitation.signInLink": "تسجيل الدخول",

  "auth.noAccess.title": "لا توجد صلاحية وصول مُسندة إليك",
  "auth.noAccess.body":
    "لقد سجّلت الدخول، لكن حسابك لا يملك بعدُ صلاحية وصول إلى أي مؤسسة أو متجر. تواصل مع المسؤول لديك لمنحك عضوية.",
  "auth.noAccess.signOut": "تسجيل الخروج",
} satisfies Messages;
