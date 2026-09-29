/**
 * مخطط Drizzle للاستعلامات المُنمَّطة. المصدر المرجعي للبنية هو migrations/*.sql
 * (لأن RLS والأدوار تُكتب SQL يدوياً). اختبار tests/integration/schema-sync.test.ts
 * يتحقق من تطابق الأعمدة.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  bigint,
  real,
  boolean,
  jsonb,
  customType,
  primaryKey,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export const memberRole = pgEnum("member_role", ["owner", "editor", "reviewer"]);
export const tenderStatus = pgEnum("tender_status", ["uploading", "processing", "analyzing", "ready", "failed"]);
export const tenderFileRole = pgEnum("tender_file_role", ["booklet", "annex", "boq", "other"]);
export const extractionStatus = pgEnum("extraction_status", ["pending", "processing", "done", "failed"]);
export const pageKind = pgEnum("page_kind", ["text", "scanned", "hybrid", "broken_text", "blank"]);
export const textSource = pgEnum("text_source", ["text_layer", "ocr", "none"]);
export const jobKind = pgEnum("job_kind", ["extract", "analyze"]);
export const verificationStatus = pgEnum("verification_status", ["verified", "verified_corrected_page", "needs_review", "unverified"]);
export const reqCategory = pgEnum("req_category", ["regulatory", "administrative", "technical", "financial", "local_content", "quality", "safety", "operations"]);
export const reqObligation = pgEnum("req_obligation", ["mandatory", "preferred", "informational"]);
export const reqStatus = pgEnum("req_status", ["available", "missing", "needs_review"]);
export const itemKind = pgEnum("item_kind", ["staffing", "deliverable", "offer_content", "risk", "verify_note"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "succeeded", "failed"]);

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  locale: text("locale").notNull().default("ar"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: memberRole("role").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

export const tenders = pgTable("tenders", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  /** {title, referenceNumber, agency} مشفّرة بمفتاح المنافسة */
  metaEnc: bytea("meta_enc").notNull(),
  status: tenderStatus("status").notNull().default("uploading"),
  createdBy: uuid("created_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  tenderId: uuid("tender_id"),
  storageKey: text("storage_key").notNull(),
  nameEnc: bytea("name_enc").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  ciphertextSha256: text("ciphertext_sha256").notNull(),
  uploadedBy: uuid("uploaded_by"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tenderFiles = pgTable("tender_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  tenderId: uuid("tender_id").notNull(),
  fileId: uuid("file_id").notNull(),
  role: tenderFileRole("role").notNull().default("booklet"),
  ordinal: integer("ordinal").notNull().default(0),
  pageCount: integer("page_count"),
  extractionStatus: extractionStatus("extraction_status").notNull().default("pending"),
  error: text("error"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const documentPages = pgTable("document_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  tenderId: uuid("tender_id").notNull(),
  tenderFileId: uuid("tender_file_id").notNull(),
  pageNo: integer("page_no").notNull(),
  kind: pageKind("kind").notNull(),
  source: textSource("source").notNull(),
  width: real("width").notNull(),
  height: real("height").notNull(),
  rotation: integer("rotation").notNull().default(0),
  charCount: integer("char_count").notNull(),
  wordCount: integer("word_count").notNull(),
  imageCoverage: real("image_coverage").notNull().default(0),
  ocrConfidence: real("ocr_confidence"),
  lowConfidence: boolean("low_confidence").notNull().default(false),
  contentEnc: bytea("content_enc").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const chunks = pgTable("chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  tenderId: uuid("tender_id").notNull(),
  tenderFileId: uuid("tender_file_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  pageStart: integer("page_start").notNull(),
  pageEnd: integer("page_end").notNull(),
  sectionRef: text("section_ref"),
  charCount: integer("char_count").notNull(),
  tokenEstimate: integer("token_estimate").notNull(),
  contentEnc: bytea("content_enc").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const processingJobs = pgTable("processing_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  tenderId: uuid("tender_id").notNull(),
  kind: jobKind("kind").notNull(),
  status: jobStatus("status").notNull().default("queued"),
  stage: text("stage").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  error: text("error"),
  attempts: integer("attempts").notNull().default(0),
  createdAt: ts("created_at").notNull().defaultNow(),
  startedAt: ts("started_at"),
  finishedAt: ts("finished_at"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  orgId: uuid("org_id").notNull(),
  actorUserId: uuid("actor_user_id"),
  actorKind: text("actor_kind").notNull().default("user"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tenderKeys = pgTable("tender_keys", {
  tenderId: uuid("tender_id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  kekId: text("kek_id").notNull(),
  wrappedDek: bytea("wrapped_dek").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const aiRuns = pgTable("ai_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  tenderId: uuid("tender_id").notNull(),
  jobId: uuid("job_id"),
  chunkId: uuid("chunk_id"),
  task: text("task").notNull(),
  promptVersion: text("prompt_version").notNull(),
  rulesVersion: text("rules_version").notNull(),
  promptSha256: text("prompt_sha256").notNull(),
  provider: text("provider").notNull(),
  modelRequested: text("model_requested").notNull(),
  modelServed: text("model_served"),
  effort: text("effort").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  attempts: integer("attempts").notNull().default(1),
  status: text("status").notNull(),
  error: text("error"),
  outputEnc: bytea("output_enc"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tenderFacts = pgTable("tender_facts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  tenderId: uuid("tender_id").notNull(),
  field: text("field").notNull(),
  ordinal: integer("ordinal").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  conflict: boolean("conflict").notNull().default(false),
  tenderFileId: uuid("tender_file_id"),
  statedPage: integer("stated_page"),
  matchedPage: integer("matched_page"),
  verification: verificationStatus("verification").notNull(),
  reviewReasons: text("review_reasons").array().notNull().default([]),
  similarity: real("similarity"),
  chunkId: uuid("chunk_id"),
  valueEnc: bytea("value_enc").notNull(),
  sourceEnc: bytea("source_enc").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const requirements = pgTable("requirements", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  tenderId: uuid("tender_id").notNull(),
  code: text("code").notNull(),
  ordinal: integer("ordinal").notNull(),
  category: reqCategory("category"),
  obligation: reqObligation("obligation"),
  disqualifying: boolean("disqualifying").notNull().default(false),
  verification: verificationStatus("verification").notNull(),
  reviewReasons: text("review_reasons").array().notNull().default([]),
  similarity: real("similarity"),
  tenderFileId: uuid("tender_file_id"),
  statedPage: integer("stated_page"),
  matchedPage: integer("matched_page"),
  similarGroupId: uuid("similar_group_id"),
  mergeDecision: text("merge_decision"),
  status: reqStatus("status").notNull().default("needs_review"),
  assigneeId: uuid("assignee_id"),
  chunkId: uuid("chunk_id"),
  contentEnc: bytea("content_enc").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const tenderItems = pgTable("tender_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  tenderId: uuid("tender_id").notNull(),
  kind: itemKind("kind").notNull(),
  ordinal: integer("ordinal").notNull(),
  tenderFileId: uuid("tender_file_id"),
  statedPage: integer("stated_page"),
  matchedPage: integer("matched_page"),
  verification: verificationStatus("verification").notNull(),
  reviewReasons: text("review_reasons").array().notNull().default([]),
  chunkId: uuid("chunk_id"),
  contentEnc: bytea("content_enc").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});
