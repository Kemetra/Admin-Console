/**
 * Platform console strings that belong to the support session (RT-781, RT-777
 * S2): the session bar and its lifecycle states; and the tenant directory and
 * its start drawer (RT-782, S3). The `/platform` shell and the no-access state
 * keep their keys in shell.ts (RT-780).
 */
import type { Messages } from "../types";

export const platform = {
  "platform.session.region": "جلسة الدعم",
  "platform.session.badge": "وصول دعم",
  "platform.session.tenant": "تعمل الآن داخل: {name}",
  "platform.session.tenantExpired": "كانت الجلسة داخل: {name}",
  "platform.session.purpose": "الغرض: {purpose}",
  "platform.session.purpose.customer_support": "دعم العملاء",
  "platform.session.purpose.incident": "حادث",
  "platform.session.purpose.onboarding": "التهيئة",
  "platform.session.ticket": "التذكرة",
  "platform.session.readOnly": "للقراءة فقط",
  "platform.session.remaining": "متبقٍّ: {duration} · حتى {time}",
  "platform.session.remainingUnderMinute": "متبقٍّ أقل من دقيقة · حتى {time}",
  "platform.session.expiredAt": "انتهت في {time}",
  "platform.session.renew": "تجديد الجلسة",
  "platform.session.end": "إنهاء الجلسة",

  "platform.session.live.active": "جلسة الدعم نشطة.",
  "platform.session.live.expiring": "تنتهي جلسة الدعم قريبًا.",
  "platform.session.live.cap_reached": "بلغت جلسة الدعم حد التجديد.",
  "platform.session.live.expired": "انتهت جلسة الدعم.",
  "platform.session.live.renewed": "جُدّدت جلسة الدعم حتى {time}.",

  "platform.session.notice.expiring.title": "تنتهي جلسة الدعم بعد {duration}",
  "platform.session.notice.expiring.body":
    "لن تُمدَّد الجلسة تلقائيًا. جدّدها للاستمرار، أو أنهِها عند الانتهاء. حد التجديد: {cap}.",
  "platform.session.notice.expiringSoon.title": "تنتهي جلسة الدعم بعد أقل من دقيقة",
  "platform.session.notice.cap.title": "بلغت الجلسة حد التجديد",
  "platform.session.notice.cap.body":
    "لا يمكن تجديدها أكثر. لمتابعة العمل افتح جلسة دعم جديدة واذكر الغرض.",
  "platform.session.notice.expired.title": "انتهت جلسة الدعم",
  "platform.session.notice.expired.body":
    "انتهت مدة الجلسة دون تجديد، ولم تعد بيانات المؤسسة معروضة. لمتابعة العمل افتح جلسة جديدة من {directory}، وستحل محل هذه الجلسة. أو أنهِ الجلسة إن انتهيت.",
  "platform.session.notice.expired.directory": "صفحة المؤسسات",
  "platform.session.notice.expired.bodyHere":
    "انتهت مدة الجلسة دون تجديد، ولم تعد بيانات المؤسسة معروضة. لمتابعة العمل افتح جلسة جديدة من قائمة المؤسسات في هذه الصفحة، وستحل محل هذه الجلسة. أو أنهِ الجلسة إن انتهيت.",

  "platform.session.error.forbidden": "لا يمكن لحسابك تغيير هذه الجلسة.",
  "platform.session.error.originRejected":
    "رُفض الطلب لأن مصدره غير مقبول. أعد تحميل الصفحة وحاول مرة أخرى.",
  "platform.session.error.failed": "تعذّر إكمال الطلب. حاول مرة أخرى.",

  "platform.session.expiredBody.title": "انتهت جلسة الدعم",
  "platform.session.expiredBody.body":
    "لم يتغير شيء في المؤسسة، ولم تعد بياناتها معروضة. افتح جلسة جديدة من صفحة المؤسسات لمتابعة العمل.",
  "platform.session.expiredBody.action": "الانتقال إلى المؤسسات",

  "platform.session.readOnlyBody.title": "جلسة دعم للقراءة فقط",
  "platform.session.readOnlyBody.body":
    "الجلسة نشطة، لكن شاشات المؤسسة غير متاحة داخل جلسة الدعم بعد، فلا تُعرض بيانات المؤسسة ولا يوجد ما يمكن تعديله هنا.",
  "platform.session.readOnlyBody.action": "الانتقال إلى المؤسسات",

  "platform.tenants.title": "المؤسسات",
  "platform.tenants.sub":
    "كل المؤسسات على المنصة. افتح جلسة دعم لمؤسسة واحدة لتطّلع عليها للقراءة فقط.",
  "platform.tenants.suspendedNote": "المؤسسة الموقوفة تُفتح جلستها للقراءة فقط.",
  "platform.tenants.search.label": "ابحث باسم المؤسسة أو معرّفها",
  "platform.tenants.caption": "قائمة المؤسسات",
  "platform.tenants.col.tenant": "المؤسسة",
  "platform.tenants.col.action": "الإجراء",
  "platform.tenants.member": "أنت عضو فيها",
  "platform.tenants.action.start": "بدء جلسة دعم",
  "platform.tenants.action.startFor": "بدء جلسة دعم: {name}",
  "platform.tenants.action.switch": "فتح المؤسسة",
  "platform.tenants.action.switchFor": "فتح المؤسسة: {name}",
  "platform.tenants.count": "المعروض: {shown} من {total}",
  "platform.tenants.noMatch": "لا توجد مؤسسة تطابق «{query}».",
  "platform.tenants.error.failed": "تعذّر تحميل المؤسسات.",
  "platform.tenants.error.rateLimited":
    "تعذّر تحميل المؤسسات لأن الطلبات كثيرة جدًا. أعد المحاولة بعد انتهاء العدّ.",
  "platform.tenants.retry": "إعادة المحاولة",
  "platform.tenants.error.switch": "تعذّر فتح المؤسسة لأن الطلب لم يصل. حاول مرة أخرى.",
  "platform.tenants.error.switchRefused":
    "لم تُفتح المؤسسة: رفض الخادم التبديل إليها، ولم يتغير شيء.",
  "platform.tenants.error.switchUnconfirmed":
    "تعذّر التأكد من فتح المؤسسة لأن قراءة الحالة بعد التبديل لم تكتمل. أعد تحميل الصفحة للتحقق.",

  "platform.start.title": "جلسة دعم: {name}",
  "platform.start.required": "(إلزامي)",
  "platform.start.optional": "(اختياري)",
  "platform.start.purpose.label": "الغرض",
  "platform.start.purpose.placeholder": "اختر الغرض",
  "platform.start.purpose.required": "اختر غرض الجلسة.",
  "platform.start.ticket.label": "مرجع التذكرة",
  "platform.start.ticket.hint":
    "حتى 64 حرفًا: حروف إنجليزية وأرقام و . _ : # / - فقط، بدون مسافات. يظهر لمالك المؤسسة في سجل التدقيق، فلا تضع فيه بيانات العملاء.",
  "platform.start.ticket.invalid":
    "مرجع التذكرة غير صالح: ابدأ بحرف أو رقم، واستخدم حروفًا إنجليزية وأرقامًا و . _ : # / - فقط، حتى 64 حرفًا.",
  "platform.start.scope.label": "النطاق",
  "platform.start.scope.body": "للقراءة فقط: لا يُعدَّل شيء في المؤسسة من جلسة الدعم.",
  "platform.start.duration.label": "المدة",
  "platform.start.duration.body":
    "60 دقيقة، ولا تُمدَّد تلقائيًا. كل تجديد يمدّها حتى 60 دقيقة، دون تجاوز 8 ساعات من بدء الجلسة.",
  "platform.start.suspended.label": "مؤسسة موقوفة",
  "platform.start.suspended.body": "إن كانت المؤسسة موقوفة فالجلسة للقراءة فقط.",
  "platform.start.replaces": "لديك جلسة دعم حالية. بدء هذه الجلسة يُنهي الجلسة الحالية.",
  "platform.start.submit": "بدء جلسة الدعم",
  "platform.start.error.forbidden": "لا يمكن لحسابك فتح جلسة دعم. لم تبدأ أي جلسة.",
  "platform.start.error.failed": "تعذّر بدء الجلسة، ولم تبدأ أي جلسة. حاول مرة أخرى.",
  "platform.start.error.rateLimited":
    "الطلبات كثيرة جدًا، ولم تبدأ أي جلسة. انتظر حتى ينتهي العدّ على الزر ثم حاول مرة أخرى.",
  "platform.start.notFound.title": "المؤسسة غير متاحة",
  "platform.start.notFound.body": "لا يمكن فتح هذه المؤسسة. لم تبدأ أي جلسة ولم يتغير شيء.",
  "platform.start.notFound.back": "العودة إلى المؤسسات",
  "platform.start.member.title": "أنت عضو في هذه المؤسسة",
  "platform.start.member.body": "لا تحتاج إلى جلسة دعم لها، ولم تبدأ أي جلسة.",
  "platform.start.member.switch": "استخدم تبديل المؤسسة العادي",
} satisfies Messages;
