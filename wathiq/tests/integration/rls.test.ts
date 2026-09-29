/**
 * إثبات عزل البيانات بين الشركات على مستوى قاعدة البيانات (RLS)، بما في ذلك مهام العامل.
 * كل الاستعلامات هنا عبر دور wathiq_app (DATABASE_URL)، والتحقق من وجود بيانات الشركة الأخرى
 * فعلاً يتم عبر اتصال superuser منفصل حتى لا يكون الاختبار فارغاً.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { sql } from "drizzle-orm";
import { closeDb, withOrg } from "@/server/db/client";
import { closeKeystore, getTenderKey, TenderKeyMissingError } from "@/server/crypto/keystore";
import { createTender, getPageContent, getTenderDetail, hardDeleteTender, listChunks, listTenders, readTenderFile } from "@/server/services/tenders";
import { processOne } from "@/worker/run";
import { seed } from "../../scripts/seed";
import { APP_URL } from "../test-env";
import { admin, drainQueue, fixture, orgA, orgB, ownerA, ownerB } from "./helpers";

/** Drizzle يغلّف خطأ Postgres؛ الرسالة الأصلية في cause. */
const causedBy = (re: RegExp) => (e: unknown) => re.test(String((e as { cause?: Error })?.cause?.message ?? e));

/** كل الجداول التي تحمل بيانات مؤسسة. */
const TENANT_TABLES = ["tenders", "files", "tender_files", "document_pages", "chunks", "processing_jobs", "audit_logs", "tender_keys", "memberships"];

let tenderA: string;
let tenderB: string;
let tfB: string;
let fileB: string;

beforeAll(async () => {
  await seed();
  tenderA = (await createTender(ownerA, { title: "منافسة أ", files: [fixture("text")] })).tenderId;
  tenderB = (await createTender(ownerB, { title: "منافسة ب السرية", files: [fixture("text")] })).tenderId;
  expect(await drainQueue()).toEqual(["succeeded", "succeeded"]);
  const d = await getTenderDetail(ownerB, tenderB);
  tfB = d.files[0].id;
  fileB = d.files[0].fileId;
});

afterAll(async () => {
  await closeDb();
  await closeKeystore();
});

