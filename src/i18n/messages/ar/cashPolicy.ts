/**
 * RT-389 — سياسة فرق الوردية (AD-CASH-001): القيمة الافتراضية للمؤسسة وتجاوز المتجر.
 * النص العربي هو المرجع، والإنجليزية مطابقة له في المفاتيح.
 */
export const cashPolicy = {
  // --- Sections ------------------------------------------------------------
  "cashPolicy.tenant.title": "سياسة فرق الوردية",
  "cashPolicy.tenant.sub":
    "القيمة الافتراضية لكل متاجر المؤسسة. يمكن لأي متجر أن يكون له تجاوز خاص به.",
  "cashPolicy.store.title": "سياسة فرق الوردية",
  "cashPolicy.store.sub": "السياسة الفعلية التي تتلقاها أجهزة هذا المتجر، وتجاوز المتجر إن وُجد.",
  "cashPolicy.loadingNoun": "السياسة",
  "cashPolicy.unavailable": "سياسة فرق الوردية غير متاحة لك.",
  "cashPolicy.loadFailed": "تعذّر تحميل السياسة.",
  "cashPolicy.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "cashPolicy.retry": "إعادة المحاولة",
  "cashPolicy.refresh": "تحديث",
  "cashPolicy.readOnly": "يمكنك عرض هذه السياسة. التعديل للمالك أو مدير المؤسسة فقط.",

  // --- Values and sources ----------------------------------------------------
  "cashPolicy.value.none": "لا يلزم اعتماد: يقفل الكاشير الوردية بمفرده",
  "cashPolicy.value.limit": "يلزم اعتماد عند تجاوز الفرق {amount}",
  "cashPolicy.source.system": "الافتراضي للنظام",
  "cashPolicy.source.tenant": "افتراضي المؤسسة",
  "cashPolicy.source.store": "تجاوز المتجر",

  // --- Current policy fields -----------------------------------------------------
  "cashPolicy.field.default": "الافتراضي الحالي",
  "cashPolicy.field.effective": "السياسة الفعلية",
  "cashPolicy.field.source": "مصدرها",
  "cashPolicy.field.tenantDefault": "افتراضي المؤسسة",
  "cashPolicy.field.override": "تجاوز المتجر",
  "cashPolicy.field.reason": "السبب",
  "cashPolicy.field.changedAt": "سارية منذ",
  "cashPolicy.field.changedBy": "نُشرت بواسطة",
  "cashPolicy.field.until": "تنتهي في",
  "cashPolicy.field.approvedBy": "اعتمدها المالك",
  "cashPolicy.override.none": "لا يوجد تجاوز. هذا المتجر يتبع افتراضي المؤسسة.",
  "cashPolicy.override.permanent": "دائم",
  "cashPolicy.override.noExpiry": "بلا تاريخ انتهاء",
  "cashPolicy.override.permanentNote":
    "التجاوز الذي لا ينتهي، أو ينتهي بعد أكثر من {days} يومًا من نشره، يكون دائمًا ولا ينشره إلا المالك.",

  // --- Forms ----------------------------------------------------------------------
  "cashPolicy.form.tenantTitle": "تغيير الافتراضي",
  "cashPolicy.form.overrideTitle": "تعيين تجاوز للمتجر",
  "cashPolicy.form.mode": "نوع السياسة",
  "cashPolicy.form.modeNone": "بدون حد: يقفل الكاشير بمفرده دائمًا",
  "cashPolicy.form.modeLimit": "حد: يلزم اعتماد عند تجاوز الفرق للحد",
  "cashPolicy.form.limitAmount": "الحد الأقصى للفرق",
  "cashPolicy.form.limitHint":
    "فرق يساوي الحد يقفله الكاشير بمفرده. الصفر يطلب اعتمادًا عند أي فرق.",
  "cashPolicy.form.currency": "العملة",
  "cashPolicy.form.reason": "السبب",
  "cashPolicy.form.reasonHint": "من 1 إلى 200 حرف. لا تكتب بيانات شخصية.",
  "cashPolicy.form.expiry": "تاريخ الانتهاء (اختياري)",
  "cashPolicy.form.expiryHint": "بتوقيت {zone}. اتركه فارغًا لتجاوز دائم.",
  "cashPolicy.form.applyNow": "تطبيق الآن",
  "cashPolicy.form.applyNowHint":
    "يسري من أول فتح وردية جديدة في كل جهاز. الوردية المفتوحة تحتفظ بقيمتها.",
  "cashPolicy.form.clearTitle": "إزالة التجاوز",
  "cashPolicy.form.clearReason": "سبب الإزالة",
  "cashPolicy.form.clear": "إزالة التجاوز",
  "cashPolicy.form.saved": "تم تطبيق السياسة.",
  "cashPolicy.form.cleared": "تمت إزالة التجاوز.",

  // --- History -----------------------------------------------------------------------
  "cashPolicy.history.title": "سجل المراجعات",
  "cashPolicy.history.caption": "مراجعات سياسة فرق الوردية، الأحدث أولًا",
  "cashPolicy.history.empty": "لا توجد مراجعات بعد.",
  "cashPolicy.history.loadMore": "تحميل المزيد",
  "cashPolicy.history.loadFailed": "تعذّر تحميل سجل المراجعات.",
  "cashPolicy.history.kind.set": "تعيين",
  "cashPolicy.history.kind.clear": "إزالة",
  "cashPolicy.history.state.current": "الحالية",
  "cashPolicy.history.state.superseded": "استُبدلت",
  "cashPolicy.history.state.expired": "انتهت",
  "cashPolicy.history.expiredNote": "انتهى هذا التجاوز ولم يعد ساريًا.",
  "cashPolicy.history.col.when": "التاريخ",
  "cashPolicy.history.col.change": "التغيير",
  "cashPolicy.history.col.value": "القيمة",
  "cashPolicy.history.col.reason": "السبب",
  "cashPolicy.history.col.by": "بواسطة",
  "cashPolicy.history.col.state": "الحالة",
  "cashPolicy.history.noValue": "لا قيمة",

  // --- Errors ------------------------------------------------------------------------
  "cashPolicy.error.reasonRequired": "اكتب سبب التغيير.",
  "cashPolicy.error.reasonTooLong": "السبب أطول من 200 حرف.",
  "cashPolicy.error.amountInvalid": "أدخل مبلغًا صحيحًا بحد أقصى رقمين عشريين، مثل 1250.50.",
  "cashPolicy.error.expiryInvalid": "أدخل تاريخًا ووقتًا صحيحين.",
  "cashPolicy.error.expiryRequiredForAdmin":
    "حدّد تاريخ انتهاء. التجاوز بلا تاريخ انتهاء لا ينشره إلا المالك.",
  "cashPolicy.error.changedConcurrently":
    "تغيّرت السياسة من مستخدم آخر. حدّث الصفحة لرؤية آخر نسخة ثم أعد المحاولة.",
  "cashPolicy.error.keyConflict": "تعذّر تنفيذ الطلب. راجع القيم وأعد المحاولة.",
  "cashPolicy.error.validation": "رفض الخادم هذه القيم. راجعها وأعد المحاولة.",
  "cashPolicy.error.currencyUnsupported": "العملة غير مدعومة. المتاح حاليًا الجنيه المصري فقط.",
  "cashPolicy.error.looserThanTenant": "لا يمكن أن يكون تجاوز المتجر أخف من افتراضي المؤسسة.",
  "cashPolicy.error.expiryNotFuture": "يجب أن يكون تاريخ الانتهاء بعد الوقت الحالي.",
  "cashPolicy.error.notActive": "لا يوجد تجاوز ساري لإزالته.",
  "cashPolicy.error.ownerApprovalRequired":
    "التجاوز الدائم لا ينشره إلا المالك. اطلب من المالك نشره، أو حدّد تاريخ انتهاء أقرب.",
  "cashPolicy.error.originRejected": "رُفض الطلب لأن مصدره غير مسموح به. أعد تحميل الصفحة.",
  "cashPolicy.error.forbidden": "ليست لديك صلاحية تغيير هذه السياسة.",
  "cashPolicy.error.unavailable": "سياسة فرق الوردية غير متاحة لك.",
  "cashPolicy.error.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "cashPolicy.error.inProgress": "الطلب السابق ما زال قيد المعالجة. أعد المحاولة بعد لحظات.",
  "cashPolicy.error.generic": "تعذّر تنفيذ الطلب. أعد المحاولة.",
} as const;
