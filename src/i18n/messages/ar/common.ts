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
