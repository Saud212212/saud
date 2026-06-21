import { requireRole } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** لوحة مدير المنصّة (super_admin فقط). */
export default async function AdminPage() {
  await requireRole(["super_admin"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>لوحة مدير المنصّة</CardTitle>
      </CardHeader>
      <CardContent className="text-muted-foreground">
        من هنا سيرى مدير المنصّة كل العيادات والاشتراكات. (قيد الإنشاء)
      </CardContent>
    </Card>
  );
}
