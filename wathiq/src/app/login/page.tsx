import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { devLogin } from "../actions";
import { DEV_ORGS, DEV_USERS } from "@/server/dev-users";
import { getSession } from "@/server/auth/session";
import { devLoginEnabled } from "@/server/auth/dev-login";
import { LogoMark } from "@/components/logo";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/tenders");
  const t = await getTranslations("login");
  const tApp = await getTranslations("app");
  const enabled = devLoginEnabled();

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12" />
          <h1 className="mt-4 text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{tApp("tagline")}</p>
        </div>
        <Card className="p-5">
          {!enabled ? (
            <p className="text-sm text-muted">{t("disabled")}</p>
          ) : (
            <>
              <p className="mb-4 rounded-lg bg-accent-soft px-3 py-2 text-xs leading-6 text-ink-2">{t("devNote")}</p>
              <div className="space-y-2">
                {DEV_USERS.map((u) => (
                  <form key={u.id} action={devLogin}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button className="flex w-full items-center justify-between gap-3 rounded-lg border border-line px-4 py-3 text-start transition-colors hover:border-brand hover:bg-brand-soft">
                      <span>
                        <span className="block text-sm font-medium">{u.name}</span>
                        <span className="block text-xs text-muted">{DEV_ORGS.find((o) => o.id === u.orgId)?.name}</span>
                      </span>
                      <span className="text-xs text-muted">{t(`roles.${u.role}`)}</span>
                    </button>
                  </form>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
