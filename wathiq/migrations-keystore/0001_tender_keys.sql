-- مخزن مفاتيح المنافسات. يُطبَّق على KEYSTORE_DATABASE_URL (افتراضياً نفس قاعدة التطبيق).
-- فصله في قاعدة مستقلة بسياسة نسخ احتياطي قصيرة هو ما يجعل الحذف النهائي يشمل
-- النسخ الاحتياطية للقاعدة الرئيسية. انظر docs/security.md.

CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

-- مفتاح بيانات (DEK) لكل منافسة، مغلّف بالمفتاح الرئيسي (KEK) الموجود خارج قاعدة البيانات.
CREATE TABLE tender_keys (
  tender_id   uuid PRIMARY KEY,
  org_id      uuid NOT NULL,
  kek_id      text NOT NULL,
  wrapped_dek bytea NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tender_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE tender_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON tender_keys
  USING (org_id = app_org_id()) WITH CHECK (org_id = app_org_id());

GRANT USAGE ON SCHEMA public TO wathiq_app;
GRANT EXECUTE ON FUNCTION app_org_id() TO wathiq_app;
GRANT SELECT, INSERT, DELETE ON tender_keys TO wathiq_app;
