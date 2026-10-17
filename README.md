# auth-api

REST API на NestJS: регистрация, вход, JWT (access и refresh), роли.
Стек: NestJS, TypeORM, PostgreSQL, Passport (local, jwt, jwt-refresh), bcrypt.

## Запуск

1. Поднять PostgreSQL (например, в Docker) и создать базу `auth`:
```
   docker run --name auth-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=auth -p 5432:5432 -d postgres:16
```
2. Скопировать `.env.example` в `.env` и заполнить значения (секреты JWT должны быть длинными случайными строками).
3. Установить зависимости и запустить:
```
   npm install
   npm run start:dev
```

## Эндпоинты

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| POST | /auth/register | все | регистрация (email, password) |
| POST | /auth/login | все | вход, возвращает accessToken и refreshToken |
| POST | /auth/refresh | refresh-токен в теле | новая пара токенов (ротация) |
| POST | /auth/logout | access-токен | выход, refresh-токен перестаёт работать |
| GET | /auth/me | access-токен | данные текущего пользователя |
| GET | /users | access-токен, роль admin | список пользователей |

Access-токен живёт 15 минут и передаётся в заголовке `Authorization: Bearer <token>`.
Refresh-токен живёт 7 дней, его хэш хранится в базе.

## Миграции

В `NODE_ENV=development` схема создаётся автоматически (`synchronize`).
В остальных окружениях приложение при старте само применяет миграции из `src/migrations`.

Команды (работают через сборку проекта):
```
npm run migration:generate -- src/migrations/ИмяМиграции
npm run migration:run
npm run migration:revert
```
Миграцию генерируют на базе, схема которой создана только миграциями
(не на базе разработки, где её ведёт `synchronize`).
