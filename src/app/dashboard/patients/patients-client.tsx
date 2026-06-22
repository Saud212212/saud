"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const patientSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  gender: z.enum(["male", "female"]).optional(),
  date_of_birth: z.string().optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

export function PatientsClient({ clinicId }: { clinicId: string }) {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Patient[];
    },
  });

  const { register, handleSubmit, reset, formState } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
  });

  const createPatient = useMutation({
    mutationFn: async (values: PatientForm) => {
      const { error } = await supabase.from("patients").insert({
        clinic_id: clinicId,
        full_name: values.full_name,
        phone: values.phone || null,
        email: values.email || null,
        gender: values.gender || null,
        date_of_birth: values.date_of_birth || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Patient added");
      reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = patients.filter((p) =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    p.file_number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or file number…"
            className="ps-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="size-4" />
          Add patient
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New patient</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={handleSubmit((v) => createPatient.mutate(v))}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" {...register("full_name")} />
                {formState.errors.full_name && (
                  <p className="text-xs text-destructive">{formState.errors.full_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  className="flex h-10 w-full rounded-md border border-[var(--input)] bg-background px-3 text-sm"
                  {...register("gender")}
                >
                  <option value="">—</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_of_birth">Date of birth</Label>
                <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" disabled={createPatient.isPending}>
                  {createPatient.isPending ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Patients ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No patients yet. Add your first one.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-start text-muted-foreground">
                    <th className="px-2 py-2 text-start font-medium">File #</th>
                    <th className="px-2 py-2 text-start font-medium">Name</th>
                    <th className="px-2 py-2 text-start font-medium">Phone</th>
                    <th className="px-2 py-2 text-start font-medium">Gender</th>
                    <th className="px-2 py-2 text-start font-medium">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-2 py-3">
                        <Badge variant="outline">{p.file_number}</Badge>
                      </td>
                      <td className="px-2 py-3 font-medium">{p.full_name}</td>
                      <td className="px-2 py-3 text-muted-foreground">{p.phone ?? "—"}</td>
                      <td className="px-2 py-3 capitalize text-muted-foreground">{p.gender ?? "—"}</td>
                      <td className="px-2 py-3 text-muted-foreground">{p.age ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
