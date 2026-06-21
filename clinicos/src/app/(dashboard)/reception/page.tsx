import { requireRole } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** لوحة موظف الاستقبال (receptionist). */
export default async function ReceptionPage() {
  await requireRole(["receptionist"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>لوحة الاستقبال</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        من هنا سيدير موظف الاستقبال المواعيد واستقبال المرضى في العيادة. (قيد
        الإنشاء)
      </CardContent>
    </Card>
  );
}
