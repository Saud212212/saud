import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathForRole } from "@/types/rbac";

/**
 * الجذر: يوجّه المستخدم إلى لوحته حسب دوره، أو إلى تسجيل الدخول.
 */
export default async function RootPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  redirect(homePathForRole(user.role));
}
