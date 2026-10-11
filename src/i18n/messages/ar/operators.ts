import type { Messages } from "../types";

/**
 * Arabic copy for the operators surface (RF-5: member list, invite, edit and
 * revoke). UX-12: the operator / member identity is «المستخدم» (the nav label
 * is «المستخدمون»). Role labels come from the shared `role.*` keys via
 * `roleKey(code)`; a raw role code never reaches the copy.
 */
export const operators = {
  "operators.title": "المستخدمون",
  "operators.scopePrompt.message":
    "اختر مؤسسة لإدارة مستخدميها. استخدم أداة اختيار المؤسسة في شريط النطاق أعلاه لتحديد المكان الذي تعمل فيه.",

  // SF5-1 member list.
  "operators.list.subtitle": "مستخدمو {tenant}.",
  "operators.list.invite": "دعوة مستخدم",
  "operators.list.notFound": "قائمة المستخدمين غير متاحة لهذه المؤسسة.",
  // Inserted into «جارٍ تحميل {label}…», so it is the genitive plural.
  "operators.list.loadingNoun": "المستخدمين",
  "operators.list.empty": "لا يوجد مستخدمون آخرون في هذه المؤسسة بعد.",
  "operators.list.caption": "المستخدمون",
  "operators.list.col.member": "المستخدم",
  "operators.list.col.role": "الدور",
  "operators.list.col.storeAccess": "الوصول إلى المتاجر",
  "operators.list.col.state": "حالة العضوية",

  // Membership state (the revoked marker). Feminine: they agree with «العضوية».
  "operators.state.active": "نشطة",
  "operators.state.revoked": "مُبطلة",

  // Store-access kinds (`store_access_kind`: "all" / "specific").
  "operators.storeAccess.all": "كل المتاجر",
  "operators.storeAccess.specific": "متاجر محددة",
  "operators.storeAccess.count": {
    zero: "{count} متجر",
    one: "متجر واحد",
    two: "متجران",
    few: "{count} متاجر",
    many: "{count} متجرًا",
    other: "{count} متجر",
  },

  // Invite / edit form fields.
  "operators.form.email": "البريد الإلكتروني",
  "operators.form.role": "الدور",
  "operators.form.storeAccess": "الوصول إلى المتاجر",
  "operators.form.storeIdsPlaceholder": "معرّفات المتاجر، مفصولة بفواصل",

  // SF5-2 invite drawer.
  "operators.invite.title": "دعوة مستخدم",
  "operators.invite.scopeLine": "الدعوة إلى المؤسسة {tenant}.",
  "operators.invite.submit": "إرسال الدعوة",
  // 425 Too Early: the disabled submit counts down to the same-key retry.
  "operators.invite.retrying": {
    zero: "إعادة المحاولة بعد {count} ثانية…",
    one: "إعادة المحاولة بعد ثانية واحدة…",
    two: "إعادة المحاولة بعد ثانيتين…",
    few: "إعادة المحاولة بعد {count} ثوانٍ…",
    many: "إعادة المحاولة بعد {count} ثانية…",
    other: "إعادة المحاولة بعد {count} ثانية…",
  },
  "operators.invite.errors.selectTenant": "اختر مؤسسة قبل دعوة المستخدمين.",
  "operators.invite.errors.validation": "تحقّق من بيانات الدعوة ثم حاول مرة أخرى.",
  "operators.invite.errors.forbidden": "ليست لديك صلاحية لدعوة مستخدمين إلى هذه المؤسسة.",
  "operators.invite.errors.pendingExists": "توجد دعوة معلّقة بالفعل لهذا البريد الإلكتروني.",
  "operators.invite.errors.keyConflict": "تعذّر إكمال هذه الدعوة. حاول مرة أخرى.",
  "operators.invite.errors.tooLong": "تستغرق الدعوة وقتًا أطول من اللازم. حاول مرة أخرى.",
  "operators.invite.errors.generic": "حدث خطأ أثناء إرسال الدعوة. حاول مرة أخرى.",

  // SF5-3 edit / revoke drawer.
  "operators.edit.title": "تعديل المستخدم",
  "operators.edit.scopeLine": "أنت تعدّل {name}.",
  "operators.edit.save": "حفظ التغييرات",
  "operators.edit.notFound": "تعذّر العثور على هذا المستخدم.",
  "operators.edit.revoke.title": "إبطال العضوية",
  "operators.edit.revoke.open": "إبطال العضوية",
  "operators.edit.revoke.confirm": "إبطال",
  // The resource the shared confirm step names: «إبطال عضوية {name}؟ …».
  "operators.edit.revoke.resource": "عضوية {name}",
} satisfies Messages;