describe("database roles", () => {
  it("the app connects as a non-owner role without BYPASSRLS", async () => {
    const c = new pg.Client({ connectionString: APP_URL });
    await c.connect();
    const r = await c.query(`select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user`);
    const owned = await c.query(
      `select count(*)::int n from pg_tables where schemaname = 'public' and tableowner = current_user`,
    );
    await c.end();
    expect(r.rows[0]).toEqual({ rolname: "wathiq_app", rolsuper: false, rolbypassrls: false });
    expect(owned.rows[0].n).toBe(0);
  });

  it("every table with org_id has RLS enabled AND forced (catches future tables)", async () => {
    const rows = await admin((c) =>
      c.query<{ table: string; rls: boolean; force: boolean }>(`
        select c.relname as table, c.relrowsecurity as rls, c.relforcerowsecurity as force
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and exists (select 1 from information_schema.columns col
                      where col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'org_id')`),
    );
    // job_queue مستثنى عمداً: معرّفات فقط بلا أي محتوى (انظر migrations). نتحقق أنه كذلك.
    const unprotected = rows.rows.filter((r) => !(r.rls && r.force)).map((r) => r.table);
    expect(unprotected).toEqual(["job_queue"]);
    const cols = await admin((c) =>
      c.query(`select column_name from information_schema.columns where table_name = 'job_queue' order by 1`),
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual(["attempts", "created_at", "job_id", "locked_at", "locked_by", "org_id", "run_after"]);
    expect(rows.rows.length).toBeGreaterThanOrEqual(TENANT_TABLES.length);
  });
});

describe("company A cannot see any row of company B", () => {
  it("company B really has data in every table (the test is not vacuous)", async () => {
    for (const t of TENANT_TABLES) {
      const n = await admin((c) => c.query(`select count(*)::int n from ${t} where org_id = $1`, [orgB]));
      expect(n.rows[0].n, t).toBeGreaterThan(0);
    }
  });

  it("raw SQL in A's context returns zero B rows in every table, even without a WHERE clause", async () => {
    await withOrg(ownerA, async (tx) => {
      for (const t of TENANT_TABLES) {
        const visible = await tx.execute(sql.raw(`select org_id::text from ${t}`));
        const orgs = new Set(visible.rows.map((r) => (r as { org_id: string }).org_id));
        expect([...orgs], t).toEqual([orgA]);
      }
      const orgsVisible = await tx.execute(sql`select id::text from organizations`);
      expect(orgsVisible.rows.map((r) => (r as { id: string }).id)).toEqual([orgA]);
      const usersVisible = await tx.execute(sql`select id from users u where not exists (select 1 from memberships m where m.user_id = u.id and m.org_id = ${orgA})`);
      expect(usersVisible.rows).toHaveLength(0);
    });
  });

  it("without an org context the app role sees nothing at all", async () => {
    const c = new pg.Client({ connectionString: APP_URL });
    await c.connect();
    for (const t of [...TENANT_TABLES, "organizations", "users"]) {
      const r = await c.query(`select count(*)::int n from ${t}`);
      expect(r.rows[0].n, t).toBe(0);
    }
    await c.end();
  });

  it("A cannot write into, update, or delete B's rows", async () => {
    await expect(
      withOrg(ownerA, (tx) => tx.execute(sql`insert into tenders (org_id, title) values (${orgB}, 'x')`)),
    ).rejects.toSatisfy(causedBy(/row-level security/));
    const upd = await withOrg(ownerA, (tx) => tx.execute(sql`update tenders set title = 'hacked' where id = ${tenderB}`));
    expect(upd.rowCount).toBe(0);
    const del = await withOrg(ownerA, (tx) => tx.execute(sql`delete from document_pages where tender_id = ${tenderB}`));
    expect(del.rowCount).toBe(0);
    // لا يمكن الإشارة لسجل شركة أخرى عبر مفتاح أجنبي (المفاتيح المركّبة org_id, id)
    await expect(
      withOrg(ownerA, (tx) => tx.execute(sql`insert into processing_jobs (org_id, tender_id, kind) values (${orgA}, ${tenderB}, 'extract')`)),
    ).rejects.toSatisfy(causedBy(/foreign key/));
    const title = await admin((c) => c.query(`select title from tenders where id = $1`, [tenderB]));
    expect(title.rows[0].title).toBe("منافسة ب السرية");
  });

  it("service functions called with A's context and B's ids fail as not found", async () => {
    await expect(getTenderDetail(ownerA, tenderB)).rejects.toMatchObject({ code: "not_found" });
    await expect(getPageContent(ownerA, tenderB, tfB, 1)).rejects.toMatchObject({ code: "not_found" });
    await expect(readTenderFile(ownerA, tenderB, fileB)).rejects.toMatchObject({ code: "not_found" });
    await expect(hardDeleteTender(ownerA, tenderB)).rejects.toMatchObject({ code: "not_found" });
    await expect(getTenderKey(orgA, tenderB)).rejects.toBeInstanceOf(TenderKeyMissingError);
    expect(await listChunks(ownerA, tenderB)).toEqual([]);
    expect((await listTenders(ownerA)).map((t) => t.id)).toEqual([tenderA]);
  });
});

describe("worker tasks are isolated too", () => {
  it("a queue entry claiming org A but pointing at B's job is dropped without touching B", async () => {
    const jobB = await admin(async (c) => (await c.query(`select id from processing_jobs where org_id = $1`, [orgB])).rows[0].id);
    const before = await admin((c) => c.query(`select status, updated_at from processing_jobs where id = $1`, [jobB]));

    // job_queue بلا RLS، لذا نزوّر المدخل مباشرة (أسوأ حالة: خطأ برمجي أو عبث بالطابور)
    await admin((c) => c.query(`delete from job_queue`));
    await admin((c) =>
      c.query(`alter table job_queue drop constraint job_queue_org_id_job_id_fkey`),
    );
    try {
      await admin((c) => c.query(`insert into job_queue (job_id, org_id) values ($1, $2)`, [jobB, orgA]));
      const result = await processOne("test-worker", { info() {}, warn() {}, error() {} } as unknown as Console);
      expect(result).toBe("gone");
    } finally {
      await admin((c) => c.query(`delete from job_queue`));
      await admin((c) =>
        c.query(`alter table job_queue add constraint job_queue_org_id_job_id_fkey foreign key (org_id, job_id) references processing_jobs(org_id, id) on delete cascade`),
      );
    }
    const after = await admin((c) => c.query(`select status, updated_at from processing_jobs where id = $1`, [jobB]));
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("the worker's own writes are checked by RLS: everything it wrote belongs to the job's org", async () => {
    for (const t of ["document_pages", "chunks"]) {
      const r = await admin((c) =>
        c.query(`select x.org_id = tn.org_id as ok from ${t} x join tenders tn on tn.id = x.tender_id`),
      );
      expect(r.rows.every((row) => row.ok), t).toBe(true);
    }
    const workerAudit = await admin((c) =>
      c.query(`select a.org_id, t.org_id as tender_org from audit_logs a join tenders t on t.id = a.entity_id where a.actor_kind = 'worker'`),
    );
    expect(workerAudit.rows.length).toBe(2);
    for (const r of workerAudit.rows) expect(r.org_id).toBe(r.tender_org);
  });
});
