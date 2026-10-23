/**
 * Arabic copy for the shared KPI claim and the console metric registry (RT-819,
 * RT-751 slice 2). Each definition restates the Backend-Core contract
 * (`console-sales-summary.openapi.yaml`) in words and never redefines it.
 * «غير معروف» is a word, never a zero; a zero is a real zero.
 */
export const metrics = {
  // --- Figures (registry) ------------------------------------------------------
  "metrics.receivedSales.label": "المبيعات المستلمة",
  "metrics.receivedSales.definition":
    "عدد المبيعات التي استلمها الخادم وإجماليها لكل عملة على حدة، حسب يوم العمل المحلي للمتجر وقت تسجيل البيع. لا تُجمع العملات معًا.",
  "metrics.receivedSales.unknown":
    "الصفر هنا صفر فعلي على ما استُلم. الرقم الذي تعذّر تحديده يظهر «غير معروف»، ولا يظهر صفرًا أبدًا.",
  "metrics.voids.label": "الإلغاءات",
  "metrics.voids.definition":
    "الإلغاءات المستلمة بعددها وإجماليها لكل عملة، حسب يوم العمل المسجَّل للإلغاء نفسه لا ليوم البيع.",
  "metrics.voids.unknown":
    "الصفر هنا صفر فعلي على ما استُلم. الرقم الذي تعذّر تحديده يظهر «غير معروف».",
  "metrics.returns.label": "المرتجعات",
  "metrics.returns.definition":
    "المرتجعات المستلمة بعددها وإجماليها لكل عملة، حسب يوم العمل المسجَّل للمرتجع نفسه.",
  "metrics.returns.unknown":
    "الصفر هنا صفر فعلي على ما استُلم. الرقم الذي تعذّر تحديده يظهر «غير معروف».",
  "metrics.legacyRefunds.label": "الاستردادات القديمة",
  "metrics.legacyRefunds.definition":
    "الاستردادات المسجَّلة بالطريقة القديمة بعددها وإجماليها لكل عملة، حسب وقت تسجيلها على الخادم بالمنطقة الزمنية الحالية للمتجر.",
  "metrics.legacyRefunds.unknown":
    "الصفر هنا صفر فعلي على ما استُلم. الرقم الذي تعذّر تحديده يظهر «غير معروف».",
  "metrics.syncStatus.label": "حالة مزامنة المبيعات",
  "metrics.syncStatus.definition":
    "المبيعات المستلمة لهذه الفترة حسب حالة معالجتها في الخادم الآن (وقت القراءة). «تمت المزامنة» لا تعني الترحيل إلى ERPNext.",
  "metrics.syncStatus.unknown":
    "الحالات الأربع تساوي معًا عدد المبيعات المستلمة. هذه حالة الآن، لا تراكمًا عبر الأيام.",
  "metrics.erpPosting.label": "حالة الترحيل إلى ERPNext",
  "metrics.erpPosting.definition":
    "المبيعات المستلمة لهذه الفترة حسب حالة ترحيلها إلى ERPNext الآن (وقت القراءة). حالة تشغيلية فقط، لا إقرار ضريبي.",
  "metrics.erpPosting.unknown":
    "«غير معروف» يعني أنه لا يوجد سجل ترحيل للبيع، ولا يعني أبدًا أنه لم يُرحَّل.",
  "metrics.shiftCloses.label": "إقفالات الورديات",
  "metrics.shiftCloses.definition":
    "إقفالات الورديات المسجَّلة حسب تاريخ الإقفال المحلي (بساعة نقطة البيع) بالمنطقة الزمنية الحالية للمتجر. لا يُجمع أي مبلغ نقدي هنا.",
  "metrics.shiftCloses.unknown":
    "«غير معروف» في غياب المعتمِد يعني أن الوردية لم تثبّت سياسة، ولا يعني أبدًا «لا استثناء».",

  "metrics.zoneRule.fixedAtCapture":
    "يوم العمل المخزَّن للبيع، محسوبًا بمنطقة المتجر وقت التسجيل، ولا يُعاد حسابه.",
  "metrics.zoneRule.fixedAtRecord": "يوم العمل المخزَّن للسجل نفسه وقت تسجيله.",
  "metrics.zoneRule.storeCurrentZone":
    "محسوب بالمنطقة الزمنية الحالية للمتجر، فتغيير المنطقة يعيد توزيعه على الأيام.",

  // --- Claim states ------------------------------------------------------------
  "metrics.claim.loading": "جارٍ التحميل…",
  "metrics.claim.failed": "تعذّر تحميل هذا الرقم.",
  "metrics.claim.reference": "المرجع: {id}",
  "metrics.claim.retry": "إعادة المحاولة",
  "metrics.claim.unknown": "غير معروف",
  "metrics.claim.unknownNote": "تعذّر تحديد هذا الرقم للفترة، وهو ليس صفرًا.",
  "metrics.claim.noAmount": "لا يوجد مبلغ في هذه الفترة",
  "metrics.claim.about": "عن {label}",
  "metrics.claim.part": "{label}: {count}",
  "metrics.claim.source": "المصدر: {source}",

  "metrics.part.captured": "مسجَّلة",
  "metrics.part.synced": "تمت المزامنة",
  "metrics.part.failedRetryable": "فشلت، تُعاد",
  "metrics.part.failedNeedsRepair": "فشلت، تحتاج إصلاحًا",
  "metrics.part.posted": "مرحَّلة",
  "metrics.part.pending": "قيد الترحيل",
  "metrics.part.failed": "فشل الترحيل",
  "metrics.part.unknown": "غير معروف",
  "metrics.part.normal": "عادية",
  "metrics.part.forced": "قسرية",
  "metrics.part.withVariance": "بها فرق",
  "metrics.part.approvalMissing.yes": "بلا معتمِد، نعم",
  "metrics.part.approvalMissing.no": "بلا معتمِد، لا",
  "metrics.part.approvalMissing.unknown": "بلا معتمِد، غير معروف",

  // --- Context line ------------------------------------------------------------
  "metrics.context.store": "المتجر: {store}",
  "metrics.context.allInScope": {
    zero: "لا توجد متاجر في النطاق",
    one: "متجر واحد في النطاق، حسب يوم العمل المحلي لكل متجر",
    two: "متجران في النطاق، حسب يوم العمل المحلي لكل متجر",
    few: "{count} متاجر في النطاق، حسب يوم العمل المحلي لكل متجر",
    many: "{count} متجرًا في النطاق، حسب يوم العمل المحلي لكل متجر",
    other: "{count} متجر في النطاق، حسب يوم العمل المحلي لكل متجر",
  },
  "metrics.context.day": "يوم العمل {date}",
  "metrics.context.range": "أيام العمل من {from} إلى {to}",
  "metrics.context.soFar": "(حتى الآن)",
  "metrics.context.zone": "المنطقة الزمنية: {zone}",
  "metrics.context.zones": "المناطق الزمنية: {zones}",
  "metrics.context.asOf": "بتاريخ {asOf}",
  "metrics.context.completeness":
    "المستلَم فقط: لا يُحسب ما زال في قائمة انتظار على نقطة بيع، فهذه الأرقام ليست كاملة أبدًا.",
};
