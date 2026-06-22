import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Placeholder for feature modules scaffolded but not yet built out.
// The schema, RLS and helpers they depend on are already in place.
export function ComingSoon({ feature }: { feature: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Construction className="size-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{feature}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          This module is scaffolded as part of the ClinicOS foundation. Its data model,
          RLS policies and permissions are ready — the UI is the next build step.
        </p>
      </CardContent>
    </Card>
  );
}
