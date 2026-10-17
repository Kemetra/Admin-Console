import type { Messages } from "../types";

/**
 * Arabic copy for the device registry (RT-371). Read-only.
 *
 * Glossary (shared with POS RT-215): Device → «الجهاز»; Revoke → «إيقاف
 * الصلاحية» (a revoked device is «موقوف الصلاحية»); Retired → «خارج الخدمة»;
 * Pairing → «الربط»; Credential expiry → «انتهاء الاعتماد»; Last seen →
 * «آخر نشاط»; Custody exception → «استثناء عهدة». No copy says or implies that
 * a device is healthy (RT-287 D-Q6): unknown stays «غير معروف».
 */
export const devices = {
  // --- Navigation ------------------------------------------------------------
  "devices.nav.section": "نقاط البيع",
  "devices.nav.label": "الأجهزة",

  // --- List ------------------------------------------------------------------
  "devices.list.title": "الأجهزة",
  "devices.list.sub": "أجهزة نقاط البيع المربوطة في {tenant}.",
  "devices.list.orderNote":
    "الترتيب من الخادم: استثناءات العهدة أولًا، ثم الأجهزة الفعّالة الأقرب انتهاءً، ثم الموقوفة. الأجهزة التي خارج الخدمة مخفية افتراضيًا؛ اختر حالة «خارج الخدمة» لعرضها.",
  "devices.list.staleNote": "لا يمكن ترتيب الأجهزة حسب آخر نشاط بعد، لأن الخادم لا يسجّله حتى الآن.",
  "devices.list.scopePrompt": "اختر مؤسسة لعرض الأجهزة.",
  "devices.list.caption": "أجهزة نقاط البيع، الاستثناءات أولًا",
  "devices.list.loadingNoun": "الأجهزة",
  "devices.list.empty": "لا توجد أجهزة مربوطة.",
  "devices.list.emptyHint": "يظهر الجهاز هنا بعد ربطه بمتجر برمز ربط.",
  "devices.list.emptyFiltered": "لا توجد أجهزة تطابق هذه التصفية.",
  "devices.list.emptyFilteredHint": "غيّر التصفية أو امسحها لعرض بقية الأجهزة.",
  "devices.list.unavailable": "الأجهزة غير متاحة لك.",
  "devices.list.storeUnavailable": "أجهزة هذا المتجر غير متاحة لك.",
  "devices.list.storeUnavailableHint": "اختر متجرًا آخر أو امسح التصفية.",
  "devices.list.filterRejected": "رفض الخادم هذه التصفية. راجع القيم ثم حاول مرة أخرى.",
  "devices.list.loadFailed": "تعذّر تحميل الأجهزة.",
  "devices.list.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "devices.list.inlineError": "تعذّر تحميل بقية الصفوف. الصفوف المعروضة من آخر تحميل ناجح.",
  "devices.list.clearFilters": "مسح التصفية",
  "devices.list.retry": "إعادة المحاولة",
  "devices.list.loaded": "المحمّل: {count}",
  "devices.list.loadMore": "تحميل المزيد",
  "devices.list.col.device": "الجهاز",
  "devices.list.col.store": "المتجر",
  "devices.list.col.trust": "حالة الصلاحية",
  "devices.list.col.attention": "يحتاج انتباهًا",
  "devices.list.col.expires": "انتهاء الاعتماد",
  "devices.list.col.lastSeen": "آخر نشاط",
  "devices.list.unknownStore": "متجر غير معروف",
  "devices.list.unlabelled": "بلا اسم",
  "devices.list.noAttention": "لا يوجد استثناء مسجّل",

  // --- Attention ---------------------------------------------------------------
  "devices.attention.custody": "استثناء عهدة: وردية مفتوحة",
  "devices.attention.pastExpiry": "انتهى الاعتماد (لا يُطبَّق بعد)",

  // --- Filters -----------------------------------------------------------------
  "devices.filter.label": "تصفية الأجهزة",
  "devices.filter.store": "المتجر",
  "devices.filter.allStores": "كل المتاجر",
  "devices.filter.unlistedStore": "متجر غير موجود في قائمتك",
  "devices.filter.trust": "حالة الصلاحية",
  "devices.filter.trustAny": "فعّالة وموقوفة (الافتراضي)",
  "devices.filter.apply": "تطبيق",
  "devices.filter.clear": "مسح",

  // --- Trust state -------------------------------------------------------------
  "devices.trust.active": "فعّال",
  "devices.trust.revoked": "موقوف الصلاحية",
  "devices.trust.retired": "خارج الخدمة",
  "devices.trust.unknown": "حالة غير معروفة",

  // --- Revoke reason -----------------------------------------------------------
  "devices.reason.lost": "مفقود",
  "devices.reason.stolen": "مسروق",
  "devices.reason.suspected_compromise": "اشتباه في اختراق",
  "devices.reason.hardware_failure": "عطل في الجهاز",
  "devices.reason.replaced": "استُبدل بجهاز آخر",
  "devices.reason.moved": "نُقل إلى متجر آخر",
  "devices.reason.retired": "أُخرج من الخدمة",
  "devices.reason.admin_error": "خطأ إداري",
  "devices.reason.other": "سبب آخر",
  "devices.reason.notRecorded": "لم يُسجَّل سبب",
  "devices.reason.unknown": "سبب غير معروف",

  // --- Last seen ---------------------------------------------------------------
  "devices.lastSeen.unknown": "غير معروف",
  "devices.lastSeen.source.activity": "آخر طلب موثَّق من الجهاز",
  "devices.lastSeen.source.unknown": "مصدر غير معروف",
  "devices.lastSeen.notHealth": "آخر نشاط لا يعني أن الجهاز سليم. لا يُبلَّغ عن سلامة الأجهزة بعد.",

  // --- Detail ------------------------------------------------------------------
  "devices.detail.back": "العودة إلى الأجهزة",
  "devices.detail.loadingNoun": "الجهاز",
  "devices.detail.notFound": "هذا الجهاز غير متاح.",
  "devices.detail.loadFailed": "تعذّر تحميل هذا الجهاز.",
  "devices.detail.retry": "إعادة المحاولة",
  "devices.detail.zoneNote": "الأوقات بتوقيت {zone}.",
  "devices.detail.unlabelledTitle": "جهاز بلا اسم",
  "devices.detail.tabs": "أقسام الجهاز",
  "devices.detail.tab.overview": "نظرة عامة",
  "devices.detail.tab.history": "السجل",

  "devices.custody.title": "استثناء عهدة مفتوح",
  "devices.custody.body":
    "أُوقفت صلاحية هذا الجهاز بينما كانت الوردية {shift} مفتوحة عليه. تبقى الوردية مفتوحة على هذا الجهاز حتى تُقفل وتُزامَن، ولا تنتقل إلى جهاز آخر.",

  "devices.field.deviceId": "معرّف الجهاز",
  "devices.field.label": "الاسم",
  "devices.field.store": "المتجر",
  "devices.field.trust": "حالة الصلاحية",
  "devices.field.pairedAt": "وقت الربط",
  "devices.field.expiresAt": "انتهاء الاعتماد",
  "devices.field.expiryNote": "يُعرض تاريخ الانتهاء ولا يُطبَّق بعد: الجهاز يبقى فعّالًا بعده.",
  "devices.field.lastSeen": "آخر نشاط",
  "devices.field.lastSeenSource": "مصدر آخر نشاط",

  // --- History -------------------------------------------------------------------
  "devices.history.events": "الأحداث",
  "devices.history.paired": "رُبط الجهاز",
  "devices.history.revoked": "أُوقفت الصلاحية",
  "devices.history.retired": "أُخرج من الخدمة",
  "devices.history.by": "بواسطة",
  "devices.history.actorNotRecorded": "لم يُسجَّل",
  "devices.history.reason": "السبب",
  "devices.history.note": "الملاحظة",
  "devices.history.noRevoke": "لم تُوقف صلاحية هذا الجهاز.",
  "devices.history.chain": "سلسلة الاستبدال",
  "devices.history.replaces": "يحلّ محل",
  "devices.history.replacedBy": "حلّ محله",
  "devices.history.noLink": "لا يوجد، أو الجهاز في متجر خارج صلاحيتك.",

  // --- Lifecycle actions (RT-372) -------------------------------------------------
  // Glossary: Revoke → «إيقاف الصلاحية»; Retire → «إخراج من الخدمة»; Replace →
  // «استبدال»; Move → «نقل»; Pairing code → «رمز ربط»; Shift → «وردية».
  "devices.actions.label": "إجراءات دورة حياة الجهاز",
  "devices.actions.hint": "كل إجراء منفصل، ويعرض ما يقوله الخادم عن أثره قبل أن تؤكّده.",
  "devices.actions.revoke": "إيقاف الصلاحية",
  "devices.actions.retire": "إخراج من الخدمة",
  "devices.actions.closed": "هذا الجهاز خارج الخدمة. لا توجد إجراءات أخرى عليه.",

  "devices.flow.review": "مراجعة الأثر",
  "devices.flow.back": "رجوع",
  "devices.flow.done": "تم",
  "devices.flow.checking": "جارٍ سؤال الخادم عمّا سيحدث…",
  "devices.flow.error.notFound": "هذا الجهاز لم يعد متاحًا لك.",
  "devices.flow.error.generic":
    "تعذّر على الخادم إكمال الإجراء. راجع حالة الجهاز قبل أن تحاول مرة أخرى.",
  "devices.flow.error.session": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "devices.flow.error.validation": "رفض الخادم قيمة. راجع الحقول ثم حاول مرة أخرى.",
  "devices.flow.error.unmetNote": "يحتاج الخادم إلى ملاحظة لهذا الإيقاف: ماذا حدث وأين نقد الدرج.",
  "devices.flow.error.unmetAcknowledge":
    "يحتاج الخادم إلى تأكيدك أن الوردية تبقى استثناء عهدة غير محلول.",
  "devices.flow.error.changed": "تغيّر الوضع بعد المعاينة. إجابة الخادم المحدّثة معروضة أدناه.",
  "devices.flow.error.unknownRefusal":
    "رفض الخادم الإجراء بسبب لا تعرفه هذه اللوحة. لا يُعرض أي إجراء.",
  "devices.text.required": "هذا الحقل مطلوب.",
  "devices.text.tooLong": "استخدم 500 حرف على الأكثر.",
  "devices.text.invalid": "يحتوي النص على حرف غير مسموح به.",

  // --- Impact (the server's answer, rendered) ---------------------------------------
  "devices.impact.title": "ما يقوله الخادم عمّا سيحدث",
  "devices.impact.loadFailed": "تعذّر الحصول على الأثر من الخادم.",
  "devices.impact.retry": "إعادة المحاولة",
  "devices.impact.snapshot": "حتى {time}. هذه لقطة لا حجز: يقرّر الخادم مرة أخرى عند التأكيد.",
  "devices.impact.verdict.allowed": "مسموح به من الخادم.",
  "devices.impact.verdict.allowedCustody":
    "مسموح به مع استثناء عهدة. تبقى الوردية المفتوحة على هذا الجهاز استثناءً غير محلول: لا تُقفل ولا تُعدّ ولا تنتقل.",
  "devices.impact.verdict.forbidden":
    "غير متاح لدورك. إيقاف الصلاحية للاسترداد (عطل في الجهاز مع وردية مفتوحة) لا يقوم به إلا المالك أو مسؤول المؤسسة. اطلب من أحدهما تنفيذه.",
  "devices.impact.verdict.noChange": "لن يتغيّر شيء: حدث هذا من قبل.",
  "devices.impact.blocked.cashSession":
    "محظور: على هذا الجهاز وردية مفتوحة. أقفل الوردية على الجهاز واترك المزامنة تكتمل، ثم حاول مرة أخرى. إن كان الجهاز مفقودًا فأوقف صلاحيته أولًا بسبب أمني. لا يوجد تجاوز.",
  "devices.impact.blocked.custodyException":
    "محظور: لهذا الجهاز الموقوف وردية ما زالت مفتوحة (استثناء عهدة غير محلول). لا يمكن إخراجه من الخدمة قبل حلّ ذلك. لا يوجد تجاوز.",
  "devices.impact.blocked.retired": "محظور: هذا الجهاز خارج الخدمة.",
  "devices.impact.blocked.unknown":
    "محظور: رفض الخادم هذا الإجراء بسبب لا تعرفه هذه اللوحة. لا يُعرض أي إجراء.",
  "devices.impact.field.state": "حالة الصلاحية الآن",
  "devices.impact.field.openShift": "الوردية المفتوحة",
  "devices.impact.openShift.none": "لا توجد",
  "devices.impact.openShift.line": "فُتحت {time} ({source})",
  "devices.impact.source.cash_up": "تقفيل النقد",
  "devices.impact.source.legacy": "قديمة",
  "devices.impact.field.cashFacts": "وقائع النقد",
  "devices.impact.cashFacts.value": {
    zero: "استلم الخادم {count} واقعة، آخرها {time}",
    one: "استلم الخادم واقعة واحدة، آخرها {time}",
    two: "استلم الخادم واقعتين، آخرها {time}",
    few: "استلم الخادم {count} وقائع، آخرها {time}",
    many: "استلم الخادم {count} واقعة، آخرها {time}",
    other: "استلم الخادم {count} واقعة، آخرها {time}",
  },
  "devices.impact.cashFacts.note": "ما استلمه الخادم فقط. ما لم يُزامنه الجهاز بعد لا يُحتسب.",
  "devices.impact.cashFacts.unknown":
    "غير معروف: الوردية القديمة لا تحمل وقائع تقفيل نقد مستلمة (وليس صفرًا).",
  "devices.impact.field.custody": "استثناء العهدة الآن",
  "devices.impact.custody.none": "لا يوجد",
  "devices.impact.custody.shift": "الوردية {shift} مفتوحة على هذا الجهاز",
  "devices.impact.field.sessions": "جلسات المشغّلين التي ستنتهي",
  "devices.impact.field.codes": "رموز الربط المعلّقة التي ستُلغى",
  "devices.impact.cascade.none": "لا ينطبق: صلاحية الجهاز موقوفة أصلًا.",

  // --- Revoke ---------------------------------------------------------------------
  "devices.revoke.title": "إيقاف صلاحية الجهاز",
  "devices.revoke.intro": "إيقاف الصلاحية يُنهي اعتماد هذا الجهاز نهائيًا. لا يوجد تراجع عنه.",
  "devices.revoke.group.security": "أحداث أمنية",
  "devices.revoke.group.securityHelp":
    "للأحداث الأمنية الحقيقية فقط: جهاز مفقود أو مسروق أو يُشتبه في اختراقه. ليست حلًّا بديلًا حين يُحظر سبب آخر.",
  "devices.revoke.group.other": "أسباب أخرى",
  "devices.revoke.reasonRequired": "اختر سببًا.",
  "devices.revoke.reasonLegend": "سبب إيقاف الصلاحية",
  "devices.revoke.note": "الملاحظة",
  "devices.revoke.noteHelp": "اختيارية. بلا بيانات شخصية أو رقم سري.",
  "devices.revoke.noteHelpRequired": "مطلوبة. بلا بيانات شخصية أو رقم سري.",
  "devices.revoke.noteRecovery": "ماذا حدث، وأين نقد الدرج؟",
  "devices.revoke.acknowledge":
    "أفهم أن الوردية المفتوحة تبقى استثناء عهدة غير محلول على هذا الجهاز.",
  "devices.revoke.acknowledgeRequired": "أكّد أنك تفهم ذلك قبل إيقاف الصلاحية.",
  "devices.revoke.confirm": "إيقاف صلاحية الجهاز",
  "devices.revoke.done": "أُوقفت صلاحية الجهاز.",
  "devices.revoke.alreadyRevoked": "صلاحية هذا الجهاز موقوفة أصلًا. لم يتغيّر شيء.",

  // --- Retire ---------------------------------------------------------------------
  "devices.retire.title": "إخراج الجهاز من الخدمة",
  "devices.retire.intro":
    "الإخراج من الخدمة يُغلق الجهاز نهائيًا: لا يُربط ولا يُستبدل ولا يُنقل بعد ذلك. يبقى سجلّه كما هو. لا يوجد تراجع عنه.",
  "devices.retire.reason": "لماذا يخرج هذا الجهاز من الخدمة؟",
  "devices.retire.reasonHelp": "مثلًا: انتهى عمره، أُعيد إلى المورّد. بلا بيانات شخصية أو رقم سري.",
  "devices.retire.confirm": "إخراج الجهاز من الخدمة",
  "devices.retire.done": "أُخرج الجهاز من الخدمة.",
  "devices.retire.alreadyRetired": "هذا الجهاز خارج الخدمة أصلًا. لم يتغيّر شيء.",
  "devices.retire.checkingCodes": "جارٍ التحقق من رموز الربط المعلّقة…",
  "devices.retire.codesLoadFailed":
    "تعذّر التحقق من رموز الربط المعلّقة. حاول مرة أخرى قبل الإخراج من الخدمة.",
  "devices.retire.pendingCodes": {
    zero: "هناك {count} رمز ربط حيّ لاستبدال هذا الجهاز أو نقله. الإخراج من الخدمة يُلغيها، ولا يمكن بعدها استبدال هذا الجهاز أو نقله.",
    one: "هناك رمز ربط حيّ واحد لاستبدال هذا الجهاز أو نقله. الإخراج من الخدمة يُلغيه، ولا يمكن بعدها استبدال هذا الجهاز أو نقله.",
    two: "هناك رمزا ربط حيّان لاستبدال هذا الجهاز أو نقله. الإخراج من الخدمة يُلغيهما، ولا يمكن بعدها استبدال هذا الجهاز أو نقله.",
    few: "هناك {count} رموز ربط حيّة لاستبدال هذا الجهاز أو نقله. الإخراج من الخدمة يُلغيها، ولا يمكن بعدها استبدال هذا الجهاز أو نقله.",
    many: "هناك {count} رمز ربط حيّ لاستبدال هذا الجهاز أو نقله. الإخراج من الخدمة يُلغيها، ولا يمكن بعدها استبدال هذا الجهاز أو نقله.",
    other:
      "هناك {count} رمز ربط حيّ لاستبدال هذا الجهاز أو نقله. الإخراج من الخدمة يُلغيها، ولا يمكن بعدها استبدال هذا الجهاز أو نقله.",
  },
  "devices.retire.pendingCodesHelp": "اربط الجهاز الجديد أولًا، أو أكّد أدناه.",
  "devices.retire.pendingCodesConfirm": "أخرجه من الخدمة وألغِ رموز الاستبدال",
  "devices.retire.pendingCodesRequired": "أكّد إلغاء رموز الاستبدال قبل المتابعة.",
} satisfies Messages;
