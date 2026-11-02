// выполняется до загрузки тестов и направляет приложение на тестовую базу
process.env.DB_NAME = 'auth_test';
process.env.NODE_ENV = 'development';
process.env.OUTBOX_RELAY_AUTOSTART = 'false';
process.env.CACHE_PREFIX = 'test:';
