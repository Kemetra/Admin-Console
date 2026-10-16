import type { Messages } from "../types";

/**
 * Arabic copy for the RF-2 Tenants and Stores surfaces (lists, detail, forms,
 * scope prompt) and the RF-2 error mapping's surface-specific copy
 * (`mapRf2Error` in src/lib/rf2-queries.ts; the shared 403 / 404 / 5xx /
 * generic copy comes from `errors.*` in common).
 */
export const tenants = {
  // --- Tenants ---------------------------------------------------------------
  "tenants.list.title": "المؤسسات",
  "tenants.list.sub": "كل المؤسسات التي يمكنك إدارتها.",
  "tenants.list.add": "إضافة مؤسسة",
  "tenants.list.caption": "المؤسسات",
  "tenants.list.loadingNoun": "المؤسسات",
  "tenants.list.empty": "لا توجد مؤسسات بعد.",
  "tenants.list.retry": "إعادة المحاولة",

  "tenants.field.name": "الاسم",
  "tenants.field.slug": "المعرّف المختصر",
  "tenants.field.status": "الحالة",
  "tenants.field.id": "معرّف المؤسسة",

  // Status badges: the adjective agrees with «المؤسسة» (feminine).
  "tenants.status.active": "نشطة",
  "tenants.status.suspended": "معلّقة",
  "tenants.status.pending": "قيد الانتظار",
  "tenants.status.unknown": "حالة غير معروفة",

  "tenants.detail.loadingNoun": "المؤسسة",
  "tenants.detail.back": "العودة إلى المؤسسات",
  "tenants.detail.edit": "تعديل",
  // Also the ConfirmDelete action, so it reads as «حذف {name}؟ …» there.
  "tenants.detail.softDelete": "حذف",

  "tenants.form.createTitle": "مؤسسة جديدة",
  "tenants.form.editTitle": "تعديل المؤسسة",
  "tenants.form.create": "إضافة المؤسسة",
  "tenants.form.saveChanges": "حفظ التغييرات",

  "tenants.errors.slugConflict": "هذا المعرّف المختصر مستخدم بالفعل. اختر معرّفًا آخر.",

  // --- Stores ----------------------------------------------------------------
  // Copy follows the approved RT-400 screens (design/screens/01–05, 16, 17, 19).
  "stores.list.title": "المتاجر",
  "stores.list.sub": "المتاجر في {tenant}",
  "stores.list.add": "إضافة متجر",
  "stores.list.caption": "المتاجر",
  "stores.list.col.store": "المتجر",
  "stores.list.loadingNoun": "المتاجر",
  "stores.list.empty": "لا توجد متاجر في هذه المؤسسة بعد.",
  "stores.list.emptyHint": "أضف أول متجر لتتمكن من إقران نقاط البيع.",
  "stores.list.loadFailedTitle": "تعذّر تحميل قائمة المتاجر.",
  "stores.list.loadFailedBody":
    "لم يتغيّر شيء في بيانات المتاجر. أعد تحميل القائمة للمحاولة مرة أخرى.",
  "stores.list.retry": "إعادة تحميل المتاجر",

  "stores.field.code": "الرمز",
  "stores.field.state": "الحالة",
  "stores.field.id": "معرّف المتجر",
  "stores.field.timezone": "المنطقة الزمنية",

  // State badges: the adjective agrees with «المتجر» (masculine). Inactive is
  // the V1 `is_active=false` state, not a closure (decisions 188/194).
  "stores.state.active": "نشط",
  "stores.state.inactive": "موقوف",

  "stores.detail.loadingNoun": "المتجر",
  "stores.detail.back": "العودة إلى المتاجر",
  "stores.detail.edit": "تعديل المتجر",

  "stores.form.createTitle": "إضافة متجر",
  "stores.form.editTitle": "تعديل {name}",
  "stores.form.section": "بيانات المتجر",
  "stores.form.nameLabel": "اسم المتجر",
  "stores.form.codeLabel": "رمز المتجر",
  "stores.form.required": "(إلزامي)",
  "stores.form.codeHintCreate": "لا يمكن تغيير الرمز بعد إنشاء المتجر.",
  "stores.form.codeHintEdit": "للقراءة فقط. لا يمكن تغيير الرمز بعد إنشاء المتجر.",
  "stores.form.idHint": "استخدمه عند التواصل مع الدعم.",
  "stores.form.create": "إنشاء المتجر",
  "stores.form.saveChanges": "حفظ المتجر",
  "stores.form.cancelEdit": "إلغاء التعديل",
  "stores.form.scopeLine": "سيُنشأ المتجر في {tenant}.",
  "stores.form.timezoneHintCreate":
    "تُعرض أوقات المتجر وتُحسب أيام العمل بهذه المنطقة. فرق التوقيت عن UTC يتبع قواعد المنطقة، ومنها التوقيت الصيفي.",
  "stores.form.timezoneHintEdit":
    "يُراجَع أثر التغيير قبل تطبيقه، ولا يمكن تغييرها أثناء وردية مفتوحة. فرق التوقيت عن UTC يتبع قواعد المنطقة، ومنها التوقيت الصيفي.",
  "stores.form.timezoneGroupCommon": "مناطق شائعة",
  "stores.form.timezoneGroupOther": "كل المناطق الأخرى",

  // The impact review shown before a time zone change is applied (RT-401).
  "stores.timezone.impact.title": "أثر التغيير",
  "stores.timezone.impact.loading": "جارٍ فحص الأثر…",
  "stores.timezone.impact.zones": "التغيير من {current} إلى {proposed}.",
  "stores.timezone.impact.dateChanges": "يتغيّر تاريخ يوم العمل اليوم من {from} إلى {to}.",
  "stores.timezone.impact.dateSame": "يبقى تاريخ يوم العمل اليوم {date}.",
  "stores.timezone.impact.noOpenShifts": "لا توجد ورديات مفتوحة في هذا المتجر.",
  "stores.timezone.impact.openShifts": {
    zero: "لا توجد ورديات مفتوحة في هذا المتجر.",
    one: "هناك وردية مفتوحة في هذا المتجر. أغلقها قبل تغيير المنطقة الزمنية.",
    two: "هناك ورديتان مفتوحتان في هذا المتجر. أغلقهما قبل تغيير المنطقة الزمنية.",
    few: "هناك {count} ورديات مفتوحة في هذا المتجر. أغلقها قبل تغيير المنطقة الزمنية.",
    many: "هناك {count} وردية مفتوحة في هذا المتجر. أغلقها قبل تغيير المنطقة الزمنية.",
    other: "هناك {count} وردية مفتوحة في هذا المتجر. أغلقها قبل تغيير المنطقة الزمنية.",
  },
  "stores.timezone.impact.history": "تحتفظ المبيعات والمرتجعات والورديات المسجّلة بتاريخ يوم عملها.",
  "stores.timezone.impact.noChange": "هذه هي المنطقة الزمنية الحالية للمتجر. لا يوجد ما يتغيّر.",
  "stores.timezone.impact.review": "راجعتُ هذا الأثر وأريد تغيير المنطقة الزمنية.",

  // The V1 `is_active` control on the edit screen (owner decision 2026-10-13).
  "stores.status.title": "حالة المتجر",
  "stores.status.current": "الحالة الحالية:",
  "stores.status.suspend": "إيقاف المتجر",
  "stores.status.activate": "تفعيل المتجر",
  "stores.status.confirmLabel": "تأكيد: إيقاف المتجر",
  "stores.status.confirmPrompt": "إيقاف {name}؟ يمكنك إعادة تفعيله لاحقًا من هذه الصفحة.",

  "stores.scope.prompt":
    "اختر مؤسسة قبل إدارة المتاجر. استخدم محدد المؤسسة في شريط النطاق أعلاه لاختيار مكان عملك.",

  "stores.errors.codeConflict": "رمز المتجر هذا مستخدم بالفعل في هذه المؤسسة. اختر رمزًا آخر.",
  "stores.errors.scopeRequired": "اختر مؤسسة قبل إدارة المتاجر.",
  "stores.errors.timezoneInvalid": "اختر منطقة زمنية صالحة من القائمة.",
  "stores.errors.timezoneChangedConcurrently":
    "غيّر شخص آخر المنطقة الزمنية لهذا المتجر، فلم يُحفظ شيء. راجع الأثر من جديد قبل التطبيق.",
  "stores.errors.storeHasOpenShift":
    "لدى هذا المتجر وردية مفتوحة، لذا لا يمكن تغيير منطقته الزمنية الآن. أغلق الوردية المفتوحة ثم حاول مجددًا. لم يتغيّر شيء.",
  "stores.errors.editDeniedTitle": "ليست لديك صلاحية لتعديل هذا المتجر.",
  "stores.errors.editDeniedBody": "لم يتغيّر شيء. يستطيع مالك المؤسسة أو مسؤولها إجراء هذا التعديل.",
} satisfies Messages;
