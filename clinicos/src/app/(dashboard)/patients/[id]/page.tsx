import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";
import {
  canViewClinical,
  canWriteMedicalRecord,
  canWritePrescription,
  canManageAppointments,
  canUploadFiles,
} from "@/types/rbac";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MedicalRecordForm } from "./medical-record-form";
import { PrescriptionDialog } from "./prescription-dialog";
import { AppointmentDialog, type DoctorOption } from "./appointment-dialog";
import { FileUpload } from "./file-upload";
import { FileDownloadButton } from "./file-download-button";

const GENDER: Record<string, string> = { male: "ذكر", female: "أنثى" };
const APPT_STATUS: Record<string, string> = {
  scheduled: "مجدول",
  completed: "مكتمل",
  cancelled: "ملغى",
  no_show: "لم يحضر",
};
const FILE_TYPE: Record<string, string> = {
  pdf: "PDF",
  xray: "أشعة",
  lab: "تحاليل",
  other: "أخرى",
};

type Med = { name: string; dose?: string | null; frequency?: string | null };

export default async function PatientFilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .single();
  if (!patient) notFound();

  const showClinical = canViewClinical(user.role);

  // جلب الأقسام بالتوازي
  const [
    medicalRes,
    prescriptionsRes,
    filesRes,
    appointmentsRes,
    invoicesRes,
    doctorsRes,
  ] = await Promise.all([
    showClinical
      ? supabase.from("medical_records").select("*").eq("patient_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    showClinical
      ? supabase
          .from("prescriptions")
          .select("id, medications, dosage, notes, date, doctors(full_name)")
          .eq("patient_id", id)
          .order("date", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("files")
      .select("id, file_name, file_type, created_at")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("appointments")
      .select("id, scheduled_at, status, notes, doctors(full_name)")
      .eq("patient_id", id)
      .order("scheduled_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, amount, status")
      .eq("patient_id", id)
      .order("invoice_number", { ascending: false })
      .limit(10),
    supabase.from("doctors").select("id, full_name").eq("is_active", true),
  ]);

  const medical = medicalRes.data;
  const prescriptions = prescriptionsRes.data ?? [];
  const files = filesRes.data ?? [];
  const appointments = appointmentsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const doctorOptions: DoctorOption[] = (doctorsRes.data ?? []).map((d) => ({
    id: d.id,
    label: d.full_name,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* بيانات المريض */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            {patient.full_name}
            <Badge variant="outline">ملف #{patient.file_number}</Badge>
            {!patient.is_active && <Badge variant="outline">مؤرشف</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Info label="الهاتف" value={patient.phone} dir="ltr" />
          <Info label="الجنس" value={patient.gender ? GENDER[patient.gender] : null} />
          <Info label="العمر" value={patient.age?.toString()} />
          <Info label="تاريخ الميلاد" value={patient.date_of_birth} dir="ltr" />
          <Info label="البريد" value={patient.email} dir="ltr" />
          <Info label="العنوان" value={patient.address} />
        </CardContent>
      </Card>

      {/* السجل الطبي (سريري) */}
      {showClinical && (
        <Card>
          <CardHeader>
            <CardTitle>السجل الطبي</CardTitle>
          </CardHeader>
          <CardContent>
            <MedicalRecordForm
              patientId={id}
              record={medical}
              canWrite={canWriteMedicalRecord(user.role)}
            />
          </CardContent>
        </Card>
      )}

      {/* الوصفات (سريري) */}
      {showClinical && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>الوصفات الطبية</CardTitle>
            {canWritePrescription(user.role) && (
              <PrescriptionDialog
                patientId={id}
                trigger={
                  <Button size="sm">
                    <Plus className="size-4" />
                    وصفة
                  </Button>
                }
              />
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {prescriptions.length === 0 ? (
              <p className="text-muted-foreground text-sm">لا توجد وصفات.</p>
            ) : (
              prescriptions.map((p) => {
                const meds = (p.medications as unknown as Med[]) ?? [];
                const doctor = Array.isArray(p.doctors) ? p.doctors[0] : p.doctors;
                return (
                  <div key={p.id} className="rounded-md border p-3 text-sm">
                    <div className="text-muted-foreground mb-1 flex justify-between text-xs">
                      <span>{p.date}</span>
                      <span>{doctor?.full_name ?? ""}</span>
                    </div>
                    <ul className="list-inside list-disc">
                      {meds.map((m, i) => (
                        <li key={i}>
                          {m.name}
                          {m.dose ? ` — ${m.dose}` : ""}
                          {m.frequency ? ` (${m.frequency})` : ""}
                        </li>
                      ))}
                    </ul>
                    {p.dosage && <p className="mt-1">{p.dosage}</p>}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {/* المواعيد */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>المواعيد</CardTitle>
          {canManageAppointments(user.role) && (
            <AppointmentDialog
              patientId={id}
              doctors={doctorOptions}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  موعد
                </Button>
              }
            />
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {appointments.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد مواعيد.</p>
          ) : (
            appointments.map((a) => {
              const doctor = Array.isArray(a.doctors) ? a.doctors[0] : a.doctors;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span dir="ltr">{new Date(a.scheduled_at).toLocaleString("ar")}</span>
                  <span className="text-muted-foreground">{doctor?.full_name ?? "—"}</span>
                  <Badge variant="secondary">{APPT_STATUS[a.status] ?? a.status}</Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* الملفات */}
      <Card>
        <CardHeader>
          <CardTitle>الملفات والمرفقات</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {canUploadFiles(user.role) && <FileUpload patientId={id} />}
          {files.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد ملفات.</p>
          ) : (
            files.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <span>{f.file_name}</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{FILE_TYPE[f.file_type] ?? f.file_type}</Badge>
                  <FileDownloadButton fileId={f.id} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* الفواتير */}
      <Card>
        <CardHeader>
          <CardTitle>الفواتير</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {invoices.length === 0 ? (
            <p className="text-muted-foreground text-sm">لا توجد فواتير.</p>
          ) : (
            invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <span className="font-mono">#{inv.invoice_number}</span>
                <span>{Number(inv.amount).toFixed(2)} ر.س</span>
                <Badge variant="outline">{inv.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({
  label,
  value,
  dir,
}: {
  label: string;
  value: string | null | undefined;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p dir={dir} className={dir === "ltr" ? "text-start" : undefined}>
        {value || "—"}
      </p>
    </div>
  );
}
