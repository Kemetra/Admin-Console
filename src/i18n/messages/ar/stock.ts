import type { Messages } from "../types";

/**
 * Arabic copy for the stock surfaces: ERPNext stock discrepancies (RT-178,
 * `stock.*`) and the unknown-items review queue (RF-4a, `unknownItems.*`).
 *
 * A snapshot is a point-in-time ERPNext read («لقطة»): no copy here calls it
 * live or current (RT-178 AC7). A store with no snapshot reads «غير معروف»,
 * never zero and never "no discrepancies" (AC2). ERPNext DocType names in the
 * Desk guidance are given in Arabic between «» (RT-399: no Latin besides the
 * UX-12 machine terms); they are PROVISIONAL until checked against the
 * Arabic labels of the deployed ERPNext.
 */
export const stock = {
  // --- Stock discrepancies: shared ----------------------------------------
  "stock.title": "فروقات مخزون ERPNext",
  "stock.tenantPrompt": "اختر مؤسسة لعرض فروقات مخزون ERPNext.",
  "stock.loadFailed": "تعذّر تحميل فروقات مخزون ERPNext.",
  "stock.inlineError": "تعذّر تحميل بعض الصفوف. الصفوف المعروضة من آخر تحميل ناجح.",
  "stock.retry": "إعادة المحاولة",

  // Snapshot status (badge labels). Both no-snapshot states share one label.
  "stock.status.fresh": "لقطة حديثة",
  "stock.status.stale": "لقطة متقادمة",
  "stock.status.none": "لا توجد لقطة من ERPNext",
  "stock.noSnapshotReason.notRecorded": "لم تُسجَّل بعد",
  "stock.noSnapshotReason.noMapping": "لا يوجد ربط بمستودع",
  "stock.notice.noSnapshot":
    "لم تُسجَّل أي لقطة من ERPNext لهذا المتجر بعد، لذا فإن مخزونه في ERPNext غير معروف. وهذا لا يعني عدم وجود فروقات.",
  "stock.notice.noMapping":
    "لا توجد لقطة من ERPNext: ليس لهذا المتجر ربط بمستودع مخزون في ERPNext، لذا فإن مخزونه في ERPNext غير معروف. وهذا لا يعني عدم وجود فروقات.",
  "stock.notice.stale":
    "لقطة ERPNext هذه أقدم من {age}. الأصناف أدناه مأخوذة من تلك اللقطة وقد لا تطابق ERPNext بعد الآن. اطلب لقطة حديثة لإعادة القراءة من ERPNext.",

  // --- Store summary list -------------------------------------------------
  "stock.stores.sub":
    "الأصناف ذات الرصيد السالب في أحدث لقطة ERPNext مسجّلة لكل متجر. للعرض فقط؛ عالج السبب في واجهة ERPNext.",
  "stock.stores.notFound": "غير موجود. فروقات مخزون ERPNext غير متاحة لك في هذه المؤسسة.",
  "stock.stores.caption": "المتاجر",
  "stock.stores.col.store": "المتجر",
  "stock.stores.col.snapshot": "لقطة ERPNext",
  "stock.stores.col.asOf": "بتاريخ",
  "stock.stores.col.negativeItems": "الأصناف السالبة",
  "stock.stores.col.request": "طلب اللقطة",
  // The count cell: a bare number (Western digits, grouped) when a snapshot
  // exists; «غير معروف» when it does not — never 0.
  "stock.stores.count": "{count}",
  "stock.stores.countUnknown": "غير معروف",
  "stock.stores.pending": "طُلبت، بانتظار Connector",
  "stock.stores.noPending": "لا يوجد",
  "stock.stores.loadingNoun": "المتاجر",
  "stock.stores.empty": "لا توجد متاجر متاحة لك في هذه المؤسسة.",
  "stock.stores.loadMore": "تحميل مزيد من المتاجر",

  // --- One store's negative items ------------------------------------------
  "stock.store.back": "العودة إلى المتاجر",
  "stock.store.sub": "الأصناف التي تقل كميتها عن الصفر في أحدث لقطة ERPNext مسجّلة لهذا المتجر.",
  "stock.store.notFoundTitle": "المتجر غير موجود",
  "stock.store.notFound": "غير موجود. هذا المتجر غير موجود أو غير متاح لك.",
  "stock.store.loadingNoun": "لقطة ERPNext",
  "stock.store.snapshotChanged":
    "تغيّرت اللقطة وأُعيد التحميل. سُجّلت لقطة أحدث من ERPNext أثناء التنقل بين الصفحات، لذا أُعيد تحميل القائمة من صفحتها الأولى.",
  "stock.store.loadMore": "تحميل مزيد من الأصناف",

  "stock.items.caption": "الأصناف دون الصفر في ERPNext",
  "stock.items.col.product": "الصنف",
  "stock.items.col.erpnextItem": "صنف ERPNext",
  "stock.items.col.warehouse": "المستودع",
  "stock.items.col.quantity": "الكمية",
  "stock.items.col.uom": "وحدة قياس المخزون",
  "stock.items.notMapped": "غير مربوط",
  "stock.items.notMappedTitle": "غير مربوط بصنف في Retail Tower",
  "stock.items.empty": "لا توجد أصناف دون الصفر في لقطة ERPNext هذه.",

  // Refresh ("Request fresh snapshot", owner / tenant_admin only).
  "stock.refresh.action": "طلب لقطة حديثة",
  "stock.refresh.requesting": "جارٍ الطلب…",
  "stock.refresh.blocked.noMapping": "اربط أولًا مستودع مخزون في ERPNext بهذا المتجر.",
  "stock.refresh.blocked.pending": "يوجد طلب لقطة قيد الانتظار بالفعل.",
  "stock.refresh.outcome.notFound": "غير موجود. لا يمكن طلب لقطة لهذا المتجر.",
  "stock.refresh.outcome.keyConflict": "تعارض طلب اللقطة هذا مع طلب سابق. حاول مرة أخرى.",
  "stock.refresh.outcome.error": "تعذّر إرسال طلب اللقطة. حاول مرة أخرى.",

  // Snapshot panel.
  "stock.panel.label": "لقطة ERPNext",
  "stock.panel.asOf": "لقطة ERPNext بتاريخ {time}",
  "stock.panel.noSnapshot": "لا توجد لقطة من ERPNext",
  "stock.panel.warehouse": "مستودع ERPNext",
  "stock.panel.recordedAt": "تاريخ التسجيل في Retail Tower",
  "stock.panel.entryCount": "سجلات أرصدة ERPNext في اللقطة",
  "stock.pending.badge": "طُلبت لقطة، بانتظار Connector",
  "stock.pending.requestedAt": "طُلبت في {time}.",
  "stock.pending.overdue":
    "طُلبت اللقطة ولكن لم يُبلَّغ عنها بعد. قد يكون ERPNext Connector غير متصل، أو قد يضم المستودع أكثر من 500 صنف، وهو ما لا يبلّغ عنه Connector بعد.",
  "stock.pending.overdueWithPrevious":
    "طُلبت اللقطة ولكن لم يُبلَّغ عنها بعد. قد يكون ERPNext Connector غير متصل، أو قد يضم المستودع أكثر من 500 صنف، وهو ما لا يبلّغ عنه Connector بعد. لا تزال اللقطة السابقة معروضة.",

  // Static ERPNext Desk guidance.
  "stock.desk.label": "المعالجة في واجهة ERPNext",
  "stock.desk.title": "معالجة كمية سالبة في واجهة ERPNext",
  "stock.desk.receipt":
    "رحّل «إيصال استلام المشتريات» الناقص، أو «قيد مخزون» (استلام مواد أو نقل مواد)، للصنف والمستودع.",
  "stock.desk.count": "أو سجّل جردًا فعليًا عبر «تسوية مخزون».",
  "stock.desk.noBlindEntry": "لا ترحّل قيد موازنة دون تحقق؛ ابحث أولًا عن المستند الناقص.",
  "stock.desk.note":
    "لا تُنشئ Retail Tower أي مستندات مخزون. لا يختفي الصف إلا عندما تُظهر لقطة لاحقة من ERPNext الصنف عند الصفر أو أكثر.",

  // --- Unknown items review queue (RF-4a) -----------------------------------
  "unknownItems.title": "أصناف غير معروفة",
  "unknownItems.sub": "مراجع أصناف من POS بانتظار المراجعة في هذه المؤسسة.",
  "unknownItems.filters.legend": "عوامل تصفية القائمة",
  "unknownItems.filters.source": "نظام المصدر",
  "unknownItems.filters.sourcePlaceholder": "كل المصادر",
  "unknownItems.filters.sort": "الترتيب",
  "unknownItems.sort.newest": "الأحدث أولًا",
  "unknownItems.sort.oldest": "الأقدم أولًا",
  "unknownItems.sort.store": "حسب المتجر",
  "unknownItems.filters.groupBy": "التجميع حسب",
  "unknownItems.group.none": "بلا تجميع",
  "unknownItems.group.store": "المتجر",
  "unknownItems.group.source": "نظام المصدر",
  "unknownItems.retry": "إعادة المحاولة",
  "unknownItems.loadingNoun": "الأصناف غير المعروفة",
  "unknownItems.empty": "لا توجد أصناف غير معروفة للمراجعة.",
  "unknownItems.caption": "أصناف غير معروفة",
  "unknownItems.col.identifier": "المعرّف",
  "unknownItems.col.type": "النوع",
  "unknownItems.col.store": "المتجر",
  "unknownItems.col.source": "نظام المصدر",
  "unknownItems.col.encountered": "وقت الرصد",

  // Identifier type / status / resolution action (contract enums; never raw).
  "unknownItems.identifierType.barcode": "باركود",
  "unknownItems.identifierType.sku": "SKU",
  "unknownItems.identifierType.plu": "رمز البحث عن السعر",
  "unknownItems.identifierType.supplier_code": "رمز المورّد",
  "unknownItems.identifierType.external_pos_id": "معرّف POS خارجي",
  "unknownItems.status.pending": "بانتظار المراجعة",
  "unknownItems.status.resolved": "تمت المعالجة",
  "unknownItems.status.dismissed": "مستبعد",
  "unknownItems.action.linked": "مربوط بصنف",
  "unknownItems.action.created": "أُنشئ له صنف",
  "unknownItems.action.dismissed": "مستبعد",

  // Inspect drawer.
  "unknownItems.drawer.title": "صنف غير معروف",
  "unknownItems.drawer.loadingNoun": "الصنف",
  "unknownItems.field.identifier": "المعرّف",
  "unknownItems.field.identifierType": "نوع المعرّف",
  "unknownItems.field.source": "نظام المصدر",
  "unknownItems.field.store": "المتجر",
  "unknownItems.field.status": "الحالة",
  "unknownItems.field.resolutionAction": "إجراء المعالجة",
  "unknownItems.field.encounteredAt": "وقت الرصد",
  "unknownItems.field.resolvedAt": "وقت المعالجة",
  "unknownItems.field.resolvedBy": "تمت المعالجة بواسطة",

  // Dismiss confirm.
  "unknownItems.dismiss.action": "استبعاد",
  "unknownItems.dismiss.resource": "{type} {value}",

  // Error copy (mapUnknownItemError). 5xx and bad-request reuse errors.*.
  "unknownItems.errors.forbidden": "ليست لديك صلاحية لمراجعة الأصناف غير المعروفة في هذا النطاق.",
  "unknownItems.errors.notFound": "هذا الصنف غير متاح.",
  "unknownItems.errors.alreadyReconciled":
    "تمت معالجة هذا الصنف مسبقًا. حدّث الصفحة لعرض حالته الحالية.",
  // RT-724 (RF-4b): queue status filter, create product, reopen, bulk dismiss.
  "unknownItems.filters.status": "الحالة",
  "unknownItems.emptyStatus": "لا توجد أصناف بهذه الحالة.",
  "unknownItems.create.action": "إنشاء صنف",
  "unknownItems.create.legend": "صنف جديد من هذا المعرّف",
  "unknownItems.create.name": "اسم الصنف",
  "unknownItems.create.taxCategory": "فئة الضريبة",
  "unknownItems.create.taxCategoryHint": "رمز فئة الضريبة التي ينتمي إليها الصنف.",
  "unknownItems.create.submit": "إنشاء الصنف",
  "unknownItems.create.nameRequired": "أدخل اسم الصنف.",
  "unknownItems.create.taxCategoryRequired": "أدخل فئة الضريبة.",
  "unknownItems.create.success": "تم إنشاء الصنف وربط المعرّف به. لم يعد الصنف في قائمة المراجعة.",
  "unknownItems.reopen.action": "إعادة فتح",
  "unknownItems.reopen.success": "أُعيد فتح الصنف وعاد إلى قائمة المراجعة.",
  "unknownItems.bulk.action": "استبعاد المحدد",
  "unknownItems.bulk.resource": {
    zero: "لا أصناف",
    one: "صنف واحد",
    two: "صنفين",
    few: "{count} أصناف",
    many: "{count} صنفًا",
    other: "{count} صنف",
  },
  "unknownItems.bulk.overLimit":
    "يمكن استبعاد {max} صنف كحد أقصى في المرة الواحدة. قلّل التحديد ثم حاول مرة أخرى.",
  "unknownItems.bulk.result.dismissed": {
    zero: "لم يُستبعد أي صنف.",
    one: "تم استبعاد صنف واحد.",
    two: "تم استبعاد صنفين.",
    few: "تم استبعاد {count} أصناف.",
    many: "تم استبعاد {count} صنفًا.",
    other: "تم استبعاد {count} صنف.",
  },
  "unknownItems.bulk.result.alreadyReconciled": {
    zero: "لا أصناف تمت معالجتها من قبل.",
    one: "صنف واحد تمت معالجته من قبل فلم يُستبعد.",
    two: "صنفان تمت معالجتهما من قبل فلم يُستبعدا.",
    few: "{count} أصناف تمت معالجتها من قبل فلم تُستبعد.",
    many: "{count} صنفًا تمت معالجتها من قبل فلم تُستبعد.",
    other: "{count} صنف تمت معالجته من قبل فلم يُستبعد.",
  },
  "unknownItems.bulk.result.notFound": {
    zero: "لا أصناف غير متاحة.",
    one: "صنف واحد لم يعد متاحًا فلم يُستبعد.",
    two: "صنفان لم يعودا متاحين فلم يُستبعدا.",
    few: "{count} أصناف لم تعد متاحة فلم تُستبعد.",
    many: "{count} صنفًا لم تعد متاحة فلم تُستبعد.",
    other: "{count} صنف لم يعد متاحًا فلم يُستبعد.",
  },
  "unknownItems.errors.reopenForbidden":
    "إعادة الفتح تتطلب صلاحية على مستوى المؤسسة كلها. اطلب ذلك من مسؤول المؤسسة.",
  "unknownItems.errors.reopenResolved":
    "تمت معالجة هذا الصنف، ولا يُعاد فتح إلا صنف مستبعد. حدّث القائمة لرؤية حالته الحالية.",
  "unknownItems.errors.createValidation":
    "تعذّر إنشاء الصنف بهذه البيانات. راجع اسم الصنف وفئة الضريبة ثم حاول مرة أخرى.",
  "unknownItems.errors.bulkRejected":
    "رُفض الطلب كاملًا ولم يُستبعد أي صنف. حدّد {max} صنف كحد أقصى ثم حاول مرة أخرى.",
  "unknownItems.errors.aliasConflict":
    "هذا المعرّف مرتبط بالفعل بصنف آخر، فلم يُنشأ أي صنف. راجع الكتالوج قبل المتابعة.",
  "unknownItems.errors.targetUnavailable": "الصنف المطلوب لم يعد متاحًا، فلم يتغير شيء.",
  "unknownItems.errors.keyConflict":
    "تعارض هذا الطلب مع محاولة سابقة، فلم يتغير شيء. حدّث القائمة ثم حاول مرة أخرى.",
  "unknownItems.errors.rateLimited":
    "طلبات كثيرة جدًا في وقت قصير، فلم يتغير شيء. انتظر لحظة ثم حاول مرة أخرى.",
  "unknownItems.errors.inProgress":
    "لا يزال الطلب السابق قيد المعالجة. انتظر لحظة ثم حاول مرة أخرى.",

  // RT-767: ربط صنف معلّق بصنف موجود يُختار من المنتقي المشترك.
  "unknownItems.link.action": "ربط بصنف",
  "unknownItems.link.legend": "ربط هذا المعرّف بصنف",
  "unknownItems.link.lead":
    "اختر الصنف الموجود الذي يعود إليه هذا المعرّف. لا يتغير شيء قبل التأكيد.",
  "unknownItems.link.confirm.label": "تأكيد الربط",
  "unknownItems.link.confirm.prompt":
    "ربط المعرّف {identifier} بالصنف {product}؟ سيغادر الصنف قائمة المراجعة.",
  "unknownItems.link.confirm.action": "ربط المعرّف",
  "unknownItems.link.change": "اختيار صنف آخر",
  "unknownItems.link.success": "تم ربط المعرّف بالصنف. لم يعد الصنف في قائمة المراجعة.",
  "unknownItems.link.alreadyResolved":
    "حسم شخص آخر هذا الصنف أثناء اختيارك، فلم يتم الربط. التفاصيل أدناه محدّثة.",
  "unknownItems.errors.linkValidation":
    "تعذّر ربط المعرّف بهذا الصنف. اختر الصنف مرة أخرى ثم حاول من جديد.",
  "unknownItems.errors.linkAliasConflict":
    "هذا المعرّف مرتبط بالفعل بصنف آخر، فلم يتم الربط. راجع الكتالوج قبل المتابعة.",
  "unknownItems.errors.originRejected":
    "رفض الخادم تغييرًا من هذه الصفحة، فلم يتغير شيء. أعد تحميل وحدة الإدارة ثم حاول مرة أخرى.",
} satisfies Messages;
