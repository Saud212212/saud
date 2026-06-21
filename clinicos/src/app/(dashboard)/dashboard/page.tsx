import { requireRole } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** لوحة مدير العيادة (clinic_admin). */
export default async function ClinicDashboardPage() {
  await requireRole(["clinic_admin"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>لوحة مدير العيادة</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        من هنا سيدير مدير العيادة بيانات عيادته وفريقه واشتراكه. (قيد الإنشاء)
      </CardContent>
    </Card>
  );
}
