-- المرحلة 1: المؤسسات، المنافسات، الملفات، الصفحات، المقاطع، المهام، سجل التدقيق.
-- يُنفَّذ بدور wathiq_owner. كل جدول يحمل org_id عليه RLS مفعّل ومفروض (FORCE).

-- ─── دوال السياق ────────────────────────────────────────────────────────────
-- تُقرأ القيم المضبوطة بـ set_config(..., true) (= SET LOCAL) داخل كل معاملة.
-- عند غياب السياق تُرجع NULL فلا يطابق أي صف.
CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

-- ─── الأنواع ────────────────────────────────────────────────────────────────
CREATE TYPE member_role      AS ENUM ('owner', 'editor', 'reviewer');
CREATE TYPE tender_status    AS ENUM ('uploading', 'processing', 'ready', 'failed');
CREATE TYPE tender_file_role AS ENUM ('booklet', 'annex', 'boq', 'other');
CREATE TYPE extraction_status AS ENUM ('pending', 'processing', 'done', 'failed');
-- نوع الصفحة كما صنّفها خط المعالجة
CREATE TYPE page_kind   AS ENUM ('text', 'scanned', 'hybrid', 'broken_text', 'blank');
CREATE TYPE text_source AS ENUM ('text_layer', 'ocr', 'none');
CREATE TYPE job_kind    AS ENUM ('extract');
CREATE TYPE job_status  AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- ─── الحسابات ───────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  locale     text NOT NULL DEFAULT 'ar',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       member_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships(user_id);

-- ─── المنافسات والملفات ─────────────────────────────────────────────────────
-- مفاتيح أجنبية مركّبة (org_id, id): فحوص المفاتيح الأجنبية في Postgres تتجاوز RLS،
-- فبدون org_id في المفتاح يمكن لصف في مؤسسة أن يشير لسجل في مؤسسة أخرى.
CREATE TABLE tenders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title            text NOT NULL,
  reference_number text,
  status           tender_status NOT NULL DEFAULT 'uploading',
  created_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id)
);
CREATE INDEX tenders_org_idx ON tenders(org_id, created_at DESC);

-- الملف نفسه مشفّر في التخزين بمفتاح المنافسة؛ هنا البيانات الوصفية فقط.
CREATE TABLE files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id         uuid,
  storage_key       text NOT NULL UNIQUE,
  original_name     text NOT NULL,
  mime              text NOT NULL,
  size_bytes        bigint NOT NULL,
  ciphertext_sha256 text NOT NULL,
  uploaded_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, tender_id) REFERENCES tenders(org_id, id) ON DELETE CASCADE
);
CREATE INDEX files_tender_idx ON files(tender_id);

CREATE TABLE tender_files (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id         uuid NOT NULL,
  file_id           uuid NOT NULL,
  role              tender_file_role NOT NULL DEFAULT 'booklet',
  ordinal           int NOT NULL DEFAULT 0,
  page_count        int,
  extraction_status extraction_status NOT NULL DEFAULT 'pending',
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, tender_id) REFERENCES tenders(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, file_id)   REFERENCES files(org_id, id)   ON DELETE CASCADE
);
CREATE INDEX tender_files_tender_idx ON tender_files(tender_id);

-- نص الصفحة وإحداثيات كلماتها في content_enc (AES-256-GCM بمفتاح المنافسة).
-- الأعمدة غير المشفرة إحصائية فقط ولا تحتوي نصاً من الكراسة.
CREATE TABLE document_pages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id      uuid NOT NULL,
  tender_file_id uuid NOT NULL,
  page_no        int NOT NULL,
  kind           page_kind NOT NULL,
  source         text_source NOT NULL,
  width          real NOT NULL,
  height         real NOT NULL,
  rotation       int NOT NULL DEFAULT 0,
  char_count     int NOT NULL,
  word_count     int NOT NULL,
  image_coverage real NOT NULL DEFAULT 0,
  ocr_confidence real,
  low_confidence boolean NOT NULL DEFAULT false,
  content_enc    bytea NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tender_file_id, page_no),
  FOREIGN KEY (org_id, tender_id)      REFERENCES tenders(org_id, id)      ON DELETE CASCADE,
  FOREIGN KEY (org_id, tender_file_id) REFERENCES tender_files(org_id, id) ON DELETE CASCADE
);
CREATE INDEX document_pages_tender_idx ON document_pages(tender_id);

