import { NextResponse } from "next/server";
import { api } from "@/server/http";
import { ctxOf, requestMeta } from "@/server/auth/session";
import { createTender, listTenders, type TenderFileRole } from "@/server/services/tenders";
import { invalid } from "@/server/errors";

export const runtime = "nodejs";

const ROLES: TenderFileRole[] = ["booklet", "annex", "boq", "other"];

export const GET = api(async (s) => NextResponse.json(await listTenders(ctxOf(s))));

/** multipart/form-data: title, reference, agency, files[] و roles[] بنفس الترتيب. */
export const POST = api(async (s, req: Request) => {
  const form = await req.formData().catch(() => {
    throw invalid("expected multipart/form-data");
  });
  const blobs = form.getAll("files").filter((f): f is File => f instanceof File);
  const roles = form.getAll("roles").map(String);
  const files = await Promise.all(
    blobs.map(async (f, i) => ({
      name: f.name,
      mime: f.type,
      data: Buffer.from(await f.arrayBuffer()),
      role: (ROLES.includes(roles[i] as TenderFileRole) ? roles[i] : "booklet") as TenderFileRole,
    })),
  );
  const res = await createTender(
    ctxOf(s),
    {
      title: String(form.get("title") ?? ""),
      referenceNumber: String(form.get("reference") ?? "") || null,
      agency: String(form.get("agency") ?? "") || null,
      files,
    },
    await requestMeta(),
  );
  return NextResponse.json(res, { status: 201 });
});
