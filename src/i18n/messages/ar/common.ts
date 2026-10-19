import type { Messages } from "../types";

/**
 * Cross-surface Arabic copy: the app name, the locale switch, shared verbs
 * (UX-12 stable verbs: حفظ / إضافة / تأكيد / إلغاء / حذف / إزالة / تحديث),
 * shared error copy, formatter phrases and role labels.
 */
export const common = {
  "app.title": "لوحة تحكم Retail Tower",
  "app.productTag": "لوحة التحكم",

  // The locale switch shows the OTHER language's own name; these two keys are
  // read from the target locale's catalog (see LocaleSwitch).
  "locale.switch.name": "العربية",
  "locale.switch.action": "التبديل إلى العربية",

  "theme.darkMode": "الوضع الداكن",

  // RT-633: the top-level error fallback. Never shows the error itself.
  "app.crash.title": "حدث خطأ غير متوقع",
  "app.crash.body": "أعد تحميل الصفحة للمتابعة. إذا تكرر الخطأ فتواصل مع الدعم.",
  "app.crash.reload": "إعادة تحميل الصفحة",

  "common.cancel": "إلغاء",
  "common.close": "إغلاق",
  "common.save": "حفظ",
  "common.tryAgain": "حاول مرة أخرى",
  "common.loading": "جارٍ التحميل…",

  // Shared error copy. Status-family fallbacks until mappers key on error.code
  // (RT-266 §3.3); never raw backend English, never a key.
  "errors.forbidden": "ليست لديك صلاحية لتنفيذ هذا الإجراء.",
  "errors.notFound": "هذا العنصر غير متاح.",
  "errors.server": "حدث خطأ ما. حاول مرة أخرى.",
  "errors.generic": "تعذّر إكمال الطلب.",

  // RT-621: the shared 429 banner and the countdown on a gated control.
  "rateLimit.title": "طلبات كثيرة جدًا",
  "rateLimit.wait": {
    zero: "يمكنك المحاولة مرة أخرى بعد {count} ثانية.",
    one: "يمكنك المحاولة مرة أخرى بعد ثانية واحدة.",
    two: "يمكنك المحاولة مرة أخرى بعد ثانيتين.",
    few: "يمكنك المحاولة مرة أخرى بعد {count} ثوانٍ.",
    many: "يمكنك المحاولة مرة أخرى بعد {count} ثانية.",
    other: "يمكنك المحاولة مرة أخرى بعد {count} ثانية.",
  },
  "rateLimit.ready": "يمكنك المحاولة مرة أخرى الآن.",
  "rateLimit.dismiss": "إخفاء",
  "rateLimit.gate": {
    zero: "انتظر {count} ث",
    one: "انتظر {count} ث",
    two: "انتظر {count} ث",
    few: "انتظر {count} ث",
    many: "انتظر {count} ث",
    other: "انتظر {count} ث",
  },

  "format.dateTime": "{date}، {time}",
  "format.dateTimeUtc": "{date}، {time} UTC",
  "format.duration.hours": {
    zero: "{count} ساعة",
    one: "ساعة واحدة",
    two: "ساعتان",
    few: "{count} ساعات",
    many: "{count} ساعة",
    other: "{count} ساعة",
  },
  "format.duration.minutes": {
    zero: "{count} دقيقة",
    one: "دقيقة واحدة",
    two: "دقيقتان",
    few: "{count} دقائق",
    many: "{count} دقيقة",
    other: "{count} دقيقة",
  },
  "format.duration.seconds": {
    zero: "{count} ثانية",
    one: "ثانية واحدة",
    two: "ثانيتان",
    few: "{count} ثوانٍ",
    many: "{count} ثانية",
    other: "{count} ثانية",
  },

  // Role labels (see src/i18n/roles.ts). manager / cashier come from the UX-12
  // glossary. owner / tenant_admin / store_manager / platform_admin are
  // PROVISIONAL until the owner approves Arabic terms (RT-266 Q4, RT-399).
  "role.owner": "المالك",
  "role.tenant_admin": "مسؤول المؤسسة",
  "role.store_manager": "مدير المتجر",
  "role.platform_admin": "مسؤول المنصة",
  "role.manager": "المدير",
  "role.cashier": "الكاشير",
  "role.unknown": "دور غير معروف",
} satisfies Messages;
