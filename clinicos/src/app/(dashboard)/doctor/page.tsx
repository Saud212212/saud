import { requireRole } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** لوحة الطبيب (doctor). */
export default async function DoctorPage() {
  await requireRole(["doctor"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>لوحة الطبيب</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        من هنا سيتابع الطبيب مرضاه ومواعيده ضمن عيادته. (قيد الإنشاء)
      </CardContent>
    </Card>
  );
}
