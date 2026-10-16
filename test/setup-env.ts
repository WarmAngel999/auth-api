// выполняется до загрузки тестов и направляет приложение на тестовую базу
process.env.DB_NAME = 'auth_test';
process.env.NODE_ENV = 'development';
