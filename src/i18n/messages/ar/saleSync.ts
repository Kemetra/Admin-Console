import type { Messages } from "../types";

/**
 * Arabic copy for the sale sync-ops surfaces (RT-726, spec 032 §9): the sync
 * status and sync timeline on the sale detail, the NEEDS_REPAIR list, and the
 * guarded repair request.
 *
 * Glossary: Sync → «المزامنة» (Backend-Core receiving and processing the sale);
 * dead letter → «عنصر مزامنة معزول»; NEEDS_REPAIR → «تحتاج إلى إصلاح»; repair →
 * «طلب إصلاح». RT-642 traps: «متزامنة» is never «مُرحَّلة إلى ERPNext»; an
 * unknown status is never «لم يُرحَّل»; no open item is never «مُرحَّل».
 */
export const saleSync = {
  // --- Navigation (under the Integration section, owner / tenant_admin) ----------
  "saleSync.nav.label": "مبيعات تحتاج إلى إصلاح",

  // --- Shared states ----------------------------------------------------------
  "saleSync.retry": "إعادة المحاولة",
  "saleSync.inlineError": "تعذّر تحديث هذا القسم. المعروض من آخر قراءة ناجحة.",
  "saleSync.error.session": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "saleSync.error.forbidden": "هذا القسم غير متاح لدورك.",
  "saleSync.error.rejected": "رفض الخادم هذا الطلب.",
  "saleSync.error.rateLimited": "طلبات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.",
  "saleSync.error.rateLimitedFor": {
    zero: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد {count} ثانية.",
    one: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد ثانية واحدة.",
    two: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد ثانيتين.",
    few: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد {count} ثوانٍ.",
    many: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد {count} ثانية.",
    other: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد {count} ثانية.",
  },
  "saleSync.value.notRecorded": "غير مسجّل",

  // --- Sync status section (sale detail) ------------------------------------------
  "saleSync.section.status": "مزامنة البيع مع الخادم",
  "saleSync.status.loadingNoun": "حالة المزامنة",
  "saleSync.status.loadFailed": "تعذّر تحميل حالة المزامنة.",
  "saleSync.status.notFound": "حالة المزامنة لهذا البيع غير متاحة لك.",
  "saleSync.status.captured": "مستلمة، لم تُعالج بعد",
  "saleSync.status.synced": "متزامنة",
  "saleSync.status.failedRetryable": "المزامنة قيد إعادة المحاولة",
  "saleSync.status.failedNeedsRepair": "تحتاج إلى إصلاح",
  "saleSync.status.unknown": "حالة مزامنة غير معروفة",
  "saleSync.meaning.captured":
    "استلم الخادم البيع ولم يعالجه بعد. هذه الحالة لا تخبر بشيء عن الترحيل إلى ERPNext.",
  "saleSync.meaning.synced":
    "عالج الخادم البيع. هذا لا يعني أنه رُحِّل إلى ERPNext؛ حالة الترحيل في قسمها الخاص.",
  "saleSync.meaning.failedRetryable":
    "تعذّرت المعالجة وسيعيد الخادم المحاولة بنفسه. لا يلزم أي إجراء الآن.",
  "saleSync.meaning.failedNeedsRepair":
    "توقفت المعالجة ولن يعيد الخادم المحاولة تلقائيًا. يمكنك أن تطلب من الخادم إصلاحها.",
  "saleSync.meaning.unknown":
    "أرسل الخادم حالة لا يعرفها هذا الإصدار. لا تعني أن البيع رُحِّل ولا أنه لم يُرحَّل.",
  "saleSync.field.status": "حالة المزامنة",
  "saleSync.field.source": "نظام المصدر",
  "saleSync.field.externalId": "المرجع في المصدر",
  "saleSync.field.processedAt": "وقت المعالجة",
  "saleSync.processedAt.none": "لم تُعالج بعد",

  // --- Dead letter ----------------------------------------------------------------
  "saleSync.deadLetter.title": "عنصر مزامنة معزول",
  "saleSync.deadLetter.none":
    "لا يوجد عنصر مزامنة معزول مفتوح لهذا البيع. هذا لا يعني أن البيع رُحِّل إلى ERPNext.",
  "saleSync.deadLetter.retryable": "قابل لإعادة المحاولة",
  "saleSync.deadLetter.needsRepair": "يحتاج إلى إصلاح",
  "saleSync.deadLetter.unknown": "تصنيف غير معروف",
  "saleSync.field.classification": "التصنيف",
  "saleSync.field.reasonCode": "رمز السبب",
  "saleSync.field.retryCount": "عدد المحاولات",
  "saleSync.field.quarantinedAt": "وقت العزل",
  "saleSync.field.resolvedAt": "وقت الحل",
  "saleSync.deadLetter.open": "مفتوح",

  // --- Repair (the one write) ----------------------------------------------------------
  "saleSync.repair.title": "طلب إصلاح المزامنة",
  "saleSync.repair.explain":
    "يعيد الخادم هذا البيع إلى طابور المزامنة. لا يغيّر البيع نفسه، ولا يرحّله إلى ERPNext مباشرة، ولا يُكرَّر تلقائيًا.",
  "saleSync.repair.action": "طلب إصلاح",
  "saleSync.repair.confirmLabel": "تأكيد طلب الإصلاح",
  "saleSync.repair.confirmPrompt": "هل تطلب من الخادم إصلاح مزامنة البيع {ref}؟",
  "saleSync.repair.confirm": "تأكيد الإصلاح",
  "saleSync.repair.sending": "جارٍ إرسال طلب الإصلاح…",
  "saleSync.repair.success":
    "قبل الخادم طلب الإصلاح. حالة المزامنة الآن: {status}. لم يُرحَّل البيع إلى ERPNext بهذه الخطوة.",
  "saleSync.repair.error.conflict":
    "البيع ليس في حالة قابلة للإصلاح الآن، ولم يتغيّر شيء. حُدّثت حالة المزامنة أعلاه.",
  "saleSync.repair.error.keyConflict":
    "رفض الخادم الطلب لأنه لا يطابق طلبًا سابقًا بالمفتاح نفسه. لم يتغيّر شيء، ويمكنك الطلب من جديد.",
  "saleSync.repair.error.notFound": "هذا البيع غير موجود أو غير متاح لك. لم يتغيّر شيء.",
  "saleSync.repair.error.forbidden": "دورك لا يسمح بطلب الإصلاح. لم يتغيّر شيء.",
  "saleSync.repair.error.originRejected":
    "رفض الخادم مصدر هذا الطلب، ولم يتغيّر شيء. أبلغ فريق الدعم برقم الطلب.",
  "saleSync.repair.error.rejected": "رفض الخادم الطلب. لم يتغيّر شيء.",
  "saleSync.repair.error.rateLimited": "طلبات كثيرة في وقت قصير. لم يُنفَّذ الإصلاح.",
  "saleSync.repair.error.rateLimitedFor": {
    zero: "طلبات كثيرة في وقت قصير. لم يُنفَّذ الإصلاح؛ يمكنك الطلب بعد {count} ثانية.",
    one: "طلبات كثيرة في وقت قصير. لم يُنفَّذ الإصلاح؛ يمكنك الطلب بعد ثانية واحدة.",
    two: "طلبات كثيرة في وقت قصير. لم يُنفَّذ الإصلاح؛ يمكنك الطلب بعد ثانيتين.",
    few: "طلبات كثيرة في وقت قصير. لم يُنفَّذ الإصلاح؛ يمكنك الطلب بعد {count} ثوانٍ.",
    many: "طلبات كثيرة في وقت قصير. لم يُنفَّذ الإصلاح؛ يمكنك الطلب بعد {count} ثانية.",
    other: "طلبات كثيرة في وقت قصير. لم يُنفَّذ الإصلاح؛ يمكنك الطلب بعد {count} ثانية.",
  },
  "saleSync.repair.error.unconfirmed":
    "لم يؤكد الخادم نتيجة الطلب، وربما نفّذه. راجع حالة المزامنة قبل الطلب مرة أخرى؛ الطلب التالي يُرسل بالمفتاح نفسه فلا يُطبَّق الإصلاح مرتين.",

  // --- Sync timeline (sale detail) --------------------------------------------------
  "saleSync.section.timeline": "سجل المزامنة",
  "saleSync.timeline.sub":
    "أحداث مزامنة هذا البيع كما سجّلها الخادم، الأقدم أولًا، دون بيانات حساسة.",
  "saleSync.timeline.caption": "أحداث مزامنة البيع، الأقدم أولًا",
  "saleSync.timeline.loadingNoun": "سجل المزامنة",
  "saleSync.timeline.loadFailed": "تعذّر تحميل سجل المزامنة.",
  "saleSync.timeline.notFound": "سجل المزامنة لهذا البيع غير متاح لك.",
  "saleSync.timeline.empty": "لا توجد أحداث مزامنة مسجّلة لهذا البيع.",
  "saleSync.timeline.col.at": "الوقت",
  "saleSync.timeline.col.event": "الحدث",
  "saleSync.timeline.col.correlation": "معرّف الارتباط",
  "saleSync.event.saleCaptured": "استلم الخادم البيع",
  "saleSync.event.syncSynced": "عالج الخادم البيع",
  "saleSync.event.syncRetryable": "عُزلت المزامنة وسيُعاد المحاولة",
  "saleSync.event.syncNeedsRepair": "عُزلت المزامنة وتحتاج إلى إصلاح",
  "saleSync.event.syncFailed": "فشلت المزامنة",
  "saleSync.event.repairRequested": "طُلب إصلاح المزامنة",
  "saleSync.event.repairResolved": "أُغلق عنصر المزامنة المعزول بالإصلاح",
  "saleSync.event.unknown": "حدث غير معروف",

  // --- NEEDS_REPAIR list --------------------------------------------------------------
  "saleSync.list.title": "مبيعات تحتاج إلى إصلاح",
  "saleSync.list.sub":
    "عمليات بيع أوقف الخادم مزامنتها ولن يعيد محاولتها تلقائيًا في {tenant}، الأحدث أولًا. يُطلب الإصلاح من صفحة كل بيع على حدة.",
  "saleSync.list.note":
    "ظهور البيع هنا لا يعني فشل ترحيله إلى ERPNext، وغيابه عن القائمة لا يعني أنه رُحِّل.",
  "saleSync.list.scopePrompt": "اختر مؤسسة لعرض المبيعات التي تحتاج إلى إصلاح.",
  "saleSync.list.refresh": "تحديث",
  "saleSync.list.loadMore": "تحميل المزيد",
  "saleSync.list.asOf": "آخر قراءة: {time}",
  "saleSync.list.caption": "مبيعات تحتاج إلى إصلاح، الأحدث أولًا",
  "saleSync.list.loadingNoun": "المبيعات التي تحتاج إلى إصلاح",
  "saleSync.list.loadFailed": "تعذّر تحميل المبيعات التي تحتاج إلى إصلاح.",
  "saleSync.list.empty": "لا توجد مبيعات مفتوحة تحتاج إلى إصلاح.",
  "saleSync.list.emptyStore": "لا توجد مبيعات مفتوحة تحتاج إلى إصلاح في هذا المتجر.",
  "saleSync.list.emptyHint": "قائمة فارغة لا تعني أن كل المبيعات رُحِّلت إلى ERPNext.",
  "saleSync.list.storeNotFound": "هذا المتجر غير متاح لك.",
  "saleSync.list.unknownStore": "متجر غير معروف",
  "saleSync.list.openSale": "فتح البيع {ref}",
  "saleSync.filter.store": "المتجر",
  "saleSync.filter.allStores": "كل المتاجر",
  "saleSync.col.externalId": "المرجع في المصدر",
  "saleSync.col.store": "المتجر",
  "saleSync.col.source": "نظام المصدر",
  "saleSync.col.reason": "رمز السبب",
  "saleSync.col.retries": "عدد المحاولات",
  "saleSync.col.quarantinedAt": "وقت العزل",
} satisfies Messages;
