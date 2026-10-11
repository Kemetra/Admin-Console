import type { Messages } from "../types";

/**
 * Arabic copy for the Audit surface (RF-6: filters, table, pager, inspect
 * drawer). Audit action codes, IDs, metadata and request references are
 * machine data: they render verbatim, LTR-isolated, and never come from here.
 * Evidence timestamps stay exact UTC, so the time label names UTC.
 */
export const audit = {
  "audit.title": "سجل التدقيق",
  "audit.header.scope": "{tenant} · {store}",
  "audit.scopePrompt":
    "اختر مؤسسة للبحث في نشاط التدقيق الخاص بها. استخدم محدِّد المؤسسة في شريط النطاق أعلاه لاختيار المكان الذي تعمل فيه.",

  // Field names shared by the filter bar, the table and the inspect drawer.
  "audit.field.time": "الوقت (UTC)",
  "audit.field.action": "الإجراء",
  "audit.field.actor": "المستخدم",
  "audit.field.target": "العنصر المستهدف",
  "audit.field.store": "المتجر",
  "audit.field.requestId": "مرجع الطلب",

  "audit.filters.actorPlaceholder": "معرّف المستخدم",
  "audit.filters.storePlaceholder": "معرّف المتجر",
  "audit.filters.from": "من تاريخ",
  "audit.filters.to": "إلى تاريخ",
  "audit.filters.apply": "تطبيق",
  "audit.filters.clear": "مسح",

  "audit.prequery": "ابحث في نشاط التدقيق للمؤسسة {tenant}.",

  "audit.errors.forbidden": "ليست لديك صلاحية لعرض سجل التدقيق في هذا النطاق.",
  "audit.errors.searchFailed": "تعذّر البحث في سجل التدقيق. حاول مرة أخرى.",

  "audit.list.loadingNoun": "أحداث التدقيق",
  "audit.list.empty": "لا توجد أحداث تدقيق تطابق عوامل التصفية هذه.",
  "audit.list.clearFilters": "مسح عوامل التصفية",

  // RT-269: a failed "Load more" keeps the rows already shown.
  "audit.continuation.forbidden":
    "تعذّر تحميل المزيد من أحداث التدقيق: ليست لديك صلاحية. تبقى الأحداث المعروضة أعلاه كما هي.",
  "audit.continuation.failed":
    "تعذّر تحميل المزيد من أحداث التدقيق. تبقى الأحداث المعروضة أعلاه كما هي.",
  "audit.continuation.retry": "إعادة المحاولة",

  "audit.table.caption": "أحداث التدقيق",
  "audit.table.requestShort": "المرجع",

  // Noun-first counter: no plural map needed (UX-12).
  "audit.pager.loaded": "المحمّل: {count}",
  "audit.pager.loadMore": "تحميل المزيد",

  "audit.inspect.title": "حدث التدقيق",
  "audit.inspect.copy": "نسخ",
  "audit.inspect.metadata": "البيانات الوصفية",
  "audit.inspect.noMetadata": "لا توجد بيانات وصفية.",
} satisfies Messages;
