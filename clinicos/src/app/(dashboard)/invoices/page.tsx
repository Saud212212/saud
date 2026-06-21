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
import { InvoiceFormDialog, type PatientOption } from "./invoice-form-dialog";
import { InvoiceRowActions } from "./invoice-row-actions";

const PAGE_SIZE = 10;

type Item = { description: string; quantity: number; unit_price: number };

const STATUS: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  paid: { label: "مدفوعة", variant: "secondary" },
  partially_paid: { label: "مدفوعة جزئياً", variant: "outline" },
  unpaid: { label: "غير مدفوعة", variant: "destructive" },
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const canManage = canManagePatients(user.role);

  const supabase = await createClient();

  // قائمة المرضى لنماذج الإنشاء/التعديل
  const { data: patientRows } = await supabase
    .from("patients")
    .select("id, full_name, file_number")
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .limit(1000);
  const patientOptions: PatientOption[] = (patientRows ?? []).map((p) => ({
    id: p.id,
    label: `${p.full_name} (#${p.file_number})`,
  }));

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, status, patient_id, items, created_at, patients(full_name, file_number), payments(amount)",
      { count: "exact" },
    );

  if (status) query = query.eq("status", status);
  if (q && /^\d+$/.test(q)) query = query.eq("invoice_number", Number(q));

  const { data, count, error } = await query
    .order("invoice_number", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const invoices = data ?? [];
  const total = count ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">الفواتير</h1>

      <ListToolbar
        searchPlaceholder="ابحث برقم الفاتورة…"
        filters={[
          {
            name: "status",
            label: "الحالة",
            options: [
              { value: "unpaid", label: "غير مدفوعة" },
              { value: "partially_paid", label: "مدفوعة جزئياً" },
              { value: "paid", label: "مدفوعة" },
            ],
          },
        ]}
        action={
          canManage ? (
            <InvoiceFormDialog
              mode="create"
              patients={patientOptions}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  إنشاء فاتورة
                </Button>
              }
            />
          ) : null
        }
      />

      {error ? (
        <p className="text-destructive text-sm">تعذّر تحميل الفواتير: {error.message}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>المريض</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>المدفوع</TableHead>
                <TableHead>الحالة</TableHead>
                {canManage && <TableHead className="text-end">إجراءات</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 6 : 5}
                    className="text-muted-foreground py-8 text-center"
                  >
                    لا توجد فواتير مطابقة.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => {
                  const patient = Array.isArray(inv.patients)
                    ? inv.patients[0]
                    : inv.patients;
                  const paid = (inv.payments ?? []).reduce(
                    (s: number, p: { amount: number }) => s + Number(p.amount),
                    0,
                  );
                  const st = STATUS[inv.status] ?? {
                    label: inv.status,
                    variant: "outline" as const,
                  };
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono">{inv.invoice_number}</TableCell>
                      <TableCell className="font-medium">
                        {patient?.full_name ?? "—"}
                      </TableCell>
                      <TableCell>{Number(inv.amount).toFixed(2)} ر.س</TableCell>
                      <TableCell>{paid.toFixed(2)} ر.س</TableCell>
                      <TableCell>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <InvoiceRowActions
                            invoice={{
                              id: inv.id,
                              patient_id: inv.patient_id,
                              items: (inv.items as unknown as Item[]) ?? [],
                              amount: Number(inv.amount),
                              paid,
                              status: inv.status,
                            }}
                            patients={patientOptions}
                          />
                        </TableCell>
                      )}
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
