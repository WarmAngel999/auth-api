# auth-api

REST API на NestJS: регистрация, вход, JWT (access и refresh), роли, кошелёк с переводами,
журнал событий (Transactional Outbox), очередь BullMQ, уведомления и задачи по расписанию.
Стек: NestJS, TypeORM, PostgreSQL, Redis, BullMQ, Passport (local, jwt, jwt-refresh), bcrypt.
## Запуск

1. Скопировать `.env.example` в `.env` (в PowerShell: `Copy-Item .env.example .env`).
2. Поднять Postgres и Redis:
```
docker compose up -d
```
При первом запуске создаются базы `auth` и `auth_test`.
3. Установить зависимости и запустить:
```
npm ci
npm run start:dev
```
Миграции применяются при старте приложения автоматически.
Если порты 5432 или 6379 на компьютере заняты, поменяй `DB_PORT` и `REDIS_PORT` в `.env`: compose читает их оттуда.

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

## Уведомления и администрирование

| Метод | Путь | Доступ | Описание |
|-------|------|--------|----------|
| GET | /notifications?limit=&cursor= | пользователь | свои уведомления, сначала новые, курсорная пагинация |
| GET | /notifications/unread-count | пользователь | число непрочитанных |
| PATCH | /notifications/:id/read | пользователь | отметить прочитанным |
| POST | /notifications/read-all | пользователь | отметить все прочитанными |
| POST | /admin/reconcile | admin | запустить сверку балансов и вернуть отчёт |
| GET | /admin/outbox/stats | admin | число неопубликованных событий и возраст самого старого |

Ответы: список уведомлений `{ items: [{ id, type, text, readAt, createdAt }], nextCursor }`,
счётчик `{ count }`, статистика `{ unpublished, oldestAgeSeconds }`, отчёт сверки
`{ id, checkedWallets, mismatches: [{ walletId, userId, balance, expected, diff }], createdAt }`.
Чужое или несуществующее уведомление: 404. Неверные `limit` или `cursor`: 400.
Без роли admin `/admin/*`: 403, без токена: 401.

## Задачи по расписанию

- Очистка сессий: раз в час удаляет из `refresh_tokens` строки с истёкшим `expiresAt`, количество
  пишет в лог.
- Сверка балансов: раз в сутки в 3:00 ищет кошельки, у которых `balance` не равен сумме входящих
  минус сумма исходящих по журналу. Подсчёт делает база (`GROUP BY` и `HAVING`), в память
  приложения попадают только расхождения. Результат сохраняется в `reconciliation_reports`,
  при расхождениях в лог пишется предупреждение.

Логика каждой задачи лежит в отдельном методе `TasksService`, расписание только вызывает его.
При нескольких экземплярах приложения задача сработает в каждом из них. Для очистки это безвредно,
сверка создаст несколько отчётов.

### Запрос истории

Запрос построен через `UNION ALL` двух подзапросов (по `from_wallet_id` и по
`to_wallet_id`), каждый идёт по своему индексу `(wallet_id, id)`.
Вставь сюда `EXPLAIN ANALYZE` до и после (плотный и разреженный кошелёк).
## Тесты

```
npm test           # юнит-тестов пока нет, команда не падает
npm run test:e2e   # нужны Postgres и Redis: docker compose up -d
```
Нужна база `auth_test` (создаётся compose при первом запуске). Перед прогоном
`test/global-setup.ts` очищает её и поднимает схему миграциями; тесты работают только
с `auth_test` и при другом имени базы останавливаются. Тест повторов обработчика идёт через
настоящий Redis, остальные подменяют добавление в очередь.
CI (GitHub Actions) на каждый push и pull request запускает `npm ci`, линтер, `prettier --check`,
сборку и e2e-тесты.
## Поток событий

```
POST /wallet/transfer
  └─ одна транзакция PostgreSQL: wallets + transfers + outbox_events
OutboxRelay (каждые 2 с, FOR UPDATE SKIP LOCKED, до 100 событий)
  └─ очередь BullMQ notifications, jobId = id события
NotificationsProcessor (5 попыток, экспоненциальный backoff от 1 с)
  └─ INSERT ... ON CONFLICT DO NOTHING в notifications (уникальный event_id)
GET /notifications
```
Перевод и событие сохраняются одной транзакцией: события без перевода не бывает, и наоборот.
Сервис кошелька в очередь не пишет, этим занимается публикатор. Если Redis недоступен,
транзакция публикатора откатывается, события остаются неопубликованными и уходят в следующих
циклах, а переводы продолжают работать. Доставка «минимум один раз»: событие может прийти
обработчику несколько раз, но уведомление создаётся одно (уникальный `event_id`).

