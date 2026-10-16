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
    "الترتيب من الخادم: استثناءات العهدة أولًا، ثم الأجهزة الفعّالة الأقرب انتهاءً، ثم الموقوفة، ثم التي خارج الخدمة.",
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
  "devices.filter.trustAny": "كل الحالات",
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
} satisfies Messages;
