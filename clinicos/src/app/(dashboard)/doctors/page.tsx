import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { canManageDoctors } from "@/types/rbac";
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
import { DoctorFormDialog } from "./doctor-form-dialog";
import { DoctorRowActions } from "./doctor-row-actions";

const PAGE_SIZE = 10;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "active";
  const page = Math.max(1, Number(sp.page) || 1);
  const canManage = canManageDoctors(user.role);

  const supabase = await createClient();
  let query = supabase.from("doctors").select("*", { count: "exact" });

  if (status === "active") query = query.eq("is_active", true);
  else if (status === "archived") query = query.eq("is_active", false);

  if (q) {
    query = query.or(
      [`full_name.ilike.%${q}%`, `phone.ilike.%${q}%`, `specialty.ilike.%${q}%`].join(","),
    );
  }

  const { data, count, error } = await query
    .order("full_name", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const doctors = data ?? [];
  const total = count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">الأطباء</h1>

      <ListToolbar
        searchPlaceholder="ابحث بالاسم أو التخصص أو الهاتف…"
        filters={[
          {
            name: "status",
            label: "الحالة",
            options: [
              { value: "active", label: "النشطون" },
              { value: "archived", label: "المؤرشفون" },
              { value: "all", label: "الكل" },
            ],
          },
        ]}
        action={
          canManage ? (
            <DoctorFormDialog
              mode="create"
              trigger={
                <Button>
                  <Plus className="size-4" />
                  إضافة طبيب
                </Button>
              }
            />
          ) : null
        }
      />

      {error ? (
        <p className="text-destructive text-sm">تعذّر تحميل الأطباء: {error.message}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>التخصص</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>رقم الترخيص</TableHead>
                <TableHead>الحالة</TableHead>
                {canManage && <TableHead className="text-end">إجراءات</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 6 : 5}
                    className="text-muted-foreground py-8 text-center"
                  >
                    لا يوجد أطباء مطابقون.
                  </TableCell>
                </TableRow>
              ) : (
                doctors.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.full_name}</TableCell>
                    <TableCell>{d.specialty ?? "—"}</TableCell>
                    <TableCell dir="ltr" className="text-start">
                      {d.phone ?? "—"}
                    </TableCell>
                    <TableCell>{d.license_number ?? "—"}</TableCell>
                    <TableCell>
                      {d.is_active ? (
                        <Badge variant="secondary">نشط</Badge>
                      ) : (
                        <Badge variant="outline">مؤرشف</Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <DoctorRowActions doctor={d} />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
