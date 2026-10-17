import type { Messages } from "../types";

/**
 * Arabic copy for sales search and sale detail (RT-587, spec 012). Read-only.
 *
 * Glossary: Sale → «عملية البيع»; Business date → «يوم العمل»; Terminal →
 * «الجهاز»; Tender / payment → «الدفع»; Void → «الإلغاء»; Return →
 * «المرتجع»; ERP posting → «الترحيل إلى ERPNext»; Sync → «المزامنة». No copy
 * claims a list is complete (it covers what the server received up to a time),
 * and an unknown ERP state stays «غير معروفة», never «لم يُرحَّل».
 */
export const sales = {
  // --- Navigation ------------------------------------------------------------
  "sales.nav.section": "المعاملات",
  "sales.nav.label": "المبيعات",

  // --- List ------------------------------------------------------------------
  "sales.list.title": "المبيعات",
  "sales.list.sub": "عمليات البيع التي استلمها الخادم لمتجر واحد في {tenant}. للقراءة فقط.",
  "sales.list.scopePrompt": "اختر مؤسسة لعرض المبيعات.",
  "sales.list.queryPrompt": "اختر متجرًا ونطاقًا من أيام العمل، ثم ابحث.",
  "sales.list.queryPromptHint": "لا يُقرأ شيء قبل تحديد الاثنين. يغطي البحث 31 يوم عمل على الأكثر.",
  "sales.list.caption": "عمليات البيع التي استلمها الخادم، الأحدث أولًا",
  "sales.list.loadingNoun": "المبيعات",
  "sales.list.asOf":
    "ما استلمه الخادم حتى {asOf}. عمليات البيع التي لا تزال في انتظار المزامنة على جهاز غير مشمولة.",
  "sales.list.zoneNote": "الأوقات بتوقيت {zone}.",
  "sales.list.empty": "لم يستلم الخادم أي عملية بيع لهذا المتجر وهذا النطاق حتى {asOf}.",
  "sales.list.emptyHint": "تظهر عمليات البيع المنتظرة على جهاز بعد مزامنتها.",
  "sales.list.partialPage":
    "لا توجد نتائج مطابقة في الجزء الذي فُحص من النطاق حتى الآن. اختر «تحميل المزيد» لمتابعة البحث.",
  "sales.list.ended": "انتهت عمليات البيع المستلمة لهذا النطاق.",
  "sales.list.unavailable": "هذه المبيعات غير متاحة لك.",
  "sales.list.unavailableHint": "اختر متجرًا آخر أو نطاقًا آخر.",
  "sales.list.filterRejected":
    "رفض الخادم هذا البحث. راجع المتجر والتاريخين (31 يوم عمل على الأكثر) وعوامل التصفية.",
  "sales.list.loadFailed": "تعذّر تحميل المبيعات.",
  "sales.list.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "sales.list.inlineError": "تعذّر تحميل بقية الصفوف. الصفوف المعروضة من آخر تحميل ناجح.",
  "sales.list.retry": "إعادة المحاولة",
  "sales.list.cursorRejected":
    "لم يقبل الخادم موضع الصفحة التالية. ابدأ البحث من جديد من الصفحة الأولى.",
  "sales.list.restart": "البدء من جديد",
  "sales.list.loaded": "المحمَّل: {count}",
  "sales.list.loadMore": "تحميل المزيد",
  "sales.list.col.saleNumber": "رقم البيع",
  "sales.list.col.businessDate": "يوم العمل",
  "sales.list.col.occurredAt": "وقت البيع",
  "sales.list.col.device": "الجهاز",
  "sales.list.col.operator": "الكاشير",
  "sales.list.col.total": "الإجمالي",
  "sales.list.col.status": "الحالة",

  // --- Recorded values -------------------------------------------------------
  "sales.value.notRecorded": "غير مسجَّل",
  "sales.value.currentName": "{name} (الاسم الحالي)",
  "sales.device.none": "لا يوجد جهاز مسجَّل",
  "sales.chip.voided": "ملغاة",

  // --- Filters ---------------------------------------------------------------
  "sales.filter.label": "البحث في المبيعات",
  "sales.filter.store": "المتجر",
  "sales.filter.storePlaceholder": "اختر متجرًا",
  "sales.filter.from": "من يوم العمل",
  "sales.filter.to": "إلى يوم العمل",
  "sales.filter.zoneNote":
    "أيام العمل بتوقيت المتجر ({zone})، واليومان مشمولان، و31 يومًا على الأكثر.",
  "sales.filter.zonePending": "اختر متجرًا: تُقرأ أيام العمل بتوقيته.",
  "sales.filter.saleNumber": "رقم البيع",
  "sales.filter.saleNumberNote":
    "مطابقة تامة. عمليات البيع المسجَّلة قبل تسجيل أرقام الإيصالات ليس لها رقم ولا تظهر في هذا البحث.",
  "sales.filter.sync": "حالة المزامنة",
  "sales.filter.voided": "الإلغاء",
  "sales.filter.voidedTrue": "الملغاة فقط",
  "sales.filter.voidedFalse": "غير الملغاة",
  "sales.filter.returns": "المرتجعات",
  "sales.filter.erp": "الترحيل إلى ERPNext",
  "sales.filter.any": "الكل",
  "sales.filter.apply": "بحث",
  "sales.filter.clear": "مسح",
  "sales.filter.storeRequired": "اختر متجرًا.",
  "sales.filter.datesRequired": "أدخل التاريخين.",
  "sales.filter.dateInvalid": "أدخل تاريخًا صحيحًا بين 2000 و2100.",
  "sales.filter.rangeReversed": "لا يمكن أن يسبق تاريخ النهاية تاريخ البداية.",
  "sales.filter.spanTooWide": "يغطي البحث 31 يوم عمل على الأكثر. ضيّق النطاق.",
  "sales.filter.saleNumberTooLong": "رقم البيع 96 حرفًا على الأكثر.",

  // --- Status codes ------------------------------------------------------------
  "sales.sync.captured": "مستلمة",
  "sales.sync.synced": "متزامنة",
  "sales.sync.failedRetryable": "المزامنة قيد إعادة المحاولة",
  "sales.sync.failedNeedsRepair": "تحتاج إلى إصلاح",
  "sales.sync.unknownCode": "حالة مزامنة غير معروفة",
  "sales.returns.none": "بلا مرتجعات",
  "sales.returns.partial": "مرتجع جزئي",
  "sales.returns.full": "مرتجع كامل",
  "sales.returns.unknownCode": "حالة مرتجع غير معروفة",
  "sales.erp.posted": "مُرحَّلة إلى ERPNext",
  "sales.erp.pending": "قيد الترحيل إلى ERPNext",
  "sales.erp.failed": "فشل الترحيل إلى ERPNext",
  "sales.erp.unknown": "حالة الترحيل إلى ERPNext غير معروفة",
  "sales.tender.cash": "نقدًا",
  "sales.tender.card_external": "بطاقة (جهاز دفع خارجي)",
  "sales.tender.unknownMethod": "طريقة أخرى",

  // --- Detail ------------------------------------------------------------------
  "sales.detail.back": "العودة إلى المبيعات",
  "sales.detail.title": "عملية البيع {number}",
  "sales.detail.titleNoNumber": "عملية بيع بلا رقم",
  "sales.detail.zoneNote": "الأوقات بتوقيت {zone}. حُدِّدت أيام العمل وقت البيع.",
  "sales.detail.loadingNoun": "عملية البيع",
  "sales.detail.notFound": "عملية البيع هذه غير موجودة أو غير متاحة لك.",
  "sales.detail.loadFailed": "تعذّر تحميل عملية البيع.",
  "sales.detail.retry": "إعادة المحاولة",
  "sales.detail.missing": "غير مسجَّل لعملية البيع هذه.",
  "sales.section.summary": "عملية البيع",
  "sales.section.receiptHeader": "رأس الإيصال",
  "sales.section.lines": "البنود",
  "sales.section.payments": "الدفع",
  "sales.section.void": "الإلغاء",
  "sales.section.returns": "المرتجعات",
  "sales.section.erp": "الترحيل إلى ERPNext",
  "sales.section.related": "شاشات ذات صلة",
  "sales.field.saleNumber": "رقم البيع",
  "sales.field.receiptNumber": "رقم الإيصال",
  "sales.field.businessDate": "يوم العمل",
  "sales.field.occurredAt": "وقت البيع",
  "sales.field.receivedAt": "وقت الاستلام في الخادم",
  "sales.field.settledAt": "الوقت المطبوع على الإيصال",
  "sales.field.store": "المتجر",
  "sales.field.device": "الجهاز",
  "sales.field.operator": "الكاشير",
  "sales.field.total": "الإجمالي",
  "sales.field.branchName": "الاسم على الإيصال",
  "sales.field.branchAddress": "العنوان على الإيصال",
  "sales.field.taxRegistrationId": "رقم التسجيل الضريبي",
  "sales.unknownStore": "متجر غير معروف",

  // --- Lines -------------------------------------------------------------------
  "sales.lines.caption": "بنود عملية البيع",
  "sales.lines.empty": "لا توجد بنود مسجَّلة لعملية البيع هذه.",
  "sales.lines.orderNotRecorded":
    "ترتيب الإيصال الأصلي غير مسجَّل: البنود معروضة بترتيب ثابت ليس ترتيب الإيصال.",
  "sales.lines.col.sequence": "الترتيب",
  "sales.lines.col.name": "الصنف",
  "sales.lines.col.quantity": "الكمية",
  "sales.lines.col.unit": "الوحدة",
  "sales.lines.col.unitPrice": "سعر الوحدة",
  "sales.lines.col.amount": "قيمة البند",
  "sales.lines.col.tax": "الضريبة",
  "sales.lines.col.returned": "الكمية المرتجعة",

  // --- Payments ----------------------------------------------------------------
  "sales.payments.unknown": "تفاصيل الدفع غير مسجَّلة لعملية البيع هذه.",
  "sales.payments.caption": "طرق الدفع المسجَّلة",
  "sales.payments.netNote": "المبالغ صافية بعد الباقي، كما سُجِّلت.",
  "sales.payments.col.method": "الطريقة",
  "sales.payments.col.amount": "المبلغ",
  "sales.payments.col.reference": "المرجع",
  "sales.payments.changeGiven": "الباقي المدفوع",

  // --- Void --------------------------------------------------------------------
  "sales.void.none": "عملية البيع هذه غير ملغاة.",
  "sales.void.voidedAt": "وقت الإلغاء",
  "sales.void.businessDate": "يوم عمل الإلغاء",
  "sales.void.approved": "موافقة المدير",
  "sales.void.approvedYes": "نعم",
  "sales.void.approvedNo": "لا (إلغاء قديم)",
  "sales.void.approverRole": "دور المعتمِد",
  "sales.void.approverRoleNote": "الدور الحالي للمعتمِد، وقد لا يكون دوره وقت الإلغاء.",

  // --- Returns -----------------------------------------------------------------
  "sales.returns.empty": "لا توجد مرتجعات مسجَّلة.",
  "sales.returns.recordedAt": "وقت التسجيل",
  "sales.returns.businessDate": "يوم العمل",
  "sales.returns.total": "إجمالي المرتجع",
  "sales.returns.caption": "البنود المرتجعة",
  "sales.returns.col.item": "الصنف",
  "sales.returns.col.quantity": "الكمية",
  "sales.returns.col.amount": "القيمة",
  "sales.returns.unknownLine": "بند غير موجود في عملية البيع هذه",

  // --- ERP ---------------------------------------------------------------------
  "sales.erp.sale": "ترحيل البيع",
  "sales.erp.saleDocument": "مستند ERPNext",
  "sales.erp.reversal": "ترحيل عكس الإلغاء",
  "sales.erp.reversalDocument": "مستند العكس في ERPNext",
  "sales.erp.note": "حالة ترحيل تشغيلية كما يعرضها الخادم، وليست إقرارًا ضريبيًا.",

  // --- Related -----------------------------------------------------------------
  "sales.related.shiftCloses": "استثناءات إقفال الوردية (فرق غير صفري) في ذلك اليوم",
} satisfies Messages;
