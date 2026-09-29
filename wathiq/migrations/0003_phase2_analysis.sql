-- المرحلة 2: الملخص ومصفوفة الامتثال.
-- كل نص من الكراسة أو من مخرجات النموذج (الاقتباسات، نص المتطلبات، قيم الملخص، المخرج الخام)
-- في أعمدة *_enc مشفّرة بمفتاح المنافسة. الأعمدة المقروءة: حالات وتصنيفات وأرقام صفحات فقط.

ALTER TYPE job_kind ADD VALUE IF NOT EXISTS 'analyze';
ALTER TYPE tender_status ADD VALUE IF NOT EXISTS 'analyzing' BEFORE 'ready';

CREATE TYPE verification_status AS ENUM ('verified', 'verified_corrected_page', 'needs_review', 'unverified');
CREATE TYPE req_category   AS ENUM ('regulatory', 'administrative', 'technical', 'financial', 'local_content', 'quality', 'safety', 'operations');
CREATE TYPE req_obligation AS ENUM ('mandatory', 'preferred', 'informational');
-- حالة توفر المتطلب لدى الشركة (تُستكمل في المرحلة 3)
CREATE TYPE req_status     AS ENUM ('available', 'missing', 'needs_review');
CREATE TYPE item_kind      AS ENUM ('staffing', 'deliverable', 'offer_content', 'risk', 'verify_note');

-- سجل كل استدعاء للنموذج: أي برومت (وإصداره وبصمته)، أي نموذج، الكلفة، والمخرج الخام مشفّراً.
CREATE TABLE ai_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id          uuid NOT NULL,
  job_id             uuid,
  chunk_id           uuid,
  task               text NOT NULL,
  prompt_version     text NOT NULL,
  rules_version      text NOT NULL,
  prompt_sha256      text NOT NULL,
  provider           text NOT NULL,
  model_requested    text NOT NULL,
  model_served       text,
  effort             text NOT NULL,
  input_tokens       int NOT NULL DEFAULT 0,
  output_tokens      int NOT NULL DEFAULT 0,
  cache_read_tokens  int NOT NULL DEFAULT 0,
  cache_write_tokens int NOT NULL DEFAULT 0,
  latency_ms         int NOT NULL DEFAULT 0,
  attempts           int NOT NULL DEFAULT 1,
  status             text NOT NULL, -- ok | invalid | error
  error              text,
  output_enc         bytea,
  created_at         timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, tender_id) REFERENCES tenders(org_id, id) ON DELETE CASCADE
);
CREATE INDEX ai_runs_tender_idx ON ai_runs(tender_id, created_at);

-- حقول الملخص ومعايير التقييم وعناصر القائمة الإلزامية. مرشح لكل (حقل × مقطع)، واحد منها أساسي.
CREATE TABLE tender_facts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id       uuid NOT NULL,
  field           text NOT NULL,
  ordinal         int NOT NULL DEFAULT 0,
  is_primary      boolean NOT NULL DEFAULT false,
  conflict        boolean NOT NULL DEFAULT false,
  tender_file_id  uuid,
  stated_page     int,
  matched_page    int,
  verification    verification_status NOT NULL,
  review_reasons  text[] NOT NULL DEFAULT '{}',
  similarity      real,
  chunk_id        uuid,
  value_enc       bytea NOT NULL, -- {value, calendar?, weight?, sub_criteria?}
  source_enc      bytea NOT NULL, -- {clause, quote, matchedText, rects}
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, tender_id) REFERENCES tenders(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, tender_file_id) REFERENCES tender_files(org_id, id) ON DELETE CASCADE
);
CREATE INDEX tender_facts_tender_idx ON tender_facts(tender_id, field);

CREATE TABLE requirements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id        uuid NOT NULL,
  code             text NOT NULL, -- REQ-001 (معروض) أو UNV-001 (غير موثّق) — يسنده الكود بعد الدمج
  ordinal          int NOT NULL,
  category         req_category,
  obligation       req_obligation,
  disqualifying    boolean NOT NULL DEFAULT false,
  verification     verification_status NOT NULL,
  review_reasons   text[] NOT NULL DEFAULT '{}',
  similarity       real,
  tender_file_id   uuid,
  stated_page      int,
  matched_page     int,
  similar_group_id uuid,  -- "متطلبات متشابهة، راجع الدمج"
  merge_decision   text,  -- kept_separate | merged_into:<id>
  status           req_status NOT NULL DEFAULT 'needs_review',
  assignee_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  chunk_id         uuid,
  content_enc      bytea NOT NULL, -- {text, evidenceRequired, clause, quote, matchedText, rects, categoryRaw, localId, mergedLocalIds}
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tender_id, code),
  FOREIGN KEY (org_id, tender_id) REFERENCES tenders(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, tender_file_id) REFERENCES tender_files(org_id, id) ON DELETE CASCADE
);
CREATE INDEX requirements_tender_idx ON requirements(tender_id, ordinal);

-- بقية مخرجات الاستخراج: الكوادر، المخرجات، محتويات العرض الفني، المخاطر والغموض، ملاحظات التحقق.
CREATE TABLE tender_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tender_id       uuid NOT NULL,
  kind            item_kind NOT NULL,
  ordinal         int NOT NULL,
  tender_file_id  uuid,
  stated_page     int,
  matched_page    int,
  verification    verification_status NOT NULL,
  review_reasons  text[] NOT NULL DEFAULT '{}',
  chunk_id        uuid,
  content_enc     bytea NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (org_id, tender_id) REFERENCES tenders(org_id, id) ON DELETE CASCADE,
  FOREIGN KEY (org_id, tender_file_id) REFERENCES tender_files(org_id, id) ON DELETE CASCADE
);
CREATE INDEX tender_items_tender_idx ON tender_items(tender_id, kind, ordinal);

ALTER TABLE ai_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs      FORCE ROW LEVEL SECURITY;
ALTER TABLE tender_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE tender_items FORCE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON ai_runs      USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
CREATE POLICY org_isolation ON tender_facts USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
CREATE POLICY org_isolation ON requirements USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());
CREATE POLICY org_isolation ON tender_items USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_runs, tender_facts, requirements, tender_items TO wathiq_app;
