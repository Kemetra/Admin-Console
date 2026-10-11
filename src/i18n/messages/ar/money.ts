import type { Messages } from "../types";

/**
 * Arabic copy for the money surfaces: payer accounts (017), receivables,
 * claims and remittance reconciliation (018), and apply payment (019).
 *
 * Glossary used here: Payer → «جهة الدفع» (pl. «جهات الدفع»); Receivable →
 * «الذمة المدينة» (pl. «الذمم المدينة»); Claim → «المطالبة»; Remittance →
 * «السداد»; Apply payment → «تخصيص دفعة»; Variance → «الفرق». Money values are
 * never part of a template's prose: they render through <Money> as
 * `1,250.00 EGP`, isolated LTR.
 */
export const money = {
  // --- Payer accounts (017) --------------------------------------------------
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
  "payers.create.externalRef": "المرجع الخارجي (اختياري)",
  "payers.create.externalRefPlaceholder": "مثال: رمز شركة التأمين",
  "payers.create.submit": "إضافة جهة دفع",
  "payers.create.errors.validation": "راجع بيانات جهة الدفع ثم حاول مرة أخرى.",
  "payers.create.errors.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "payers.create.errors.forbidden": "ليست لديك صلاحية لإضافة حسابات جهات الدفع في هذه المؤسسة.",
  "payers.create.errors.keyConflict": "تعذّرت إضافة جهة الدفع هذه. حاول مرة أخرى.",
  "payers.create.errors.conflict": "تعذّرت إضافة حساب جهة الدفع هذا.",
  "payers.create.errors.generic": "حدث خطأ أثناء إضافة جهة الدفع. حاول مرة أخرى.",

  "payers.form.categoryRequired": "اختر فئة جهة الدفع.",
  "payers.form.displayNameRequired": "الاسم المعروض مطلوب.",
  "payers.form.displayNameTooLong": "يجب ألا يتجاوز الاسم المعروض {max} حرف.",

  // --- Receivables (018) -----------------------------------------------------
  "receivables.list.scopePrompt": "اختر مؤسسة لعرض ذممها المدينة.",
  "receivables.list.title": "الذمم المدينة",
  "receivables.list.subtitle": "المبالغ المستحقة عن المبيعات في {tenant}.",
  "receivables.list.forbidden": "ليست لديك صلاحية الوصول إلى الذمم المدينة في هذه المؤسسة.",
  "receivables.list.loadFailed": "تعذّر تحميل الذمم المدينة.",
  "receivables.list.loadingNoun": "الذمم المدينة",
  "receivables.list.empty": "لا توجد ذمم مدينة في هذه المؤسسة بعد.",
  "receivables.list.caption": "الذمم المدينة",
  "receivables.list.col.receivable": "الذمة المدينة",
  "receivables.list.col.payer": "جهة الدفع",
  "receivables.list.col.outstanding": "المبلغ المستحق",
  "receivables.list.col.state": "الحالة",
  "receivables.list.col.erpPosting": "الترحيل إلى ERPNext",
  "receivables.list.col.action": "الإجراء",
  "receivables.list.notPosted": "لم يُرحَّل",
  "receivables.list.applyPayment": "تخصيص دفعة",
  "receivables.list.submitClaim": "تقديم مطالبة",

  // Receivable lifecycle (`ReceivableState`); the API values stay raw.
  "receivables.state.open": "مفتوحة",
  "receivables.state.partially_applied": "مسددة جزئيًا",
  "receivables.state.settled": "مسددة",
  "receivables.state.claimed": "مُطالَب بها",
  "receivables.state.flagged": "تحتاج إلى مراجعة",
  "receivables.state.unknown": "حالة غير معروفة",

  "receivables.errors.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",

  "receivables.claim.title": "تقديم مطالبة",
  "receivables.claim.scopeLine": {
    zero: "تقديم مطالبة لا تشمل أي ذمة مدينة في {tenant}.",
    one: "تقديم مطالبة تشمل ذمة مدينة واحدة في {tenant}.",
    two: "تقديم مطالبة تشمل ذمتين مدينتين في {tenant}.",
    few: "تقديم مطالبة تشمل {total} ذمم مدينة في {tenant}.",
    many: "تقديم مطالبة تشمل {total} ذمة مدينة في {tenant}.",
    other: "تقديم مطالبة تشمل {total} ذمة مدينة في {tenant}.",
  },
  "receivables.claim.submit": "تقديم مطالبة",
  "receivables.claim.errors.validation": "راجع المطالبة ثم حاول مرة أخرى.",
  "receivables.claim.errors.forbidden": "ليست لديك صلاحية لتقديم مطالبات في هذه المؤسسة.",
  "receivables.claim.errors.conflict": "تعذّر تقديم هذه المطالبة. حاول مرة أخرى.",
  "receivables.claim.errors.generic": "حدث خطأ أثناء تقديم المطالبة. حاول مرة أخرى.",

  "receivables.form.payerRequired": "اختر جهة الدفع لهذه المطالبة.",
  "receivables.form.receivablesRequired": "اختر ذمة مدينة واحدة على الأقل للمطالبة بها.",
  "receivables.form.receivablesTooMany": "لا يمكن أن تضم المطالبة الواحدة أكثر من {max} ذمة مدينة.",
  "receivables.form.amountInvalid": "أدخل مبلغًا صالحًا (مثال: 120.00).",

  "receivables.reconcile.title": "مطابقة السداد",
  "receivables.reconcile.outcome": "النتيجة {outcome}",
  "receivables.reconcile.claimed": "المبلغ المُطالَب به",
  "receivables.reconcile.remitted": "المبلغ المسدَّد",
  "receivables.reconcile.variance": "الفرق",
  "receivables.reconcile.done": "تم",
  "receivables.reconcile.scopeLine": "مطابقة سداد للمطالبة {claim}.",
  "receivables.reconcile.amount": "المبلغ المسدَّد",
  "receivables.reconcile.reference": "مرجع السداد (اختياري)",
  "receivables.reconcile.referencePlaceholder": "مرجع إشعار السداد من جهة الدفع",
  "receivables.reconcile.submit": "مطابقة",
  "receivables.reconcile.errors.validation": "راجع مبلغ السداد ثم حاول مرة أخرى.",
  "receivables.reconcile.errors.forbidden": "ليست لديك صلاحية لمطابقة السداد في هذه المؤسسة.",
  "receivables.reconcile.errors.conflict": "تعذّرت مطابقة هذا السداد. حاول مرة أخرى.",
  "receivables.reconcile.errors.generic": "حدث خطأ أثناء مطابقة السداد. حاول مرة أخرى.",

  // Reconciliation outcome (`ReconciliationResult.outcome`); API values stay raw.
  "receivables.outcome.settled": "تمت التسوية",
  "receivables.outcome.partial": "تسوية جزئية",
  "receivables.outcome.flagged": "تحتاج إلى مراجعة",
  "receivables.outcome.unknown": "نتيجة غير معروفة",

  // --- Apply payment (019) ---------------------------------------------------
  "settlement.apply.title": "تخصيص دفعة",
  "settlement.apply.result": "تم تخصيص الدفعة — حالة الذمة المدينة الآن {state}",
  "settlement.apply.outstanding": "المبلغ المستحق",
  "settlement.apply.done": "تم",
  "settlement.apply.scopeLine": "تخصيص دفعة للذمة المدينة {receivable} — المبلغ المستحق {balance}.",
  "settlement.apply.amount": "المبلغ",
  "settlement.apply.note": "ملاحظة (اختياري)",
  "settlement.apply.submit": "تخصيص دفعة",
  "settlement.apply.errors.validation": "راجع المبلغ ثم حاول مرة أخرى.",
  "settlement.apply.errors.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "settlement.apply.errors.forbidden": "ليست لديك صلاحية لتخصيص الدفعات في هذه المؤسسة.",
  "settlement.apply.errors.conflict":
    "تغيّرت هذه الذمة المدينة منذ فتحها. أعد فتحها ثم حاول مرة أخرى.",
  "settlement.apply.errors.generic": "حدث خطأ أثناء تخصيص الدفعة. حاول مرة أخرى.",

  "settlement.form.amountInvalid": "أدخل مبلغًا أكبر من صفر (مثال: 50.00).",
  "settlement.form.versionInvalid": "يلزم رقم إصدار صالح للذمة المدينة.",
} satisfies Messages;
