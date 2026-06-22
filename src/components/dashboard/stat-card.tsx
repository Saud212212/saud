import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  title: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function StatCard({ title, value, hint, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
