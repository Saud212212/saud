import { requireUser } from "@/lib/auth";
import { PatientsClient } from "./patients-client";

export default async function PatientsPage() {
  const user = await requireUser("clinic_admin");
  // clinic_id is needed when inserting new patients.
  return <PatientsClient clinicId={user.clinic_id!} />;
}
