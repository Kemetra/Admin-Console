import type { Messages } from "../types";

/** Shell chrome and shared components (topbar, nav, scope, dialogs, banners). */
export const shell = {
  "shell.nav.label": "التنقل الرئيسي",
  "shell.nav.overview": "نظرة عامة",
  "shell.nav.section.management": "الإدارة",
  "shell.nav.tenants": "المؤسسات",
  "shell.nav.stores": "المتاجر",
  "shell.nav.operators": "المستخدمون",
  "shell.nav.audit": "سجل التدقيق",
  "shell.nav.section.inventory": "المخزون",
  "shell.nav.stockDiscrepancies": "فروقات المخزون",
  "shell.nav.section.catalog": "الكتالوج",
  "shell.nav.section.cash": "النقدية",
  "shell.nav.shiftCloses": "إقفالات الورديات",
  "shell.nav.unknownItems": "أصناف غير معروفة",
  "shell.signOut": "تسجيل الخروج",

  "shell.overview.title": "نظرة عامة",
  "shell.overview.scope": "{tenant} · {store}",

  "shell.scope.menuGroup": "المتجر · {tenant}",
  "shell.scope.allStores": "كل المتاجر",
  "shell.scope.loading": "جارٍ تحميل المتاجر…",
  "shell.scope.loadFailed": "تعذّر تحميل المتاجر.",
  "shell.scope.noStores": "لا توجد متاجر يمكنك فتحها في هذه المؤسسة.",
  "shell.scope.announce": "تعمل الآن في {tenant}، {store}.",

  "shell.gate.title": "اختر نطاق العمل",
  "shell.gate.sub": "اختر مؤسسة للمتابعة.",
  "shell.gate.searchPlaceholder": "ابحث في المؤسسات…",
  "shell.gate.searchLabel": "ابحث في المؤسسات",
  "shell.gate.listLabel": "المؤسسات المتاحة",

  "shell.mismatch.label": "النطاق",
  "shell.mismatch.message": "هذا الرابط لمتجر آخر. أنت تعمل في {store}، ولم يتغيّر نطاقك.",
  "shell.mismatch.switch": "الانتقال إلى هذا المتجر",
  "shell.mismatch.stay": "البقاء في {store}",

  "shell.leave.title": "المغادرة دون حفظ؟",
  "shell.leave.desc": "في هذه الصفحة تغييرات غير محفوظة. إذا غادرت فستفقدها.",
  "shell.leave.stay": "البقاء في هذه الصفحة",
  "shell.leave.discard": "تجاهل التغييرات",

  "components.banner.requestRef": "المرجع: {id}",
  "components.list.loading": "جارٍ تحميل {label}…",
  "components.list.loadingDefault": "العناصر",
  "components.confirmDelete.label": "تأكيد: {action}",
  "components.confirmDelete.prompt": "{action} {name}؟ يمكن لمسؤول التراجع عن ذلك لاحقًا.",

  "platform.label": "المنصة",
  "platform.nav.label": "المنصة",
  "platform.nav.tenants": "المؤسسات",
  "platform.tenants.emptyTitle": "لا توجد وجهات متاحة",
  "platform.tenants.emptyBody": "لا توجد مؤسسات لعرضها حاليًا.",
  "platform.noAccess.title": "غير متاح",
  "platform.noAccess.body": "هذه الصفحة غير متاحة لحسابك.",
  "platform.noAccess.home": "العودة إلى الرئيسية",
} satisfies Messages;
