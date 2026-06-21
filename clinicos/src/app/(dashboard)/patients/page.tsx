import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import { canManagePatients } from "@/types/rbac";
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
import { PatientFormDialog } from "./patient-form-dialog";
import { PatientRowActions } from "./patient-row-actions";

const PAGE_SIZE = 10;

const GENDER_LABEL: Record<string, string> = {
  male: "ذكر",
  female: "أنثى",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "active";
  const page = Math.max(1, Number(sp.page) || 1);
  const canManage = canManagePatients(user.role);

  const supabase = await createClient();
  let query = supabase.from("patients").select("*", { count: "exact" });

  // فلترة الحالة (افتراضي: النشطون)
  if (status === "active") query = query.eq("is_active", true);
  else if (status === "archived") query = query.eq("is_active", false);

  // البحث في الاسم/الهاتف، ورقم الملف إن كان رقماً
  if (q) {
    const ors = [`full_name.ilike.%${q}%`, `phone.ilike.%${q}%`];
    if (/^\d+$/.test(q)) ors.push(`file_number.eq.${q}`);
    query = query.or(ors.join(","));
  }

  const { data, count, error } = await query
    .order("file_number", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const patients = data ?? [];
  const total = count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">المرضى</h1>
      </div>

      <ListToolbar
        searchPlaceholder="ابحث بالاسم أو الهاتف أو رقم الملف…"
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
            <PatientFormDialog
              mode="create"
              trigger={
                <Button>
                  <Plus className="size-4" />
                  إضافة مريض
                </Button>
              }
            />
          ) : null
        }
      />

      {error ? (
        <p className="text-destructive text-sm">تعذّر تحميل المرضى: {error.message}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الملف</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>الهاتف</TableHead>
                <TableHead>الجنس</TableHead>
                <TableHead>العمر</TableHead>
                <TableHead>الحالة</TableHead>
                {canManage && <TableHead className="text-end">إجراءات</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 7 : 6}
                    className="text-muted-foreground py-8 text-center"
                  >
                    لا يوجد مرضى مطابقون.
                  </TableCell>
                </TableRow>
              ) : (
                patients.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono">{p.file_number}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/patients/${p.id}`} className="hover:underline">
                        {p.full_name}
                      </Link>
                    </TableCell>
                    <TableCell dir="ltr" className="text-start">
                      {p.phone ?? "—"}
                    </TableCell>
                    <TableCell>{p.gender ? GENDER_LABEL[p.gender] : "—"}</TableCell>
                    <TableCell>{p.age ?? "—"}</TableCell>
                    <TableCell>
                      {p.is_active ? (
                        <Badge variant="secondary">نشط</Badge>
                      ) : (
                        <Badge variant="outline">مؤرشف</Badge>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <PatientRowActions patient={p} />
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
