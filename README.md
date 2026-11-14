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

Схема базы создаётся только миграциями (`synchronize: false` во всех окружениях).
Приложение при старте само применяет все ещё не применённые миграции из `src/migrations`.

Команды (работают через сборку проекта):
```
npm run migration:generate -- src/migrations/ИмяМиграции
npm run migration:run
npm run migration:revert
```
Применённую миграцию не правят: изменения вносят новой миграцией.
SQL-запросы пишутся в лог только при `NODE_ENV=development`, ошибки SQL логируются всегда.

## Кошелёк

Суммы хранятся в копейках (целые числа).

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | /wallet | пользователь | кошелёк и баланс |
| POST | /wallet/deposit | admin | пополнение своего кошелька (остальным 403) |
| POST | /wallet/transfer | пользователь | перевод, заголовок `Idempotency-Key` обязателен |
| GET | /wallet/transactions?limit=&cursor= | пользователь | история, курсорная пагинация |

История: `limit` от 1 до 100 (по умолчанию 20), `cursor` — id последней записи
предыдущей страницы. Ответ: `{ items, nextCursor }`, на последней странице
`nextCursor = null`. Элемент: `id`, `type`, `direction` (in/out), `amount`,
`counterpartyUserId` (null у пополнения), `createdAt`.

Коды ошибок: 400 (сумма, нет средств, нет ключа, неверные `limit`/`cursor`),
401 (нет токена), 403 (не admin), 404 (нет получателя), 409 (ключ с другими данными).

Защита: транзакция, блокировка кошельков в одном порядке, `CHECK (balance >= 0)`,
`CHECK (from_wallet_id <> to_wallet_id)`, уникальный индекс ключа идемпотентности.

### Запрос истории

Запрос построен через `UNION ALL` двух подзапросов (по `from_wallet_id` и по
`to_wallet_id`), каждый идёт по своему индексу `(wallet_id, id)`.
Вставь сюда `EXPLAIN ANALYZE` до и после (плотный и разреженный кошелёк).
## Тесты

```
npm run test:e2e
```
Нужна база `auth_test`. Перед прогоном `test/global-setup.ts` очищает её и поднимает схему
миграциями; тесты работают только с `auth_test` и при другом имени базы останавливаются.
