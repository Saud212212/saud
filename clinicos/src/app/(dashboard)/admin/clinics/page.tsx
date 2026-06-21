import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListToolbar } from "@/components/data-table/list-toolbar";
import { Pagination } from "@/components/data-table/pagination";
import { ClinicFormDialog } from "./clinic-form-dialog";

const PAGE_SIZE = 10;

const STATUS_LABEL: Record<string, string> = {
  trialing: "تجريبي",
  active: "نشط",
  past_due: "متأخر",
  canceled: "ملغى",
  incomplete: "غير مكتمل",
  unpaid: "غير مدفوع",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function ClinicsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // إدارة العيادات متاحة لمدير المنصّة فقط
  await requireRole(["super_admin"]);
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("clinics")
    .select("id, name, slug, is_active, created_at, subscriptions(status, plan)", {
      count: "exact",
    });

  if (q) {
    query = query.or([`name.ilike.%${q}%`, `slug.ilike.%${q}%`].join(","));
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const clinics = data ?? [];
  const total = count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">العيادات</h1>

      <ListToolbar
        searchPlaceholder="ابحث بالاسم أو المُعرّف…"
        action={
          <ClinicFormDialog
            trigger={
              <Button>
                <Plus className="size-4" />
                إنشاء عيادة
              </Button>
            }
          />
        }
      />

      {error ? (
        <p className="text-destructive text-sm">تعذّر تحميل العيادات: {error.message}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>المُعرّف</TableHead>
                <TableHead>الخطة</TableHead>
                <TableHead>حالة الاشتراك</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinics.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground py-8 text-center"
                  >
                    لا توجد عيادات بعد.
                  </TableCell>
                </TableRow>
              ) : (
                clinics.map((c) => {
                  const sub = Array.isArray(c.subscriptions)
                    ? c.subscriptions[0]
                    : c.subscriptions;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell dir="ltr" className="text-start font-mono text-xs">
                        {c.slug}
                      </TableCell>
                      <TableCell className="uppercase">{sub?.plan ?? "—"}</TableCell>
                      <TableCell>
                        {sub ? (
                          <Badge
                            variant={
                              sub.status === "active" || sub.status === "trialing"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {STATUS_LABEL[sub.status] ?? sub.status}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {c.is_active ? (
                          <Badge variant="secondary">مفعّلة</Badge>
                        ) : (
                          <Badge variant="outline">معطّلة</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
