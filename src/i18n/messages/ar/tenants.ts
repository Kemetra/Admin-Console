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
  "stores.list.title": "المتاجر",
  "stores.list.sub": "المتاجر في {tenant}.",
  "stores.list.add": "إضافة متجر",
  "stores.list.caption": "المتاجر",
  "stores.list.loadingNoun": "المتاجر",
  "stores.list.empty": "لا توجد متاجر في {tenant} بعد.",
  "stores.list.retry": "إعادة المحاولة",

  "stores.field.name": "الاسم",
  "stores.field.code": "الرمز",
  "stores.field.state": "الحالة",
  "stores.field.id": "معرّف المتجر",

  // State badges: the adjective agrees with «المتجر» (masculine).
  "stores.state.active": "نشط",
  "stores.state.inactive": "غير نشط",

  "stores.detail.loadingNoun": "المتجر",
  "stores.detail.back": "العودة إلى المتاجر",
  "stores.detail.edit": "تعديل",
  // Also the ConfirmDelete action, so it reads as «حذف {name}؟ …» there.
  "stores.detail.softDelete": "حذف",

  "stores.form.createTitle": "متجر جديد",
  "stores.form.editTitle": "تعديل المتجر",
  "stores.form.create": "إضافة المتجر",
  "stores.form.saveChanges": "حفظ التغييرات",
  "stores.form.scopeLine": "تتم الإضافة في المؤسسة {tenant}.",
  "stores.form.active": "نشط",

  "stores.scope.prompt":
    "اختر مؤسسة قبل إدارة المتاجر. استخدم محدد المؤسسة في شريط النطاق أعلاه لاختيار مكان عملك.",

  "stores.errors.codeConflict": "رمز المتجر هذا مستخدم بالفعل في هذه المؤسسة. اختر رمزًا آخر.",
  "stores.errors.scopeRequired": "اختر مؤسسة قبل إدارة المتاجر.",
} satisfies Messages;
