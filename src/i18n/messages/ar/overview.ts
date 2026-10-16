import type { Messages } from "../types";

/**
 * Arabic copy for the Overview landing (RT-559, spec 009). The page links to
 * the screens that own the work; it never acts. Counts are noun-first
 * («الأصناف: 11») and a count read from one page of a longer list says
 * «أو أكثر», never a total. Snapshot words reuse the stock screen's copy
 * (`stock.*`), so «غير معروف» stays the shipped RT-178 wording.
 */
export const overview = {
  "overview.refresh": "تحديث",
  "overview.refreshing": "جارٍ التحديث…",

  // --- Attention ledger (P-1…P-4) --------------------------------------------
  "overview.attention.title": "ما يحتاج إلى متابعتك",
  "overview.attention.nothingForRole": "لا توجد عناصر متابعة متاحة لدورك في هذا النطاق.",
  "overview.count.exact": "{noun}: {count}",
  "overview.count.atLeast": "{noun}: {count} أو أكثر",
  "overview.count.none": "لا يوجد",
  "overview.count.unproven": "في القائمة المزيد للمراجعة",
  "overview.row.loading": "جارٍ التحميل…",
  "overview.row.failed": "تعذّر التحميل.",
  "overview.row.retry": "إعادة المحاولة",

  "overview.stock.label": "فروقات المخزون · {store}",
  "overview.stock.noun": "الأصناف السالبة",
  "overview.stock.asOf": "بتاريخ {asOf}",
  "overview.stock.open": "عرض فروقات المتجر",
  "overview.stock.none": "لا توجد متاجر لعرض فروقاتها.",
  "overview.stock.labelAll": "فروقات المخزون",
  "overview.stock.more": "بعض المتاجر لم تُعرض هنا. افتح فروقات المخزون لعرضها كلها.",
  "overview.stock.openAll": "عرض الفروقات كاملة",

  "overview.shift.label": "فروقات إقفال الورديات بلا معتمِد مسجَّل (آخر 7 أيام)",
  "overview.shift.noun": "الإقفالات",
  "overview.shift.open": "مراجعة الإقفالات",

  "overview.unknown.label": "أصناف غير معروفة بانتظار المراجعة",
  "overview.unknown.noun": "الأصناف",
  "overview.unknown.open": "مراجعة الأصناف",

  "overview.receivables.label": "ذمم مدينة تحتاج إلى مراجعة",
  "overview.receivables.noun": "الذمم",
  "overview.receivables.open": "فتح الذمم المدينة وتصفيتها بالحالة «{state}»",
} satisfies Messages;
