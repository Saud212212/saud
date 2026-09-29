/**
 * مستخدمون ومؤسسات تجريبية بمعرّفات ثابتة — للتطوير والاختبار في المراحل 1–4 فقط.
 * تُستبدل بتسجيل دخول حقيقي (Better Auth) ودعوات في المرحلة 5.
 */
export const DEV_ORGS = [
  { id: "0b6f1d6e-1111-4a0c-9c1e-000000000001", name: "شركة الأفق للمقاولات" },
  { id: "0b6f1d6e-2222-4a0c-9c1e-000000000002", name: "مجموعة النخبة للتشغيل والصيانة" },
] as const;

export const DEV_USERS = [
  { id: "7a1c0000-0000-4000-8000-000000000001", email: "owner@alofoq.test", name: "سارة العتيبي", orgId: DEV_ORGS[0].id, role: "owner" },
  { id: "7a1c0000-0000-4000-8000-000000000002", email: "editor@alofoq.test", name: "خالد الشهري", orgId: DEV_ORGS[0].id, role: "editor" },
  { id: "7a1c0000-0000-4000-8000-000000000003", email: "owner@alnokhba.test", name: "ريم القحطاني", orgId: DEV_ORGS[1].id, role: "owner" },
] as const;
