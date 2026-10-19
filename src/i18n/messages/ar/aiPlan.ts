/**
 * RT-665 — خطة الذكاء الاصطناعي والاستخدام (AD-AI-ENT-001، عقد RT-662): عرض للقراءة فقط
 * لما يقرره الخادم. لا أسعار ولا تكلفة رموز ولا أرصدة ائتمان. النص العربي هو المرجع،
 * والإنجليزية مطابقة له في المفاتيح. نص مدير المتجر بلا كلمتي «خطة» أو «استخدام» (D-6).
 */
export const aiPlan = {
  // --- Sections ------------------------------------------------------------
  "aiPlan.full.title": "خطة الذكاء الاصطناعي والاستخدام",
  "aiPlan.full.sub": "للعرض فقط. ما تتضمنه خطتك، وكم استُخدم منه.",
  "aiPlan.minimal.title": "ميزات الذكاء الاصطناعي في متاجرك",
  "aiPlan.minimal.sub": "ميزات الذكاء الاصطناعي التي يمكنك استخدامها في المتاجر التي تديرها.",
  "aiPlan.loadingNoun": "ميزات الذكاء الاصطناعي",
  "aiPlan.notYet.full": "معلومات خطة الذكاء الاصطناعي غير متاحة بعد.",
  "aiPlan.notYet.minimal": "معلومات ميزات الذكاء الاصطناعي غير متاحة بعد.",
  "aiPlan.loadFailed": "تعذّر تحميل معلومات الذكاء الاصطناعي.",
  "aiPlan.sessionExpired": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "aiPlan.retry": "إعادة المحاولة",

  // --- Plan facts (owner / tenant_admin) ------------------------------------------
  "aiPlan.field.state": "حالة الخطة",
  "aiPlan.field.effectiveFrom": "سارية من",
  "aiPlan.field.effectiveUntil": "سارية حتى",
  "aiPlan.field.evaluatedAt": "بتاريخ",
  "aiPlan.state.none": "لا توجد خطة ذكاء اصطناعي",
  "aiPlan.state.trial": "فترة تجريبية",
  "aiPlan.state.active": "فعّالة",
  "aiPlan.state.grace": "فترة سماح (للقراءة فقط)",
  "aiPlan.state.expired": "منتهية",
  "aiPlan.state.cancelled": "ملغاة",
  "aiPlan.state.unknown": "الحالة غير متاحة",

  // --- Features ----------------------------------------------------------------------
  "aiPlan.features.title": "الميزات",
  "aiPlan.features.empty": "لا توجد ميزات للعرض.",
  "aiPlan.status.available": "متاحة",
  "aiPlan.status.notInPlan": "غير مضمّنة في خطتك",
  "aiPlan.status.trialEnded": "انتهت الفترة التجريبية",
  "aiPlan.status.readOnly": "للقراءة فقط: النتائج المحفوظة تبقى متاحة وتتوقف الطلبات الجديدة",
  "aiPlan.status.switchedOff": "أوقفها مالك الحساب",
  "aiPlan.status.temporarilyUnavailable": "غير متاحة مؤقتًا",
  "aiPlan.minimal.available": "متاحة",
  "aiPlan.minimal.unavailable": "غير متاحة — اسأل مالك الحساب",
  "aiPlan.optOut.since": "آخر تغيير من المالك في {date}",

  // --- Meters -----------------------------------------------------------------------
  "aiPlan.meter.window.day": "لكل يوم (UTC)",
  "aiPlan.meter.window.month": "لكل شهر (UTC)",
  "aiPlan.meter.window.unknown": "لكل فترة",
  "aiPlan.meter.scope.tenant": "حصة المؤسسة كلها",
  "aiPlan.meter.scope.store": "حصة المتجر",
  "aiPlan.meter.left": "المتبقي {remaining} من {limit} من الطلبات، يُعاد الضبط {time}",
  "aiPlan.meter.used": "استُنفدت الحصة، يُعاد الضبط {time}",
  "aiPlan.meter.none": "لا توجد حصة في هذه الفترة، يُعاد الضبط {time}",
  "aiPlan.meter.detail": "الحد {limit}، المستخدم {used}، قيد التنفيذ {reserved}",
};