### Проверка вручную: Redis остановлен (сценарий 6)

1. Запустить приложение (`npm run start:dev`) и остановить Redis: `docker compose stop redis`.
2. Сделать перевод через `POST /wallet/transfer`. Ответ `201`.
3. В логе приложения появится `Не удалось отправить события: ...`, а в `outbox_events` у события
   пустой `published_at`.
4. Запустить Redis: `docker compose start redis`. Через несколько секунд событие опубликовано,
   у получателя появилось уведомление.
   Замеры на тестовых данных: 100 кошельков, 500 000 переводов между ними, и один кошелёк, чьи
   2000 операций лежат в самом начале таблицы (редкие старые операции). Запрашивается первая
   страница, `limit=20` (читается 21 строка).

**До: условие `OR` по двум колонкам.** Планировщик идёт по первичному ключу назад и отбрасывает
чужие строки: `Rows Removed by Filter: 500000`, прочитано 8460 страниц, **95,2 мс**.

```
Limit  (cost=0.57..288.96 rows=21 width=37) (actual time=164.222..164.251 rows=21 loops=1)
   Buffers: shared hit=8259 read=201
   ->  Nested Loop Left Join  (cost=0.57..27095.85 rows=1973 width=37) (actual time=164.217..164.243 rows=21 loops=1)
         Buffers: shared hit=8259 read=201
         ->  Index Scan Backward using "PK_f712e908b465e0085b4408cabc3" on transfers t  (cost=0.42..26763.46 rows=1973 width=37) (actual time=164.142..164.148 rows=21 loops=1)
               Filter: ((from_wallet_id = 105) OR (to_wallet_id = 105))
               Rows Removed by Filter: 500000
               Buffers: shared hit=8218 read=200
         ->  Index Scan using "PK_8402e5df5a30a229380e83e4f7e" on wallets cw  (cost=0.14..0.17 rows=1 width=8) (actual time=0.003..0.003 rows=1 loops=21)
               Index Cond: (id = CASE WHEN (t.to_wallet_id = 105) THEN t.from_wallet_id ELSE t.to_wallet_id END)
               Buffers: shared hit=41 read=1
 Planning:
   Buffers: shared hit=69 read=10
 Planning Time: 20.779 ms
 Execution Time: 164.387 ms
(15 rows)

```

**После: `UNION ALL` двух подзапросов.** Каждая ветка идёт по своему индексу `(wallet_id, id)`
и читает только строки этого кошелька. Прочитано 9 страниц, **1,27 мс**.

```
 Sort  (cost=61.71..61.76 rows=21 width=37) (actual time=0.268..0.273 rows=21 loops=1)
   Sort Key: transfers.id DESC
   Sort Method: quicksort  Memory: 26kB
   Buffers: shared hit=9
   ->  Hash Left Join  (cost=4.17..61.25 rows=21 width=37) (actual time=0.173..0.203 rows=21 loops=1)
         Hash Cond: (CASE WHEN (transfers.to_wallet_id = 105) THEN transfers.from_wallet_id ELSE transfers.to_wallet_id END = cw.id)
         Buffers: shared hit=9
         ->  Limit  (cost=0.85..57.66 rows=21 width=37) (actual time=0.091..0.111 rows=21 loops=1)
               Buffers: shared hit=8
               ->  Merge Append  (cost=0.85..114.47 rows=42 width=37) (actual time=0.089..0.107 rows=21 loops=1)
                     Sort Key: transfers.id DESC
                     Buffers: shared hit=8
                     ->  Limit  (cost=0.42..35.87 rows=21 width=37) (actual time=0.050..0.051 rows=1 loops=1)
                           Buffers: shared hit=4
                           ->  Index Scan Backward using "IDX_ac4de5745d9432f3678591233c" on transfers  (cost=0.42..1553.26 rows=920 width=37) (actual time=0.050..0.050 rows=1 loops=1)
                                 Index Cond: (from_wallet_id = 105)
                                 Buffers: shared hit=4
                     ->  Limit  (cost=0.42..78.17 rows=21 width=37) (actual time=0.037..0.050 rows=21 loops=1)
                           Buffers: shared hit=4
                           ->  Index Scan Backward using "IDX_f81771288d1bdeea832925f9aa" on transfers transfers_1  (cost=0.42..3902.66 rows=1054 width=37) (actual time=0.037..0.047 rows=21 loops=1)
                                 Index Cond: (to_wallet_id = 105)
                                 Buffers: shared hit=4
         ->  Hash  (cost=2.03..2.03 rows=103 width=8) (actual time=0.065..0.066 rows=103 loops=1)
               Buckets: 1024  Batches: 1  Memory Usage: 13kB
               Buffers: shared hit=1
               ->  Seq Scan on wallets cw  (cost=0.00..2.03 rows=103 width=8) (actual time=0.023..0.037 rows=103 loops=1)
                     Buffers: shared hit=1
 Planning Time: 1.566 ms
 Execution Time: 0.439 ms
(29 rows)
```

