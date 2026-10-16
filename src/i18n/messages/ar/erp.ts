import type { Messages } from "../types";

/**
 * Arabic copy for the ERP connection & sync status surface (RT-560, spec 016
 * Phase A). Read-only.
 *
 * Glossary used here: Connector → «الموصل» (the ERPNext Connector instance);
 * liveness → «حالة الاتصال»; never seen → «لا توجد إشارة» (DESIGN.md: not
 * healthy and not an unknown outcome); stale → «متأخر»; dead-lettered posting →
 * «ترحيل مرفوض نهائيًا»; reconciliation → «المطابقة». Fields the connector
 * reports about itself are labelled «حسب تقرير الموصل». No rejection reason
 * text exists in the contract, so none is written here (RT-410).
 */
export const erp = {
  // --- Navigation (RT-557 OD-2: its own role-gated section) ---------------------
  "erp.nav.section": "التكامل",
  "erp.nav.label": "الاتصال والمزامنة",

  // --- Page ---------------------------------------------------------------------
  "erp.title": "اتصال ERPNext والمزامنة",
  "erp.sub": "حالة موصل ERPNext والترحيل والمطابقة في {tenant}. للقراءة فقط.",
  "erp.scopePrompt": "اختر مؤسسة لعرض حالة اتصال ERPNext.",
  "erp.refresh": "تحديث",
  "erp.retry": "إعادة المحاولة",
  "erp.loadMore": "تحميل المزيد",
  "erp.asOf": "آخر قراءة: {time}",
  "erp.inlineError": "تعذّر تحديث هذا القسم. المعروض من آخر قراءة ناجحة.",
  "erp.error.session": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "erp.error.forbidden": "هذا القسم غير متاح لدورك.",
  "erp.error.rejected": "رفض الخادم هذا الطلب. راجع التصفية ثم حاول مرة أخرى.",
  "erp.error.notFound": "هذا المتجر غير متاح لك.",

  // --- Store filter ---------------------------------------------------------------
  "erp.filter.store": "المتجر",
  "erp.filter.allStores": "كل المتاجر",
  "erp.filter.note":
    "تصفية المتجر تنطبق على ملخص المزامنة والترحيلات المرفوضة وسجل المطابقة. اتصال الموصل على مستوى المؤسسة.",

  // --- Connection panel (C1 joined with C2) ---------------------------------------
  "erp.conn.title": "اتصال الموصل",
  "erp.conn.caption": "مثيلات موصل ERPNext المسجّلة لهذه المؤسسة",
  "erp.conn.loadingNoun": "مثيلات الموصل",
  "erp.conn.empty": "لا يوجد موصل ERPNext مسجّل لهذه المؤسسة.",
  "erp.conn.emptyHint": "تسجيل الموصل وإصدار بيانات اعتماده خطوة يتولاها فريق المنصة حاليًا.",
  "erp.conn.loadFailed": "تعذّر تحميل مثيلات الموصل.",
  "erp.conn.healthFailed": "تعذّر قراءة حالة الاتصال، لذلك تظهر كل المثيلات بلا إشارة.",
  "erp.conn.noSignalNote":
    "«لا توجد إشارة» تعني أن الموصل لم يُرسل نبضًا بعد. ليست حالة سليمة وليست خطأ.",
  "erp.conn.col.instance": "المثيل",
  "erp.conn.col.environment": "البيئة",
  "erp.conn.col.site": "موقع ERPNext",
  "erp.conn.col.signal": "حالة الاتصال",
  "erp.conn.col.lastSeen": "آخر ظهور",
  "erp.conn.col.version": "الإصدار (حسب تقرير الموصل)",
  "erp.conn.col.reachable": "الوصول إلى ERPNext (حسب تقرير الموصل)",
  "erp.conn.col.credential": "انتهاء بيانات الاعتماد",
  "erp.conn.never": "لم يظهر بعد",
  "erp.conn.unknown": "غير معروف",
  "erp.conn.since": "منذ {duration}",
  "erp.conn.reportedAt": "أُبلغ في {time}",
  "erp.conn.noCredential": "لا توجد بيانات اعتماد فعّالة",
  "erp.conn.registrationDisabled": "التسجيل معطّل",
  "erp.reported.reachable": "يصل",
  "erp.reported.unreachable": "لا يصل",
  "erp.reported.notReported": "لم يُبلَّغ",
  "erp.env.dev": "تطوير",
  "erp.env.staging": "ما قبل الإطلاق",
  "erp.env.pilot": "تجريبية",
  "erp.env.prod": "إنتاج",
  "erp.env.unknown": "بيئة غير معروفة",
  "erp.signal.healthy": "متصل",
  "erp.signal.stale": "متأخر",
  "erp.signal.noSignal": "لا توجد إشارة",
  "erp.signal.disabled": "معطّل",

  // --- Sync summary (C3) -------------------------------------------------------------
  "erp.summary.title": "ملخص المزامنة",
  "erp.summary.note": "يُعرض كل مجال بحالته الخاصة؛ لا توجد حالة واحدة مجمّعة.",
  "erp.summary.loadingNoun": "ملخص المزامنة",
  "erp.summary.loadFailed": "تعذّر تحميل ملخص المزامنة.",
  "erp.summary.empty": "لم يُرجع الخادم أي مجال في الملخص.",
  "erp.summary.count": "العدد: {count}",
  "erp.domain.posting": "الترحيل إلى ERPNext",
  "erp.domain.reconciliation": "المطابقة",
  "erp.domain.connector_health": "صحة الموصل",
  "erp.domain.product_master": "بيانات الأصناف الرئيسية",
  "erp.domain.unknown": "مجال غير معروف",
  "erp.domainStatus.ok": "لا يحتاج إلى متابعة",
  "erp.domainStatus.attention": "يحتاج إلى متابعة",
  "erp.domainStatus.notAvailable": "غير متاح بعد",
  "erp.domainStatus.unknown": "حالة غير معروفة",

  // --- Posting backlog (C3) -------------------------------------------------------------
  "erp.backlog.title": "الترحيلات المرفوضة نهائيًا",
  "erp.backlog.sub": "ترحيلات إلى ERPNext رُفضت ولن يُعاد إرسالها تلقائيًا. للقراءة فقط.",
  "erp.backlog.reasonNote": "سبب الرفض المفصّل غير متاح بعد؛ تظهر فئة الرفض فقط.",
  "erp.backlog.caption": "الترحيلات المرفوضة نهائيًا، الأحدث أولًا",
  "erp.backlog.loadingNoun": "الترحيلات المرفوضة",
  "erp.backlog.empty": "لا توجد ترحيلات مرفوضة نهائيًا.",
  "erp.backlog.loadFailed": "تعذّر تحميل الترحيلات المرفوضة.",
  "erp.backlog.col.kind": "النوع",
  "erp.backlog.col.externalId": "مرجع نقطة البيع",
  "erp.backlog.col.source": "المصدر",
  "erp.backlog.col.rejectionClass": "فئة الرفض",
  "erp.backlog.col.deadLetteredAt": "وقت الرفض النهائي",
  "erp.backlog.kind.sale_post": "ترحيل بيع",
  "erp.backlog.kind.reversal": "عكس قيد",
  "erp.backlog.kind.unknown": "نوع غير معروف",
  "erp.backlog.notRecorded": "غير مسجّلة",

  // --- Reconciliation runs (C3) ------------------------------------------------------------
  "erp.runs.title": "سجل المطابقة",
  "erp.runs.sub": "عمليات مطابقة المخزون مع ERPNext، الأحدث أولًا. تفاصيل الفروق في {link}.",
  "erp.runs.caption": "عمليات مطابقة المخزون، الأحدث أولًا",
  "erp.runs.loadingNoun": "عمليات المطابقة",
  "erp.runs.empty": "لا توجد عمليات مطابقة مسجّلة.",
  "erp.runs.loadFailed": "تعذّر تحميل سجل المطابقة.",
  "erp.runs.col.store": "المتجر",
  "erp.runs.col.trigger": "البدء",
  "erp.runs.col.status": "الحالة",
  "erp.runs.col.startedAt": "وقت البدء",
  "erp.runs.col.finishedAt": "وقت الانتهاء",
  "erp.runs.col.mismatches": "الفروق حسب الفئة",
  "erp.runs.trigger.on_demand": "عند الطلب",
  "erp.runs.trigger.scheduled": "مجدولة",
  "erp.runs.trigger.unknown": "غير معروف",
  "erp.runs.status.running": "قيد التشغيل",
  "erp.runs.status.completed": "اكتملت",
  "erp.runs.status.failed": "فشلت",
  "erp.runs.status.unknown": "حالة غير معروفة",
  "erp.runs.notFinished": "لم تنتهِ",
  "erp.runs.noMismatches": "لا توجد فروق مسجّلة",
  "erp.runs.mismatch": "{kind}: {count}",
  "erp.runs.unknownStore": "متجر غير معروف",
} satisfies Messages;
