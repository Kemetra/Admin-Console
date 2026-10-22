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

  // --- Detail (RT-766, CAT-C1b) -----------------------------------------------
  "catalog.detail.back": "العودة إلى الأصناف",
  "catalog.detail.scopePrompt": "اختر مؤسسة لعرض هذا الصنف.",
  "catalog.detail.sub": "صنف في {tenant}. للقراءة فقط.",
  "catalog.detail.loadingNoun": "الصنف",
  "catalog.detail.unavailable": "هذا الصنف غير متاح لك.",
  "catalog.detail.unavailableHint": "قد لا يكون موجودًا، أو قد يكون خارج مؤسستك أو متاجرك.",
  "catalog.detail.loadFailed": "تعذّر تحميل هذا الصنف.",
  "catalog.detail.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "catalog.detail.rateLimited": "طلبات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.",
  "catalog.detail.retry": "إعادة المحاولة",
  "catalog.detail.inventoryLink": "عرض الرصيد الفعلي في {store}",

  "catalog.detail.tenant.title": "قيم المؤسسة",
  "catalog.detail.field.status": "الحالة",
  "catalog.detail.field.description": "الوصف",
  "catalog.detail.field.category": "الفئة",
  "catalog.detail.field.taxCategory": "فئة الضريبة",
  "catalog.detail.field.tenantAvailability": "التوفر على مستوى المؤسسة",
  "catalog.detail.field.availability": "التوفر",
  "catalog.detail.field.tracking": "التتبع",
  "catalog.detail.field.price": "السعر",
  "catalog.detail.field.updatedAt": "آخر تحديث",
  "catalog.detail.value.noDescription": "لا يوجد وصف",
  "catalog.detail.noPriceNotice": "لا يوجد سعر: لن تبيع نقطة البيع هذا الصنف حتى يُحدَّد له سعر.",

  "catalog.detail.identifiers.title": "المعرّفات",
  "catalog.detail.identifiers.caption": "المعرّفات النشطة لهذا الصنف",
  "catalog.detail.identifiers.col.type": "النوع",
  "catalog.detail.identifiers.col.value": "القيمة",
  "catalog.detail.identifiers.col.scope": "النطاق",
  "catalog.detail.identifiers.col.source": "النظام المصدر",
  "catalog.detail.identifiers.scopeAll": "كل المتاجر",
  "catalog.detail.identifiers.empty": "لا توجد معرّفات نشطة لهذا الصنف.",
  "catalog.detail.identifierType.barcode": "الباركود",
  "catalog.detail.identifierType.sku": "SKU",
  "catalog.detail.identifierType.plu": "رمز البيع السريع",
  "catalog.detail.identifierType.supplier_code": "رمز المورّد",
  "catalog.detail.identifierType.external_pos_id": "معرّف نقطة بيع خارجية",
  "catalog.detail.identifierType.unknownCode": "نوع غير مدعوم",

  "catalog.detail.overrides.title": "تخصيصات المتاجر",
  "catalog.detail.overrides.sub":
    "قيم كل متجر الخاصة به كما هي مخزَّنة، بجانب قيمة المؤسسة. القيمة التي يبيع بها المتجر فعليًا يحسبها الخادم: اختر متجرًا من شريط النطاق ثم افتح قائمة الأصناف لرؤيتها.",
  "catalog.detail.overrides.empty": "لا يوجد متجر ضمن نطاقك له قيم خاصة بهذا الصنف.",
  "catalog.detail.overrides.noValues": "هذا التخصيص لا يحدد أي قيمة خاصة به.",
  "catalog.detail.overrides.caption": "تخصيص المتجر {store}",
  "catalog.detail.overrides.col.setting": "الإعداد",
  "catalog.detail.overrides.col.store": "قيمة المتجر",
  "catalog.detail.overrides.col.tenant": "قيمة المؤسسة",
} satisfies Messages;
