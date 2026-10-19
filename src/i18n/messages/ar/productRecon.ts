import type { Messages } from "../types";

/**
 * Arabic copy for ERPNext product-master reconciliation (RT-727, Backend-Core
 * spec 021).
 *
 * Glossary used here: reconciliation → «المطابقة» (as in RT-560); mapping →
 * «الربط»; the backlog → «منتجات بلا ربط»; a run → «عملية مطابقة»; ERPNext
 * item reference → «مرجع صنف ERPNext». The contract carries no reason text,
 * so none is written here; unknown server values read «غير معروف».
 */
export const productRecon = {
  // --- Navigation (in the Integration section, beside the ERP connection) ---------
  "productRecon.nav.label": "مطابقة المنتجات",

  // --- Page ---------------------------------------------------------------------------
  "productRecon.title": "مطابقة المنتجات مع ERPNext",
  "productRecon.sub": "منتجات {tenant} التي لا تملك ربطًا مؤكدًا بصنف ERPNext، وسجل عمليات المطابقة.",
  "productRecon.scopePrompt": "اختر مستأجرًا لعرض مطابقة المنتجات.",
  "productRecon.refresh": "تحديث",
  "productRecon.retry": "إعادة المحاولة",
  "productRecon.loadMore": "تحميل المزيد",
  "productRecon.stale": "تعذّر التحديث. المعروض هو آخر قراءة ناجحة.",
  "productRecon.unknown": "غير معروف",
  "productRecon.none": "—",
  "productRecon.retryIn": {
    zero: "حاول مرة أخرى بعد {count} ثانية.",
    one: "حاول مرة أخرى بعد ثانية واحدة.",
    two: "حاول مرة أخرى بعد ثانيتين.",
    few: "حاول مرة أخرى بعد {count} ثوانٍ.",
    many: "حاول مرة أخرى بعد {count} ثانية.",
    other: "حاول مرة أخرى بعد {count} ثانية.",
  },

  // --- Read errors -----------------------------------------------------------------------
  "productRecon.error.session": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "productRecon.error.forbidden": "هذا القسم غير متاح لدورك.",
  "productRecon.error.notFound": "هذا القسم غير متاح لك.",
  "productRecon.error.rejected": "رفض الخادم هذا الطلب. راجع عامل التصفية وحاول مرة أخرى.",
  "productRecon.error.rateLimited": "طلبات كثيرة جدًا.",

  // --- Class filter and classes ------------------------------------------------------------
  "productRecon.filter.class": "التصنيف",
  "productRecon.filter.all": "كل التصنيفات",
  "productRecon.class.match": "مطابق",
  "productRecon.class.unmapped_dp2_product": "منتج بلا ربط",
  "productRecon.class.suggestion_unconfirmed": "اقتراح غير مؤكد",
  "productRecon.class.unmapped_erpnext_item": "صنف ERPNext بلا ربط",
  "productRecon.class.attribute_drift": "اختلاف في الخصائص",
  "productRecon.class.sellable_state_divergence": "اختلاف في قابلية البيع",

  // --- Backlog -------------------------------------------------------------------------------
  "productRecon.backlog.title": "منتجات بلا ربط مؤكد",
  "productRecon.backlog.sub":
    "قراءة حية للمنتجات النشطة التي لا تملك ربطًا مؤكدًا وفعّالًا بصنف ERPNext.",
  "productRecon.backlog.caption": "المنتجات النشطة التي تنقصها ربط مؤكد بصنف ERPNext",
  "productRecon.backlog.loadingNoun": "المنتجات بلا ربط",
  "productRecon.backlog.loadFailed": "تعذّر تحميل المنتجات بلا ربط.",
  "productRecon.backlog.empty": "لكل المنتجات النشطة ربط مؤكد بصنف ERPNext.",
  "productRecon.backlog.col.product": "معرّف المنتج",
  "productRecon.backlog.col.class": "التصنيف",
  "productRecon.backlog.col.suggestion": "الصنف المقترح",
  "productRecon.backlog.col.observedAt": "وقت الرصد",
  "productRecon.backlog.col.action": "الإجراء",
  "productRecon.backlog.suggestedAt": "اقتُرح في {time}",

  // --- Runs ------------------------------------------------------------------------------------
  "productRecon.runs.title": "عمليات المطابقة",
  "productRecon.runs.sub":
    "تقارن كل عملية الربط المؤكد بأصناف ERPNext كما يعرضها الموصل، دون تعديل أي ربط أو منتج. الأحدث أولًا.",
  "productRecon.runs.caption": "عمليات مطابقة المنتجات مع ERPNext",
  "productRecon.runs.loadingNoun": "عمليات المطابقة",
  "productRecon.runs.loadFailed": "تعذّر تحميل عمليات المطابقة.",
  "productRecon.runs.empty": "لم تُنفّذ أي عملية مطابقة بعد.",
  "productRecon.runs.col.startedAt": "البدء",
  "productRecon.runs.col.trigger": "المصدر",
  "productRecon.runs.col.status": "الحالة",
  "productRecon.runs.col.view": "بيانات ERPNext",
  "productRecon.runs.col.finishedAt": "الانتهاء",
  "productRecon.runs.col.summary": "الأعداد حسب التصنيف",
  "productRecon.runs.col.results": "النتائج",
  "productRecon.runs.notFinished": "لم تنتهِ بعد",
  "productRecon.runs.noSummary": "لا يوجد ملخص",
  "productRecon.runs.viewResults": "عرض النتائج",
  "productRecon.runs.status.running": "قيد التنفيذ",
  "productRecon.runs.status.completed": "مكتملة",
  "productRecon.runs.status.failed": "فشلت",
  "productRecon.runs.view.available": "متاحة",
  "productRecon.runs.view.partial": "جزئية",
  "productRecon.runs.view.unavailable": "غير متاحة",
  "productRecon.runs.trigger.on_demand": "يدويًا",
  "productRecon.runs.trigger.scheduled": "مجدولة",

  // --- Start a run -------------------------------------------------------------------------------
  "productRecon.trigger.start": "بدء عملية مطابقة",
  "productRecon.trigger.confirmLabel": "تأكيد بدء عملية مطابقة",
  "productRecon.trigger.confirmPrompt":
    "ستبدأ عملية مطابقة جديدة للمستأجر كله. لا تعدّل العملية أي ربط أو منتج. هل تريد المتابعة؟",
  "productRecon.trigger.confirm": "بدء العملية",
  "productRecon.trigger.started": "بدأت العملية. الحالة: {status}. بيانات ERPNext: {view}.",

  // --- Run results ---------------------------------------------------------------------------------
  "productRecon.results.heading": "نتائج عملية المطابقة",
  "productRecon.results.title": "النتائج المصنّفة",
  "productRecon.results.sub": "العملية {run}.",
  "productRecon.results.caption": "النتائج المصنّفة لعملية مطابقة المنتجات",
  "productRecon.results.loadingNoun": "النتائج",
  "productRecon.results.loadFailed": "تعذّر تحميل نتائج العملية.",
  "productRecon.results.notFound": "هذه العملية غير متاحة لك.",
  "productRecon.results.empty": "لا توجد نتائج بهذا التصنيف.",
  "productRecon.results.back": "عمليات المطابقة",
  "productRecon.results.col.class": "التصنيف",
  "productRecon.results.col.product": "معرّف المنتج",
  "productRecon.results.col.erpnext": "مرجع صنف ERPNext",
  "productRecon.results.col.state": "حالة النتيجة",
  "productRecon.results.col.detail": "التفاصيل كما وردت",
  "productRecon.results.col.action": "الإجراء",
  "productRecon.results.state.open": "مفتوحة",
  "productRecon.results.state.repaired": "تمت المعالجة",
  "productRecon.results.state.accepted": "مقبولة",

  // --- Repair (suggest_confirm) ---------------------------------------------------------------------
  "productRecon.repair.open": "ربط بصنف",
  "productRecon.repair.label": "ربط منتج بصنف ERPNext",
  "productRecon.repair.title": "ربط المنتج بصنف ERPNext",
  "productRecon.repair.product": "المنتج {product}.",
  "productRecon.repair.ref": "مرجع صنف ERPNext",
  "productRecon.repair.refHint": "اكتب مرجع الصنف كما هو في ERPNext (حتى ١٨٠ حرفًا).",
  "productRecon.repair.refInvalid": "أدخل مرجع صنف من ١ إلى ١٨٠ حرفًا.",
  "productRecon.repair.review": "مراجعة",
  "productRecon.repair.confirmLabel": "تأكيد ربط المنتج",
  "productRecon.repair.confirmPrompt":
    "سيُربط المنتج {product} بصنف ERPNext {ref} ويُؤكَّد الربط. هل تريد المتابعة؟",
  "productRecon.repair.confirm": "ربط وتأكيد",
  "productRecon.repair.back": "تعديل",
  "productRecon.repair.close": "إغلاق",
  "productRecon.repair.needsVersion": "يُؤكَّد هذا الاقتراح من شاشة ربط الأصناف.",
  "productRecon.repair.recordedTitle": "سُجّلت المعالجة",
  "productRecon.repair.outcome.mapped": "أصبح الربط مؤكدًا وفعّالًا.",
  "productRecon.repair.outcome.no_op_echo": "كان للمنتج ربط مؤكد وفعّال من قبل. لم يتغير شيء.",
  "productRecon.repair.outcome.no_op_echo_mapping":
    "كان هذا الربط مؤكدًا وفعّالًا من قبل. لم يتغير شيء.",
  "productRecon.repair.outcome.still_unmapped": "ما زال المنتج بلا ربط.",
  "productRecon.repair.outcome.conflict": "تغيّر الربط في الوقت نفسه. ما زال المنتج بلا ربط مؤكد.",
  "productRecon.repair.outcome.unknown": "سجّل الخادم نتيجة لا تعرفها هذه النسخة.",

  // --- Repair of an existing mapping (confirm / re_point, RT-733) -------------------------------
  "productRecon.repair.confirmOpen": "تأكيد",
  "productRecon.repair.repointOpen": "إعادة توجيه",
  "productRecon.repair.mapping.confirmLabel": "تأكيد الربط المقترح",
  "productRecon.repair.mapping.repointLabel": "إعادة توجيه الربط",
  "productRecon.repair.mapping.confirmPrompt":
    "سيُؤكَّد الربط المقترح للمنتج {product} بصنف ERPNext {ref} (الربط {mapping}، الإصدار {version}). هل تريد المتابعة؟",
  "productRecon.repair.mapping.repointPrompt":
    "سيُعاد توجيه الربط {mapping} للمنتج {product} (صنف ERPNext {ref}) ويُؤكَّد عند الإصدار {version}. إن كان مؤكدًا وفعّالًا من قبل فلن يتغير شيء. هل تريد المتابعة؟",
  "productRecon.repair.mapping.confirm": "تأكيد الربط",
  "productRecon.repair.mapping.repoint": "إعادة التوجيه والتأكيد",
  "productRecon.refusal.staleVersion":
    "لم يُنفَّذ الطلب: تغيّر الربط بعد قراءة هذه القائمة، فلم يعد الإصدار {version} هو الحالي (أو سبق استخدام هذا الطلب). أُعيدت قراءة القائمة؛ أغلق اللوحة وافتح الصف مرة أخرى للتعامل مع الإصدار الحالي.",

  // --- Refused mutations (never retried automatically) -----------------------------------------------
  "productRecon.refusal.rejected": "رفض الخادم الطلب لأن بياناته غير صالحة. لم يتغير شيء.",
  "productRecon.refusal.session": "انتهت جلستك. سجّل الدخول مرة أخرى. لم يتغير شيء.",
  "productRecon.refusal.origin": "رفض الخادم الطلب لأنه لم يصدر من هذه الوحدة. لم يتغير شيء.",
  "productRecon.refusal.notFound": "المنتج أو النتيجة غير متاحة لك. لم يتغير شيء.",
  "productRecon.refusal.conflict":
    "تعارض: تغيّر الربط في الوقت نفسه، أو أُعيد استخدام الطلب. حدّث الصفحة وراجع الحالة.",
  "productRecon.refusal.rateLimited": "طلبات كثيرة جدًا. لم يُنفّذ الطلب.",
  "productRecon.refusal.error":
    "تعذّر إكمال الطلب. الحالة غير معروفة: حدّث الصفحة قبل المحاولة مرة أخرى.",
} satisfies Messages;
