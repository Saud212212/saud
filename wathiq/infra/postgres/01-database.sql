-- docker-entrypoint-initdb.d: قاعدة التطبيق يملكها wathiq_owner (الترحيلات تُطبَّق بخدمة migrate)
CREATE DATABASE wathiq OWNER wathiq_owner;
