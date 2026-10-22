/**
 * Platform console strings that belong to the support session (RT-781, RT-777
 * S2): the session bar and its lifecycle states. The `/platform` shell and the
 * no-access state keep their keys in shell.ts (RT-780).
 */
import type { Messages } from "../types";

export const platform = {
  "platform.session.region": "جلسة الدعم",
  "platform.session.badge": "وصول دعم",
  "platform.session.tenant": "تعمل الآن داخل: {name}",
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
    "انتهت مدة الجلسة دون تجديد، ولم تعد بيانات المؤسسة معروضة. أنهِ الجلسة ثم افتح جلسة جديدة من دليل المؤسسات.",

  "platform.session.error.forbidden": "لا يمكن لحسابك تغيير هذه الجلسة.",
  "platform.session.error.originRejected":
    "رُفض الطلب لأن مصدره غير مقبول. أعد تحميل الصفحة وحاول مرة أخرى.",
  "platform.session.error.failed": "تعذّر إكمال الطلب. حاول مرة أخرى.",

  "platform.session.expiredBody.title": "انتهت جلسة الدعم",
  "platform.session.expiredBody.body":
    "لم يتغير شيء في المؤسسة، ولم تعد بياناتها معروضة. افتح جلسة جديدة من دليل المؤسسات لمتابعة العمل.",
  "platform.session.expiredBody.action": "الانتقال إلى المؤسسات",

  "platform.session.readOnlyBody.title": "جلسة دعم للقراءة فقط",
  "platform.session.readOnlyBody.body":
    "الجلسة نشطة، لكن شاشات المؤسسة غير متاحة داخل جلسة الدعم بعد، فلا تُعرض بيانات المؤسسة ولا يوجد ما يمكن تعديله هنا.",
  "platform.session.readOnlyBody.action": "الانتقال إلى المؤسسات",
} satisfies Messages;