Для активного кошелька, чьи операции лежат среди самых свежих строк таблицы, оба варианта
работают почти одинаково: обход по первичному ключу находит нужные 21 запись быстро. Преимущество
`UNION ALL` в том, что время не зависит от того, как давно была последняя операция по кошельку.
`UNION ALL` (без `UNION`) выбран потому, что дубликатов быть не может: перевод самому себе
запрещён ограничением `CHECK (from_wallet_id <> to_wallet_id)`, иначе такая запись попала бы
в обе ветки.
## Контрольные вопросы

### 1. Что такое dual write? Что пойдёт не так, если вызвать `queue.add()` до commit транзакции? А если после?
суть Dual write в том что  когда у нас есть одно действие которое нужно записать  в двух независимых системах по типу Postgres и Redis а общей транзакции на них нет. Одна запись может получиться а вторая нет 
Если queue.add() до commit воркер получает задачу и создаёт уведомление о переводе а перевода нет.
Если после commit перевод есть нет задачи а уведомления нет никто  не знает что его нужно отправить 
### 2. Чем at-least-once отличается от exactly-once? Почему «ровно один раз» получают через идемпотентный обработчик?
at-least-once сообщение прийдёт минимум один раз, а в exactly-once ровно один раз, если сообщение будет потерено и не дойдёт до пользователя его прийдётся отправлять ещё раз
Берут at-least-once (потерь нет) и делают обработчик идемпотентным: повторный вызов даёт тот же результат, что и первый.
### 3. Что делает `SKIP LOCKED`? Что сломается без него и чем он отличается от `NOWAIT`?
Он пропускает заблокированные строки  и берёт свободные.
Без него два публикатора отправят два сообщения и пока один публикатор будет читать событие второй вместо того чтобы выполнять работу параллельно будет его ждать. 
NOWAIT выдаёт ошибку когда хоть одна из нужных строк занята, а SKIP LOCKED ошибку не выдаёт а просто берёт другие строки
### 4. Зачем передавать `jobId = id события`, если обработчик и так идемпотентный?
Идемпотентный обработчик защищает от дубля результата (уведомления), а jobId защищает от дубля задачи в очереди. BullMQ не создаёт вторую задачу с тем же jobId, поэтому повторная публикация того же события не раздувает очередь и не заставляет воркер работать зря.
### 5. Что случится, если приложение запущено в двух экземплярах и в каждом работает свой cron? Как этого избежать?
Публикатор  защищён SKIP LOCKED дублей не будет, очистка сессий безвредна она удаляет уже истёкшие запросы 
Запускать расписание только на одном выделенном экземпляре 
### 6. Как заметить, что публикатор не успевает за потоком событий?
GET /admin/outbox/stats: число неопубликованных растёт, а возраст самого старого события тоже растёт. Если число стоит на месте, а возраст растёт, публикатор остановился (Redis недоступен или процесс не работает).
### 7. Когда и как чистить `outbox_events`?
На большой таблице удалять лучше пачками (по несколько тысяч строк), а не одним DELETE, иначе долгая транзакция блокирует таблицу. Частичный индекс по created_at WHERE published_at IS NULL обслуживает публикатор, а для удаления по published_at на огромной таблице понадобился бы свой индекс или партиционирование по дате.
