"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterConfig = {
  /** اسم المعامل في الرابط (param key). */
  name: string;
  label: string;
  options: { value: string; label: string }[];
};

type Props = {
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  /** زر إجراء (مثل إضافة) يظهر في طرف الشريط. */
  action?: React.ReactNode;
};

/**
 * شريط أدوات لجدول البيانات: بحث + فلاتر، يحدّث معاملات الرابط (URL)
 * فيُعاد تحميل الصفحة من الخادم مع تطبيق RLS والترقيم.
 */
export function ListToolbar({ searchPlaceholder, filters, action }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page"); // أي تغيير بحث/فلترة يعيد للصفحة الأولى
    router.push(`${pathname}?${next.toString()}`);
  }

  function onSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get("q");
    setParam("q", typeof value === "string" ? value.trim() : "");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form onSubmit={onSearchSubmit} className="flex-1 min-w-48">
        <Input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder={searchPlaceholder ?? "بحث…"}
        />
      </form>

      {filters?.map((f) => (
        <Select
          key={f.name}
          defaultValue={params.get(f.name) ?? "all"}
          onValueChange={(v) => setParam(f.name, v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={f.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{f.label}: الكل</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {action && <div className="ms-auto">{action}</div>}
    </div>
  );
}
