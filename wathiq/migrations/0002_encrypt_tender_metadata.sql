-- تشفير البيانات الوصفية للمنافسة بمفتاحها: العنوان، الرقم، اسم الجهة، وأسماء الملفات.
-- قائمة المنافسات نفسها معلومة تنافسية حساسة، فلا يبقى منها نص مقروء في القاعدة أو نسخها الاحتياطية.
--
-- تنبيه: لا يمكن تشفير صفوف موجودة من SQL (المفتاح خارج القاعدة). هذا الترحيل يفترض عدم وجود
-- منافسات (لا توجد بيئة إنتاج قبل المرحلة 2). في التطوير: npm run db:reset.

ALTER TABLE tenders ADD COLUMN meta_enc bytea;
ALTER TABLE tenders DROP COLUMN title;
ALTER TABLE tenders DROP COLUMN reference_number;
ALTER TABLE tenders ALTER COLUMN meta_enc SET NOT NULL;

ALTER TABLE files ADD COLUMN name_enc bytea;
ALTER TABLE files DROP COLUMN original_name;
ALTER TABLE files ALTER COLUMN name_enc SET NOT NULL;
