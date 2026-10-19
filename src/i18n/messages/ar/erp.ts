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

  // --- ERPNext item & warehouse mappings (RT-725) ------------------------------
  // Glossary: mapping → «ربط»; suggested → «مقترح» (inert: not used for posting
  // until confirmed); confirmed → «مؤكَّد»; retire → «إيقاف» (append-only: the
  // row stays as history). References are shown exactly as received.
  "erp.map.link": "ربط الأصناف والمستودعات",
  "erp.map.title": "ربط ERPNext: الأصناف والمستودعات",
  "erp.map.sub":
    "ربط منتجات {tenant} ومتاجرها بمراجع ERPNext. يُستخدم الربط المؤكَّد وحده عند الترحيل.",
  "erp.map.back": "العودة إلى الاتصال والمزامنة",
  "erp.map.scopePrompt": "اختر مؤسسة لعرض ربط ERPNext.",
  "erp.map.review": "مراجعة",
  "erp.map.notYet": "لم يُؤكَّد بعد",
  "erp.map.col.actions": "الإجراءات",
  "erp.map.form.required": "أدخل مرجع ERPNext.",
  "erp.map.form.storeRequired": "اختر متجرًا.",

  "erp.map.error.validation": "رفض الخادم القيم المرسلة. راجعها ثم حاول مرة أخرى.",
  "erp.map.error.readRejected": "رفض الخادم هذا الطلب. غيّر التصفية ثم حاول مرة أخرى.",
  "erp.map.error.session": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "erp.map.error.unavailable": "هذا القسم غير متاح لدورك.",
  "erp.map.error.origin":
    "رفض الخادم تغييرًا من هذه الصفحة. أعد تحميل وحدة الإدارة ثم حاول مرة أخرى.",
  "erp.map.error.productNotFound": "هذا المنتج غير متاح لك. لم يُسجَّل أي اقتراح.",
  "erp.map.error.mappingNotFound": "هذا الربط لم يعد موجودًا أو غير متاح لك. تم تحديث القائمة.",
  "erp.map.error.storeNotFound": "هذا المتجر غير متاح لك. لم يُسجَّل أي ربط.",
  "erp.map.error.suggestConflict": "لهذا المنتج ربط نشط بالفعل. تم تحديث القائمة.",
  "erp.map.error.confirmConflict":
    "تغيّر هذا الربط منذ عرضه أو لم يعد قابلًا للتأكيد. تم تحديث القائمة؛ راجعه ثم حاول مرة أخرى.",
  "erp.map.error.retireConflict":
    "تغيّر هذا الربط منذ عرضه أو أُوقف بالفعل. تم تحديث القائمة؛ راجعه ثم حاول مرة أخرى.",
  "erp.map.error.setConflict": "لهذا المتجر ربط مستودع نشط بالفعل. تم تحديث القائمة.",
  "erp.map.error.rateLimited": "طلبات كثيرة جدًا. انتظر قليلًا ثم حاول مرة أخرى.",
  "erp.map.error.rateLimitedWait": "طلبات كثيرة جدًا. انتظر {seconds} ثانية ثم حاول مرة أخرى.",
  "erp.map.error.unknownTitle": "النتيجة غير معروفة",
  "erp.map.error.unknownOutcome":
    "لم يصل رد واضح، فربما طُبِّق التغيير وربما لم يُطبَّق. تم تحديث القائمة: تحقّق منها قبل المحاولة مرة أخرى.",
  "erp.map.error.failed": "تعذّر تحميل الربط. حاول مرة أخرى.",

  "erp.map.state.suggested": "مقترح — غير مستخدم في الترحيل",
  "erp.map.state.confirmed": "مؤكَّد",
  "erp.map.state.unknown": "غير معروف",
  "erp.map.source.barcode": "الباركود",
  "erp.map.source.itemCode": "رمز الصنف",
  "erp.map.source.manual": "يدوي",
  "erp.map.purpose.stock": "المخزون",
  "erp.map.purpose.returns": "المرتجعات",

  "erp.map.items.title": "ربط الأصناف",
  "erp.map.items.note":
    "يربط كل منتج بصنف واحد في ERPNext. الربط المقترح لا يُستخدم في الترحيل حتى يُؤكَّد.",
  "erp.map.items.loading": "ربط الأصناف",
  "erp.map.items.empty": "لا يوجد ربط أصناف نشط.",
  "erp.map.items.emptySuggested": "لا توجد اقتراحات بانتظار المراجعة.",
  "erp.map.items.emptyConfirmed": "لا يوجد ربط أصناف مؤكَّد.",
  "erp.map.items.filter": "الحالة",
  "erp.map.items.filter.all": "كل الربط النشط",
  "erp.map.items.filter.suggested": "بانتظار المراجعة",
  "erp.map.items.filter.confirmed": "مؤكَّد",
  "erp.map.items.col.product": "معرّف المنتج",
  "erp.map.items.col.item": "صنف ERPNext",
  "erp.map.items.col.state": "الحالة",
  "erp.map.items.col.source": "المصدر",
  "erp.map.items.col.suggestedAt": "اقتُرح في",
  "erp.map.items.col.confirmedAt": "أُكِّد في",
  "erp.map.items.confirm.label": "تأكيد ربط الصنف",
  "erp.map.items.confirm.prompt":
    "تأكيد ربط المنتج {product} بصنف ERPNext {item}؟ سيُستخدم هذا الربط عند الترحيل.",
  "erp.map.items.confirm.action": "تأكيد",
  "erp.map.items.retire.label": "إيقاف ربط الصنف",
  "erp.map.items.retire.prompt":
    "إيقاف ربط المنتج {product} بصنف ERPNext {item}؟ يبقى الربط في السجل، ولن يُستخدم بعد الآن.",
  "erp.map.items.retire.action": "إيقاف",
  "erp.map.items.suggest.label": "اقتراح صنف بديل",
  "erp.map.items.suggest.lead": "أُوقف ربط المنتج {product}. يمكنك اقتراح صنف ERPNext جديد له.",
  "erp.map.items.suggest.ref": "مرجع صنف ERPNext",
  "erp.map.items.suggest.note": "يُسجَّل الاقتراح غير مؤكَّد، ولا يُستخدم في الترحيل حتى يُؤكَّد.",
  "erp.map.items.suggest.prompt": "اقتراح ربط المنتج {product} بصنف ERPNext {item}؟",
  "erp.map.items.suggest.action": "تسجيل الاقتراح",
  "erp.map.items.suggest.dismiss": "ليس الآن",
  "erp.map.items.notice.confirmed": "تم تأكيد الربط.",
  "erp.map.items.notice.retired": "تم إيقاف الربط.",
  "erp.map.items.notice.suggested": "تم تسجيل الاقتراح. لن يُستخدم في الترحيل حتى يُؤكَّد.",

  "erp.map.wh.title": "ربط المستودعات",
  "erp.map.wh.note": "يربط كل متجر بمستودع ERPNext واحد للمخزون.",
  "erp.map.wh.loading": "ربط المستودعات",
  "erp.map.wh.empty": "لا يوجد ربط مستودعات نشط.",
  "erp.map.wh.col.store": "المتجر",
  "erp.map.wh.col.purpose": "الغرض",
  "erp.map.wh.col.warehouse": "مستودع ERPNext",
  "erp.map.wh.col.setAt": "عُيِّن في",
  "erp.map.wh.set.label": "تعيين ربط مستودع",
  "erp.map.wh.set.store": "المتجر",
  "erp.map.wh.set.pickStore": "اختر متجرًا",
  "erp.map.wh.set.ref": "مرجع مستودع ERPNext",
  "erp.map.wh.set.prompt": "ربط المتجر {store} بمستودع ERPNext {warehouse}؟",
  "erp.map.wh.set.action": "تعيين الربط",
  "erp.map.wh.set.storesFailed": "تعذّر تحميل قائمة المتاجر، لذا لا يمكن تعيين ربط الآن.",
  "erp.map.wh.set.allMapped":
    "لكل متاجرك ربط مستودع نشط. لتغيير ربط، أوقفه أولًا ثم عيّن ربطًا جديدًا.",
  "erp.map.wh.retire.label": "إيقاف ربط المستودع",
  "erp.map.wh.retire.prompt":
    "إيقاف ربط المتجر {store} بمستودع ERPNext {warehouse}؟ يبقى الربط في السجل، ولن يُستخدم بعد الآن.",
  "erp.map.wh.retire.action": "إيقاف",
  "erp.map.wh.notice.set": "تم تعيين ربط المستودع.",
  "erp.map.wh.notice.retired": "تم إيقاف ربط المستودع.",
} satisfies Messages;
