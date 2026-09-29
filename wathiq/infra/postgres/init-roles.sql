-- يُنفَّذ مرة واحدة بصلاحية superuser عند تهيئة قاعدة البيانات (docker-entrypoint-initdb.d أو يدوياً).
-- ثلاثة أدوار منفصلة:
--   wathiq_owner : يملك الجداول ويشغّل الترحيلات فقط. لا يستخدمه التطبيق.
--   wathiq_app   : يتصل به التطبيق والعامل. ليس مالكاً لأي جدول، وبدون BYPASSRLS.
-- كلمات المرور هنا للتطوير المحلي فقط؛ في الإنتاج تُضبط من مدير الأسرار.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wathiq_owner') THEN
    CREATE ROLE wathiq_owner LOGIN PASSWORD 'wathiq_owner_dev' NOSUPERUSER NOBYPASSRLS NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wathiq_app') THEN
    CREATE ROLE wathiq_app LOGIN PASSWORD 'wathiq_app_dev' NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOINHERIT;
  END IF;
END $$;
