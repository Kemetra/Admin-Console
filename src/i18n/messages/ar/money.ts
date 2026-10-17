import type { Messages } from "../types";

/**
 * Arabic copy for the money surfaces: payer accounts (017). The receivable,
 * claim, remittance and cash-application copy (018/019) was removed by RT-421
 * (RT-413 Option B: ERPNext owns A/R).
 *
 * Glossary used here: Payer → «جهة الدفع» (pl. «جهات الدفع»); ERPNext Customer →
 * «عميل ERPNext».
 */
export const money = {
  // --- Payer accounts (017) --------------------------------------------------
  // Navigation (RT-421: owner / tenant_admin only, its own section).
  "payers.nav.section": "جهات الدفع",
  "payers.nav.label": "حسابات جهات الدفع",
  "payers.list.scopePrompt": "اختر مؤسسة لإدارة حسابات جهات الدفع التابعة لها.",
  "payers.list.title": "حسابات جهات الدفع",
  "payers.list.subtitle": "جهات الدفع من العملاء الآجلين والشركات وشركات التأمين في {tenant}.",
  "payers.list.create": "إضافة جهة دفع",
  "payers.list.forbidden": "ليست لديك صلاحية الوصول إلى حسابات جهات الدفع في هذه المؤسسة.",
  "payers.list.loadFailed": "تعذّر تحميل حسابات جهات الدفع.",
  "payers.list.loadingNoun": "حسابات جهات الدفع",
  "payers.list.empty": "لا توجد حسابات جهات دفع في هذه المؤسسة بعد.",
  "payers.list.caption": "حسابات جهات الدفع",
  "payers.list.col.payer": "جهة الدفع",
  "payers.list.col.category": "الفئة",
  "payers.list.col.status": "الحالة",
  "payers.list.col.scope": "النطاق",
  "payers.list.col.erpCustomer": "عميل ERPNext",
  "payers.list.erpCustomerUnlinked": "غير مرتبط",
  "payers.list.loadMore": "تحميل المزيد",
  "payers.list.emptyPage": "لا توجد حسابات جهات دفع في هذه الصفحة بعد. حمّل المزيد لمتابعة البحث.",
  "payers.list.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "payers.scope.tenant": "المؤسسة بأكملها",
  "payers.scope.store": "متجر واحد",

  // Payer category (`PayerCategory`) and status labels; the API values stay raw.
  "payers.category.credit_customer": "عميل آجل",
  "payers.category.corporate": "شركة",
  "payers.category.insurer": "شركة تأمين",
  "payers.category.unknown": "فئة غير معروفة",
  "payers.status.active": "نشط",
  "payers.status.suspended": "موقوف",

  "payers.create.title": "إضافة حساب جهة دفع",
  "payers.create.scopeLine": "إضافة جهة دفع في المؤسسة {tenant}.",
  "payers.create.category": "الفئة",
  "payers.create.displayName": "الاسم المعروض",
  "payers.create.scope": "النطاق",
  "payers.create.scopeTenant": "المؤسسة بأكملها (كل المتاجر)",
  "payers.create.externalRef": "عميل ERPNext (اختياري)",
  "payers.create.externalRefPlaceholder": "معرّف عميل ERPNext",
  "payers.create.externalRefHint":
    "عميل ERPNext الذي تُرحَّل عليه مبالغ جهة الدفع هذه. اتركه فارغًا حتى تُربط جهة الدفع.",
  "payers.create.submit": "إضافة جهة دفع",
  "payers.create.errors.validation": "راجع بيانات جهة الدفع ثم حاول مرة أخرى.",
  "payers.create.errors.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "payers.create.errors.forbidden": "ليست لديك صلاحية لإضافة حسابات جهات الدفع في هذه المؤسسة.",
  "payers.create.errors.storeUnavailable":
    "لا يمكن استخدام هذا المتجر لجهة الدفع هذه. اختر نطاقًا آخر.",
  "payers.create.errors.keyConflict": "تعذّرت إضافة جهة الدفع هذه. حاول مرة أخرى.",
  "payers.create.errors.conflict": "تعذّرت إضافة حساب جهة الدفع هذا.",
  "payers.create.errors.generic": "حدث خطأ أثناء إضافة جهة الدفع. حاول مرة أخرى.",

  "payers.form.categoryRequired": "اختر فئة جهة الدفع.",
  "payers.form.displayNameRequired": "الاسم المعروض مطلوب.",
  "payers.form.displayNameTooLong": "يجب ألا يتجاوز الاسم المعروض {max} حرف.",
} satisfies Messages;
