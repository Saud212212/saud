import { Pencil } from "lucide-react";
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
import { StaffFormDialog } from "./staff-form-dialog";

const PAGE_SIZE = 10;

const ROLE_LABEL: Record<string, string> = {
  clinic_admin: "مدير العيادة",
  doctor: "طبيب",
  receptionist: "موظف استقبال",
  super_admin: "مدير المنصّة",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function StaffPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // صفحة إدارة الموظفين متاحة لمدير العيادة فقط
  await requireRole(["clinic_admin"]);
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const roleFilter = typeof sp.role === "string" ? sp.role : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("users")
    .select("id, email, full_name, is_active, roles(name)", { count: "exact" });

  if (q) {
    query = query.or([`full_name.ilike.%${q}%`, `email.ilike.%${q}%`].join(","));
  }

  // فلترة حسب الدور (عبر معرّف الدور)
  if (roleFilter) {
    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("name", roleFilter)
      .single();
    if (role) query = query.eq("role_id", role.id);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const members = data ?? [];
  const total = count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">الموظفون</h1>
        <p className="text-muted-foreground text-sm">
          إدارة المستخدمين الحاليين وأدوارهم. (إنشاء حسابات دخول جديدة يأتي في مرحلة لاحقة)
        </p>
      </div>

      <ListToolbar
        searchPlaceholder="ابحث بالاسم أو البريد…"
        filters={[
          {
            name: "role",
            label: "الدور",
            options: [
              { value: "clinic_admin", label: "مدير العيادة" },
              { value: "doctor", label: "طبيب" },
              { value: "receptionist", label: "موظف استقبال" },
            ],
          },
        ]}
      />

      {error ? (
        <p className="text-destructive text-sm">تعذّر تحميل الموظفين: {error.message}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead className="text-end">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground py-8 text-center"
                  >
                    لا يوجد موظفون مطابقون.
                  </TableCell>
                </TableRow>
              ) : (
                members.map((m) => {
                  const roleName = m.roles?.name ?? "";
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {m.full_name ?? "—"}
                      </TableCell>
                      <TableCell dir="ltr" className="text-start">
                        {m.email}
                      </TableCell>
                      <TableCell>{ROLE_LABEL[roleName] ?? roleName}</TableCell>
                      <TableCell>
                        {m.is_active ? (
                          <Badge variant="secondary">مُفعّل</Badge>
                        ) : (
                          <Badge variant="outline">معطّل</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <StaffFormDialog
                            member={{
                              id: m.id,
                              email: m.email,
                              full_name: m.full_name,
                              role: roleName,
                              is_active: m.is_active,
                            }}
                            trigger={
                              <Button variant="ghost" size="icon" aria-label="تعديل">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                        </div>
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
