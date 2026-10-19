import type { Messages } from "../types";

/**
 * Arabic copy for the inventory read views (RT-728): the store picker, a
 * store's stock locations and movement ledger, and one product's on-hand and
 * tracking identities. Reads only.
 *
 * Glossary: movement → «حركة مخزون»; on-hand → «الرصيد الفعلي»; sellable →
 * «القابل للبيع»; stock location → «موقع التخزين»; ad-hoc movement → «حركة بلا
 * منتج». Traps: Unknown is «غير معروف», never «٠»; this on-hand is Retail
 * Tower's derived balance, never «رصيد ERPNext الدفتري».
 */
export const inventory = {
  // --- Navigation (under the Inventory section) ----------------------------------
  "inventory.nav.label": "حركات المخزون",

  // --- Shared states ----------------------------------------------------------
  "inventory.title": "المخزون",
  "inventory.scopePrompt": "اختر مستأجرًا من شريط النطاق لعرض المخزون.",
  "inventory.retry": "إعادة المحاولة",
  "inventory.inlineError": "تعذّر تحديث هذا القسم. المعروض من آخر قراءة ناجحة.",
  "inventory.error.session": "انتهت جلستك. سجّل الدخول مرة أخرى.",
  "inventory.error.forbidden": "هذا القسم غير متاح لدورك.",
  "inventory.error.rejected": "رفض الخادم هذا الطلب.",
  "inventory.error.rateLimited": "طلبات كثيرة في وقت قصير. انتظر قليلًا ثم أعد المحاولة.",
  "inventory.error.rateLimitedFor": {
    zero: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد {count} ثانية.",
    one: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد ثانية واحدة.",
    two: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد ثانيتين.",
    few: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد {count} ثوانٍ.",
    many: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد {count} ثانية.",
    other: "طلبات كثيرة في وقت قصير. أعد المحاولة بعد {count} ثانية.",
  },
  "inventory.value.unknown": "غير معروف",
  "inventory.value.notRecorded": "غير مسجّل",
  "inventory.value.none": "—",
  "inventory.note.readOnly": "عرض للقراءة فقط. لا تُسجَّل هنا أي حركة أو تحويل أو جرد.",
  "inventory.note.erpBook":
    "الأرصدة هنا محسوبة من حركات Retail Tower. رصيد ERPNext الدفتري يظهر في فروقات المخزون.",

  // --- Store picker -------------------------------------------------------------
  "inventory.stores.sub": "اختر متجرًا لعرض مواقع التخزين وسجل حركات المخزون.",
  "inventory.stores.caption": "المتاجر المتاحة لك",
  "inventory.stores.col.store": "المتجر",
  "inventory.stores.loadingNoun": "المتاجر",
  "inventory.stores.loadFailed": "تعذّر تحميل المتاجر.",
  "inventory.stores.empty": "لا توجد متاجر متاحة لك في هذا المستأجر.",

  // --- One store ------------------------------------------------------------------
  "inventory.store.back": "كل المتاجر",
  "inventory.store.title": "مخزون المتجر",
  "inventory.store.sub": "مواقع التخزين وكل حركات المخزون في هذا المتجر، الأحدث أولًا.",
  "inventory.store.notFound": "هذا المتجر غير متاح.",

  "inventory.locations.title": "مواقع التخزين",
  "inventory.locations.caption": "مواقع التخزين في المتجر، الموقع الرئيسي أولًا",
  "inventory.locations.col.name": "الاسم",
  "inventory.locations.col.code": "الرمز",
  "inventory.locations.col.kind": "النوع",
  "inventory.locations.col.active": "الحالة",
  "inventory.locations.kind.primary": "رئيسي",
  "inventory.locations.kind.storage": "تخزين",
  "inventory.locations.active": "نشط",
  "inventory.locations.inactive": "غير نشط",
  "inventory.locations.loadingNoun": "مواقع التخزين",
  "inventory.locations.loadFailed": "تعذّر تحميل مواقع التخزين.",
  "inventory.locations.empty": "لا توجد مواقع تخزين لهذا المتجر.",

  "inventory.movements.title": "سجل حركات المخزون",
  "inventory.movements.sub":
    "كل حركة في المتجر، لكل المنتجات والحركات بلا منتج. افتح منتجًا لرؤية رصيده.",
  "inventory.movements.caption": "حركات المخزون، الأحدث أولًا",
  "inventory.movements.col.occurredAt": "وقت الحركة",
  "inventory.movements.col.type": "النوع",
  "inventory.movements.col.product": "المنتج",
  "inventory.movements.col.quantity": "الكمية",
  "inventory.movements.col.position": "الموقع والحالة",
  "inventory.movements.col.reason": "السبب",
  "inventory.movements.col.erp": "حالة ERPNext",
  "inventory.movements.adhoc": "حركة بلا منتج",
  "inventory.movements.openProduct": "افتح رصيد المنتج {ref}",
  "inventory.movements.loadingNoun": "حركات المخزون",
  "inventory.movements.loadFailed": "تعذّر تحميل حركات المخزون.",
  "inventory.movements.empty": "لا توجد حركات مخزون في هذا المتجر بعد.",
  "inventory.movements.loadMore": "تحميل حركات أقدم",

  "inventory.movementType.inbound": "وارد",
  "inventory.movementType.outbound": "صادر",
  "inventory.movementType.adjustment": "تسوية",
  "inventory.movementType.transfer_out": "تحويل صادر",
  "inventory.movementType.transfer_in": "تحويل وارد",
  "inventory.movementType.count_correction": "تصحيح جرد",

  "inventory.status.sellable": "قابل للبيع",
  "inventory.status.return_inspection": "فحص مرتجع",
  "inventory.status.quality_hold": "حجز جودة",
  "inventory.status.damaged": "تالف",
  "inventory.status.expired": "منتهي الصلاحية",
  "inventory.status.recall_hold": "حجز استدعاء",

  "inventory.integration.not_posted": "لا ترحيل مطلوب",
  "inventory.integration.pending": "قيد الترحيل",
  "inventory.integration.confirmed": "أكّده ERPNext",
  "inventory.integration.rejected": "رفضه ERPNext",
  "inventory.integration.reconciliation_required": "تحتاج إلى مطابقة",
  "inventory.integration.external": "مصدره ERPNext",

  // --- One product at one store --------------------------------------------------
  "inventory.product.back": "سجل حركات المتجر",
  "inventory.product.title": "رصيد المنتج في المتجر",
  "inventory.product.sub": "المنتج {ref}",
  "inventory.product.notFound": "هذا المنتج غير متاح في هذا المتجر.",

  "inventory.onHand.title": "الرصيد الفعلي",
  "inventory.onHand.physical": "الرصيد الفعلي",
  "inventory.onHand.sellable": "القابل للبيع",
  "inventory.onHand.byStatus": "الرصيد حسب حالة المخزون",
  "inventory.onHand.col.status": "الحالة",
  "inventory.onHand.col.quantity": "الكمية",
  "inventory.onHand.negative": "الرصيد أقل من صفر. يُسجَّل ويُنبَّه إليه، ولا يُرفض.",
  "inventory.onHand.note":
    "محسوب عند القراءة من حركات هذا المنتج في المتجر، لكل المواقع. ليس رصيد ERPNext الدفتري.",
  "inventory.onHand.loadingNoun": "الرصيد",
  "inventory.onHand.loadFailed": "تعذّر تحميل الرصيد. الرصيد غير معروف.",

  "inventory.tracking.title": "الدفعات والأرقام التسلسلية",
  "inventory.tracking.caption": "هويات التتبع لهذا المنتج",
  "inventory.tracking.col.kind": "النوع",
  "inventory.tracking.col.code": "الرمز",
  "inventory.tracking.col.expiry": "تاريخ الانتهاء",
  "inventory.tracking.col.manufactured": "تاريخ التصنيع",
  "inventory.tracking.kind.batch": "دفعة",
  "inventory.tracking.kind.serial": "رقم تسلسلي",
  "inventory.tracking.loadingNoun": "هويات التتبع",
  "inventory.tracking.loadFailed": "تعذّر تحميل هويات التتبع.",
  "inventory.tracking.empty": "لا توجد دفعات أو أرقام تسلسلية مسجّلة لهذا المنتج.",
  "inventory.tracking.loadMore": "تحميل المزيد",
} satisfies Messages;
