import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export const LOCALES = ["ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** العربية افتراضية؛ الإنجليزية باختيار المستخدم (كوكي). */
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale: Locale = store.get(LOCALE_COOKIE)?.value === "en" ? "en" : "ar";
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});
