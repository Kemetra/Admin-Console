import type { Messages } from "../types";

/**
 * Arabic copy for the catalog product list (RT-765, CAT-C1a). Read-only.
 *
 * Glossary (UX-12): Retail Item → «الصنف»; Category → «الفئة»; Tracking →
 * «التتبع». «موقوف» stays the suspended-tenant word (D-AUD-08), so a retired
 * item reads «أُخرج من الكتالوج», as a retired device reads «أُخرج من
 * الخدمة». The list never claims a total: the contract has none, so the count
 * is what is loaded.
 */
export const catalog = {
  // --- Navigation ------------------------------------------------------------
  "catalog.nav.label": "الأصناف",

  // --- List ------------------------------------------------------------------
  "catalog.list.title": "الأصناف",
  "catalog.list.sub": "الأصناف المسجَّلة في {tenant}. للقراءة فقط.",
  "catalog.list.storeNote": "تُعرض قيم المتجر {store} كما يحسبها الخادم.",
  "catalog.list.scopePrompt": "اختر مؤسسة لعرض الأصناف.",
  "catalog.list.caption": "الأصناف، مرتَّبة بالاسم أبجديًا",
  "catalog.list.captionSearch": "الأصناف، المطابقات الدقيقة للرمز أولًا ثم بالاسم أبجديًا",
  "catalog.list.loadingNoun": "الأصناف",
  "catalog.list.empty": "لا توجد أصناف نشطة بعد.",
  "catalog.list.emptyHint": "تظهر الأصناف هنا بعد وصولها إلى الكتالوج.",
  "catalog.list.emptyFiltered": "لا توجد أصناف تطابق {filters}.",
  "catalog.list.emptyFilteredHint": "غيّر عوامل التصفية أو امسحها.",
  "catalog.list.clearFilters": "مسح عوامل التصفية",
  "catalog.list.partialPage":
    "لا توجد أصناف مطابقة في الجزء الذي فُحص حتى الآن. اختر «تحميل المزيد» لمتابعة البحث.",
  "catalog.list.ended": "انتهت قائمة الأصناف.",
  "catalog.list.unavailable": "هذه الأصناف غير متاحة لك.",
  "catalog.list.unavailableHint": "اختر مؤسسة أو متجرًا آخر.",
  "catalog.list.storeStale": "المتجر المحدَّد لم يعد متاحًا.",
  "catalog.list.storeStaleHint": "غيّر المتجر من شريط النطاق، أو اختر «كل المتاجر».",
  "catalog.list.filterRejected": "رفض الخادم هذا البحث. راجع نص البحث والفئة.",
  "catalog.list.loadFailed": "تعذّر تحميل الأصناف.",
  "catalog.list.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "catalog.list.inlineError": "تعذّر تحميل بقية الصفوف. الصفوف المعروضة من آخر تحميل ناجح.",
  "catalog.list.retry": "إعادة المحاولة",
  "catalog.list.cursorRejected":
    "لم يقبل الخادم موضع الصفحة التالية. ابدأ من جديد من الصفحة الأولى.",
  "catalog.list.restart": "البدء من جديد",
  "catalog.list.loaded": "الأصناف المحمَّلة: {count}",
  "catalog.list.loadMore": "تحميل المزيد",
  "catalog.list.col.item": "الصنف",
  "catalog.list.col.status": "الحالة",
  "catalog.list.col.price": "السعر",
  "catalog.list.col.sku": "SKU",
  "catalog.list.col.barcode": "الباركود",
  "catalog.list.col.category": "الفئة",
  "catalog.list.col.availability": "الإتاحة في المتجر",
  "catalog.list.col.taxCategory": "فئة الضريبة",
  "catalog.list.col.tracking": "التتبع",
  "catalog.list.col.updatedAt": "آخر تحديث",

  // --- Values ----------------------------------------------------------------
  "catalog.value.noPrice": "بلا سعر",
  "catalog.value.noCategory": "بدون فئة",
  "catalog.status.active": "نشط",
  "catalog.status.inactive": "غير نشط",
  "catalog.status.retired": "أُخرج من الكتالوج",
  "catalog.status.any": "أي حالة",
  "catalog.status.unknownCode": "حالة غير مدعومة",
  "catalog.availability.yes": "متاح للبيع",
  "catalog.availability.no": "غير متاح",
  "catalog.availability.override": "مخصَّص للمتجر",
  "catalog.tracking.none": "بلا تتبع",
  "catalog.tracking.batch": "بالتشغيلة",
  "catalog.tracking.serial": "بالرقم المسلسل",
  "catalog.tracking.unknownCode": "تتبع غير مدعوم",

  // --- Filters ---------------------------------------------------------------
  "catalog.filter.label": "عوامل تصفية الأصناف",
  "catalog.filter.q": "الاسم أو الرمز",
  "catalog.filter.qNote":
    "يطابق الباركود أو SKU أو رمز البيع السريع كما هو بالضبط، أو جزءًا من الاسم. يُرسل النص كما كُتب.",
  "catalog.filter.status": "الحالة",
  "catalog.filter.category": "الفئة",
  "catalog.filter.categoryAll": "كل الفئات",
  "catalog.filter.categoryLoading": "جارٍ التحميل…",
  "catalog.filter.categoryStale": "فئة غير متاحة",
  "catalog.filter.categorySelected": "الفئة المحددة",
  "catalog.filter.categoriesFailed": "تعذّر تحميل الفئات.",
  "catalog.filter.apply": "بحث",
  "catalog.filter.clear": "مسح",
  "catalog.filter.qTooLong": "نص البحث لا يزيد على 100 حرف.",
  "catalog.filter.categoryInvalid": "الفئة في الرابط غير صالحة.",

  // --- Filter summary (the filtered-empty message) ---------------------------
  "catalog.summary.q": "بحث «{q}»",
  "catalog.summary.status": "الحالة: {status}",
  "catalog.summary.category": "الفئة: {category}",
  "catalog.summary.join": "، ",
} satisfies Messages;
