/** تنسيقات العرض. الأرقام لاتينية في الواجهة العربية (المعتاد في وثائق منصة اعتماد). */
export const intlLocale = (locale: string) => (locale === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB");

export function formatDate(d: Date | string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" }).format(new Date(d));
}

export function formatBytes(n: number, locale: string) {
  const units = locale === "ar" ? ["بايت", "ك.ب", "م.ب", "ج.ب"] : ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