CREATE TABLE chunks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id      uuid NOT NULL,
  tender_file_id uuid NOT NULL,
  ordinal        int NOT NULL,
  page_start     int NOT NULL,
  page_end       int NOT NULL,
  section_ref    text,           -- رقم البند فقط مثل "4.2.1" (بدون نص)
  char_count     int NOT NULL,
  token_estimate int NOT NULL,
  content_enc    bytea NOT NULL, -- {heading, text, spans[]} مشفّر
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tender_file_id, ordinal),
  FOREIGN KEY (org_id, tender_id)      REFERENCES tenders(org_id, id)      ON DELETE CASCADE,
  FOREIGN KEY (org_id, tender_file_id) REFERENCES tender_files(org_id, id) ON DELETE CASCADE
);
CREATE INDEX chunks_tender_idx ON chunks(tender_id);

-- ─── المهام ─────────────────────────────────────────────────────────────────
-- processing_jobs: الحالة المرئية للمستخدم (المرحلة، النسبة) — تحت RLS.
CREATE TABLE processing_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id   uuid NOT NULL,
  kind        job_kind NOT NULL,
  status      job_status NOT NULL DEFAULT 'queued',
  stage       text NOT NULL DEFAULT 'queued',
  progress    int NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
  error       text,
  attempts    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, id),
  FOREIGN KEY (org_id, tender_id) REFERENCES tenders(org_id, id) ON DELETE CASCADE
);
CREATE INDEX processing_jobs_tender_idx ON processing_jobs(tender_id, created_at DESC);

-- job_queue: طابور المطالبة فقط — معرّفات بلا أي محتوى، لذلك بلا RLS.
-- العامل يطالب بمهمة من هنا (FOR UPDATE SKIP LOCKED) ثم يعالجها داخل withOrg(org_id)
-- فتسري عليه RLS كأي طلب مستخدم.
CREATE TABLE job_queue (
  job_id     uuid PRIMARY KEY,
  org_id     uuid NOT NULL,
  run_after  timestamptz NOT NULL DEFAULT now(),
  locked_at  timestamptz,
  locked_by  text,
  attempts   int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, job_id) REFERENCES processing_jobs(org_id, id) ON DELETE CASCADE
);
CREATE INDEX job_queue_ready_idx ON job_queue(run_after) WHERE locked_at IS NULL;

-- ─── سجل التدقيق (إلحاق فقط) ────────────────────────────────────────────────
-- لا مفتاح أجنبي على الكيان: السجل يبقى بعد الحذف النهائي (بدون محتوى الكراسة).
CREATE TABLE audit_logs (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_kind    text NOT NULL DEFAULT 'user', -- user | worker | system
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip            inet,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_org_idx ON audit_logs(org_id, created_at DESC);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE organizations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE files           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_files    ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_pages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      ENABLE ROW LEVEL SECURITY;

ALTER TABLE organizations   FORCE ROW LEVEL SECURITY;
ALTER TABLE users           FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships     FORCE ROW LEVEL SECURITY;
ALTER TABLE tenders         FORCE ROW LEVEL SECURITY;
ALTER TABLE files           FORCE ROW LEVEL SECURITY;
ALTER TABLE tender_files    FORCE ROW LEVEL SECURITY;
ALTER TABLE document_pages  FORCE ROW LEVEL SECURITY;
ALTER TABLE chunks          FORCE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs      FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON organizations
  USING (id = app_org_id()) WITH CHECK (id = app_org_id());

-- المستخدم يرى نفسه، ويرى أعضاء المؤسسة الحالية.
CREATE POLICY user_visibility ON users
  USING (id = app_user_id()
         OR id IN (SELECT m.user_id FROM memberships m WHERE m.org_id = app_org_id()))
  WITH CHECK (id = app_user_id());

-- العضويات: عضويات المؤسسة الحالية، أو عضويات المستخدم نفسه (لاختيار المؤسسة عند الدخول).
CREATE POLICY membership_visibility ON memberships
  USING (org_id = app_org_id() OR user_id = app_user_id())
  WITH CHECK (org_id = app_org_id());

CREATE POLICY org_isolation ON tenders         USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
CREATE POLICY org_isolation ON files           USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
CREATE POLICY org_isolation ON tender_files    USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
CREATE POLICY org_isolation ON document_pages  USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
CREATE POLICY org_isolation ON chunks          USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
CREATE POLICY org_isolation ON processing_jobs USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());

CREATE POLICY audit_read   ON audit_logs FOR SELECT USING (org_id = app_org_id());
CREATE POLICY audit_append ON audit_logs FOR INSERT WITH CHECK (org_id = app_org_id());

-- ─── الصلاحيات لدور التطبيق ─────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO wathiq_app;
GRANT EXECUTE ON FUNCTION app_org_id(), app_user_id() TO wathiq_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organizations, users, memberships, tenders, files, tender_files,
  document_pages, chunks, processing_jobs, job_queue
  TO wathiq_app;
-- سجل التدقيق: قراءة وإضافة فقط، لا تعديل ولا حذف.
GRANT SELECT, INSERT ON audit_logs TO wathiq_app;
