warning: in the working copy of 'src/app.module.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/auth/auth.module.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/auth/auth.service.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/migrations/1792531907267-Wallet.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/migrations/1792616499442-TransferTypes.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/migrations/1793062140681-TransferIndexes.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/migrations/1793530000000-TransferNoSelf.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/users/users.service.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/wallet/dto/deposit.dto.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/wallet/dto/transfer.dto.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/wallet/transfer.entity.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/wallet/wallet.controller.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/wallet/wallet.entity.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/wallet/wallet.module.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'src/wallet/wallet.service.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'test/setup-env.ts', LF will be replaced by CRLF the next time Git touches it
warning: in the working copy of 'test/wallet.e2e-spec.ts', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/README.md b/README.md[m
[1mindex f5ca320..81fc361 100644[m
[1m--- a/README.md[m
[1m+++ b/README.md[m
[36m@@ -32,8 +32,8 @@[m [mRefresh-токен живёт 7 дней, его хэш хранится в ба[m
 [m
 ## Миграции[m
 [m
[31m-В `NODE_ENV=development` схема создаётся автоматически (`synchronize`).[m
[31m-В остальных окружениях приложение при старте само применяет миграции из `src/migrations`.[m
[32m+[m[32mСхема базы создаётся только миграциями (`synchronize: false` во всех окружениях).[m
[32m+[m[32mПриложение при старте само применяет все ещё не применённые миграции из `src/migrations`.[m
 [m
 Команды (работают через сборку проекта):[m
 ```[m
[36m@@ -41,13 +41,40 @@[m [mnpm run migration:generate -- src/migrations/ИмяМиграции[m
 npm run migration:run[m
 npm run migration:revert[m
 ```[m
[31m-Миграцию генерируют на базе, схема которой создана только миграциями[m
[31m-(не на базе разработки, где её ведёт `synchronize`).[m
[32m+[m[32mПрименённую миграцию не правят: изменения вносят новой миграцией.[m
[32m+[m[32mSQL-запросы пишутся в лог только при `NODE_ENV=development`, ошибки SQL логируются всегда.[m
 [m
[32m+[m[32m## Кошелёк[m
 [m
[31m-## Транзакции[m
[31m-суммы хранятся в копейках (целые числа);[m
[31m-эндпоинты: GET /wallet, POST /wallet/deposit, POST /wallet/transfer, GET /wallet/transactions?limit=&offset=;[m
[31m-для перевода обязателен заголовок Idempotency-Key (клиент генерирует уникальный ключ на операцию и повторяет его при ретрае);[m
[31m-коды ошибок: 400 (сумма, нет средств, нет ключа), 404 (нет получателя), 409 (ключ с другими данными);[m
[31m-защита: транзакция, блокировка кошельков в одном порядке, CHECK (balance >= 0), уникальный индекс ключа.[m
[32m+[m[32mСуммы хранятся в копейках (целые числа).[m
[32m+[m
[32m+[m[32m| Метод | Путь | Доступ | Описание |[m
[32m+[m[32m|-------|------|--------|----------|[m
[32m+[m[32m| GET | /wallet | пользователь | кошелёк и баланс |[m
[32m+[m[32m| POST | /wallet/deposit | admin | пополнение своего кошелька (остальным 403) |[m
[32m+[m[32m| POST | /wallet/transfer | пользователь | перевод, заголовок `Idempotency-Key` обязателен |[m
[32m+[m[32m| GET | /wallet/transactions?limit=&cursor= | пользователь | история, курсорная пагинация |[m
[32m+[m
[32m+[m[32mИстория: `limit` от 1 до 100 (по умолчанию 20), `cursor` — id последней записи[m
[32m+[m[32mпредыдущей страницы. Ответ: `{ items, nextCursor }`, на последней странице[m
[32m+[m[32m`nextCursor = null`. Элемент: `id`, `type`, `direction` (in/out), `amount`,[m
[32m+[m[32m`counterpartyUserId` (null у пополнения), `createdAt`.[m
[32m+[m
[32m+[m[32mКоды ошибок: 400 (сумма, нет средств, нет ключа, неверные `limit`/`cursor`),[m
[32m+[m[32m401 (нет токена), 403 (не admin), 404 (нет получателя), 409 (ключ с другими данными).[m
[32m+[m
[32m+[m[32mЗащита: транзакция, блокировка кошельков в одном порядке, `CHECK (balance >= 0)`,[m
[32m+[m[32m`CHECK (from_wallet_id <> to_wallet_id)`, уникальный индекс ключа идемпотентности.[m
[32m+[m
[32m+[m[32m### Запрос истории[m
[32m+[m
[32m+[m[32mЗапрос построен через `UNION ALL` двух подзапросов (по `from_wallet_id` и по[m
[32m+[m[32m`to_wallet_id`), каждый идёт по своему индексу `(wallet_id, id)`.[m
[32m+[m[32mВставь сюда `EXPLAIN ANALYZE` до и после (плотный и разреженный кошелёк).[m
[32m+[m[32m## Тесты[m
[32m+[m
[32m+[m[32m```[m
[32m+[m[32mnpm run test:e2e[m
[32m+[m[32m```[m
[32m+[m[32mНужна база `auth_test`. Перед прогоном `test/global-setup.ts` очищает её и поднимает схему[m
[32m+[m[32mмиграциями; тесты работают только с `auth_test` и при другом имени базы останавливаются.[m
[1mdiff --git a/package-lock.json b/package-lock.json[m
[1mindex a9eba4b..aee96ad 100644[m
[1m--- a/package-lock.json[m
[1m+++ b/package-lock.json[m
[36m@@ -41,6 +41,7 @@[m
         "@types/passport-jwt": "^4.0.1",[m
         "@types/passport-local": "^1.0.38",[m
         "@types/supertest": "^7.0.0",[m
[32m+[m[32m        "dotenv": "^18.0.9",[m
         "jest": "^30.0.0",[m
         "oxlint": "^1.58.0",[m
         "oxlint-tsgolint": "^7.0.2001",[m
[36m@@ -1735,6 +1736,21 @@[m
         "rxjs": "^7.1.0"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/@nestjs/config/node_modules/dotenv": {[m
[32m+[m[32m      "version": "18.0.3",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/dotenv/-/dotenv-18.0.3.tgz",[m
[32m+[m[32m      "integrity": "sha512-/8CJTyL817qPnfbQrJgOEcrU3fDrJkRIoXBE566wHuvIXKOCHUZhPqGPbCPi9SogjdGnreF0TlvnTgK6J/8zpA==",[m
[32m+[m[32m      "license": "BSD-2-Clause",[m
[32m+[m[32m      "bin": {[m
[32m+[m[32m        "dotenv": "dist/index.cjs"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=12"[m
[32m+[m[32m      },[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "url": "https://dotenvx.com"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/@nestjs/core": {[m
       "version": "12.1.2",[m
       "resolved": "https://registry.npmjs.org/@nestjs/core/-/core-12.1.2.tgz",[m
[36m@@ -4859,9 +4875,10 @@[m
       }[m
     },[m
     "node_modules/dotenv": {[m
[31m-      "version": "18.0.3",[m
[31m-      "resolved": "https://registry.npmjs.org/dotenv/-/dotenv-18.0.3.tgz",[m
[31m-      "integrity": "sha512-/8CJTyL817qPnfbQrJgOEcrU3fDrJkRIoXBE566wHuvIXKOCHUZhPqGPbCPi9SogjdGnreF0TlvnTgK6J/8zpA==",[m
[32m+[m[32m      "version": "18.0.9",[m
[32m+[m[32m      "resolved": "https://registry.npmjs.org/dotenv/-/dotenv-18.0.9.tgz",[m
[32m+[m[32m      "integrity": "sha512-3fVOW4cB02R066PUSwn8O4TJyz9NckQl7F81blIbaq9jKBm2tSmOKky7ZHIXzGvkVPXCSn6jkpziBPZdGFs8Tw==",[m
[32m+[m[32m      "dev": true,[m
       "license": "BSD-2-Clause",[m
       "bin": {[m
         "dotenv": "dist/index.cjs"[m
[1mdiff --git a/package.json b/package.json[m
[1mindex 787cb65..775d8f9 100644[m
[1m--- a/package.json[m
[1m+++ b/package.json[m
[36m@@ -10,12 +10,13 @@[m
     "build": "nest build",[m
     "deploy": "nest deploy",[m
     "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",[m
[32m+[m[32m    "format:check": "prettier --check \"src/**/*.ts\" \"test/**/*.ts\"",[m
     "start": "nest start",[m
     "start:dev": "nest start --watch",[m
     "start:debug": "nest start --debug --watch",[m
     "start:prod": "node dist/main",[m
     "lint": "oxlint --type-aware src/ test/",[m
[31m-    "test": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js",[m
[32m+[m[32m    "test": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js --passWithNoTests",[m
     "test:watch": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js --watch",[m
     "test:cov": "node --experimental-vm-modules ./node_modules/jest/bin/jest.js --coverage",[m
     "test:debug": "node --inspect-brk --experimental-vm-modules -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",[m
[36m@@ -57,6 +58,7 @@[m
     "@types/passport-jwt": "^4.0.1",[m
     "@types/passport-local": "^1.0.38",[m
     "@types/supertest": "^7.0.0",[m
[32m+[m[32m    "dotenv": "^18.0.9",[m
     "jest": "^30.0.0",[m
     "oxlint": "^1.58.0",[m
     "oxlint-tsgolint": "^7.0.2001",[m
[1mdiff --git a/src/app.module.ts b/src/app.module.ts[m
[1mindex 552e921..acb48b5 100644[m
[1m--- a/src/app.module.ts[m
[1m+++ b/src/app.module.ts[m
[36m@@ -41,9 +41,12 @@[m [mimport { WalletModule } from './wallet/wallet.module';[m
         database: config.get('DB_NAME'),[m
         autoLoadEntities: true,[m
         synchronize: false,[m
[31m-        logging: ['query'],[m
[31m-        migrations: [__dirname + '/migrations/*.js'],[m
[31m-        migrationsRun: config.get('NODE_ENV') !== 'development',[m
[32m+[m[32m        logging:[m
[32m+[m[32m          config.get('NODE_ENV') === 'development'[m
[32m+[m[32m            ? ['query', 'error'][m
[32m+[m[32m            : ['error'],[m
[32m+[m[32m        migrations: [__dirname + '/migrations/*.{ts,js}'],[m
[32m+[m[32m        migrationsRun: true,[m
       }),[m
     }),[m
     UsersModule,[m
[1mdiff --git a/src/migrations/1792531907267-Wallet.ts b/src/migrations/1792531907267-Wallet.ts[m
[1mindex 7ee725d..3e58ff1 100644[m
[1m--- a/src/migrations/1792531907267-Wallet.ts[m
[1m+++ b/src/migrations/1792531907267-Wallet.ts[m
[36m@@ -1,24 +1,43 @@[m
[31m-import { MigrationInterface, QueryRunner } from "typeorm";[m
[32m+[m[32mimport { MigrationInterface, QueryRunner } from 'typeorm';[m
 [m
 export class Wallet1792531907267 implements MigrationInterface {[m
[31m-    name = 'Wallet1792531907267'[m
[32m+[m[32m  name = 'Wallet1792531907267';[m
 [m
[31m-    public async up(queryRunner: QueryRunner): Promise<void> {[m
[31m-        await queryRunner.query(`CREATE TABLE "wallets" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "balance" bigint NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_92558c08091598f7a4439586cda" UNIQUE ("user_id"), CONSTRAINT "REL_92558c08091598f7a4439586cd" UNIQUE ("user_id"), CONSTRAINT "CHK_85653df8d42151cc73643e0534" CHECK ("balance" >= 0), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`);[m
[31m-        await queryRunner.query(`CREATE TABLE "transfers" ("id" SERIAL NOT NULL, "from_wallet_id" integer NOT NULL, "to_wallet_id" integer NOT NULL, "amount" bigint NOT NULL, "idempotency_key" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_e56b38900a24943d38b5e705a2" CHECK ("amount" > 0), CONSTRAINT "PK_f712e908b465e0085b4408cabc3" PRIMARY KEY ("id"))`);[m
[31m-        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4e904613f0dc6b9365e0c17414" ON "transfers"  ("from_wallet_id", "idempotency_key") `);[m
[31m-        await queryRunner.query(`ALTER TABLE "wallets" ADD CONSTRAINT "FK_92558c08091598f7a4439586cda" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_1a07635b8213a2a49f4933ba7af" FOREIGN KEY ("to_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);[m
[31m-    }[m
[31m-[m
[31m-    public async down(queryRunner: QueryRunner): Promise<void> {[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_1a07635b8213a2a49f4933ba7af"`);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d"`);[m
[31m-        await queryRunner.query(`ALTER TABLE "wallets" DROP CONSTRAINT "FK_92558c08091598f7a4439586cda"`);[m
[31m-        await queryRunner.query(`DROP INDEX "public"."IDX_4e904613f0dc6b9365e0c17414"`);[m
[31m-        await queryRunner.query(`DROP TABLE "transfers"`);[m
[31m-        await queryRunner.query(`DROP TABLE "wallets"`);[m
[31m-    }[m
[32m+[m[32m  public async up(queryRunner: QueryRunner): Promise<void> {[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `CREATE TABLE "wallets" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "balance" bigint NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_92558c08091598f7a4439586cda" UNIQUE ("user_id"), CONSTRAINT "REL_92558c08091598f7a4439586cd" UNIQUE ("user_id"), CONSTRAINT "CHK_85653df8d42151cc73643e0534" CHECK ("balance" >= 0), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `CREATE TABLE "transfers" ("id" SERIAL NOT NULL, "from_wallet_id" integer NOT NULL, "to_wallet_id" integer NOT NULL, "amount" bigint NOT NULL, "idempotency_key" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_e56b38900a24943d38b5e705a2" CHECK ("amount" > 0), CONSTRAINT "PK_f712e908b465e0085b4408cabc3" PRIMARY KEY ("id"))`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `CREATE UNIQUE INDEX "IDX_4e904613f0dc6b9365e0c17414" ON "transfers"  ("from_wallet_id", "idempotency_key") `,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "wallets" ADD CONSTRAINT "FK_92558c08091598f7a4439586cda" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" ADD CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" ADD CONSTRAINT "FK_1a07635b8213a2a49f4933ba7af" FOREIGN KEY ("to_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
 [m
[32m+[m[32m  public async down(queryRunner: QueryRunner): Promise<void> {[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" DROP CONSTRAINT "FK_1a07635b8213a2a49f4933ba7af"`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" DROP CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d"`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "wallets" DROP CONSTRAINT "FK_92558c08091598f7a4439586cda"`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `DROP INDEX "public"."IDX_4e904613f0dc6b9365e0c17414"`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query(`DROP TABLE "transfers"`);[m
[32m+[m[32m    await queryRunner.query(`DROP TABLE "wallets"`);[m
[32m+[m[32m  }[m
 }[m
[1mdiff --git a/src/migrations/1792616499442-TransferTypes.ts b/src/migrations/1792616499442-TransferTypes.ts[m
[1mindex 82890ec..5d338ca 100644[m
[1m--- a/src/migrations/1792616499442-TransferTypes.ts[m
[1m+++ b/src/migrations/1792616499442-TransferTypes.ts[m
[36m@@ -1,26 +1,51 @@[m
[31m-import { MigrationInterface, QueryRunner } from "typeorm";[m
[32m+[m[32mimport { MigrationInterface, QueryRunner } from 'typeorm';[m
 [m
 export class TransferTypes1792616499442 implements MigrationInterface {[m
[31m-    name = 'TransferTypes1792616499442'[m
[32m+[m[32m  name = 'TransferTypes1792616499442';[m
 [m
[31m-    public async up(queryRunner: QueryRunner): Promise<void> {[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" ADD "type" character varying(20) NOT NULL DEFAULT 'transfer'`);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d"`);[m
[31m-        await queryRunner.query(`DROP INDEX "public"."IDX_4e904613f0dc6b9365e0c17414"`);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "from_wallet_id" DROP NOT NULL`);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "idempotency_key" DROP NOT NULL`);[m
[31m-        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4e904613f0dc6b9365e0c17414" ON "transfers"  ("from_wallet_id", "idempotency_key") `);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);[m
[31m-    }[m
[31m-[m
[31m-    public async down(queryRunner: QueryRunner): Promise<void> {[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d"`);[m
[31m-        await queryRunner.query(`DROP INDEX "public"."IDX_4e904613f0dc6b9365e0c17414"`);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "idempotency_key" SET NOT NULL`);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "from_wallet_id" SET NOT NULL`);[m
[31m-        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4e904613f0dc6b9365e0c17414" ON "transfers" USING btree ("from_wallet_id", "idempotency_key") `);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);[m
[31m-        await queryRunner.query(`ALTER TABLE "transfers" DROP COLUMN "type"`);[m
[31m-    }[m
[32m+[m[32m  public async up(queryRunner: QueryRunner): Promise<void> {[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" ADD "type" character varying(20) NOT NULL DEFAULT 'transfer'`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" DROP CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d"`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `DROP INDEX "public"."IDX_4e904613f0dc6b9365e0c17414"`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" ALTER COLUMN "from_wallet_id" DROP NOT NULL`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" ALTER COLUMN "idempotency_key" DROP NOT NULL`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `CREATE UNIQUE INDEX "IDX_4e904613f0dc6b9365e0c17414" ON "transfers"  ("from_wallet_id", "idempotency_key") `,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" ADD CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
 [m
[32m+[m[32m  public async down(queryRunner: QueryRunner): Promise<void> {[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" DROP CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d"`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `DROP INDEX "public"."IDX_4e904613f0dc6b9365e0c17414"`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" ALTER COLUMN "idempotency_key" SET NOT NULL`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" ALTER COLUMN "from_wallet_id" SET NOT NULL`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `CREATE UNIQUE INDEX "IDX_4e904613f0dc6b9365e0c17414" ON "transfers" USING btree ("from_wallet_id", "idempotency_key") `,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" ADD CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query(`ALTER TABLE "transfers" DROP COLUMN "type"`);[m
[32m+[m[32m  }[m
 }[m
[1mdiff --git a/src/migrations/1793062140681-TransferIndexes.ts b/src/migrations/1793062140681-TransferIndexes.ts[m
[1mindex cb998f8..8045012 100644[m
[1m--- a/src/migrations/1793062140681-TransferIndexes.ts[m
[1m+++ b/src/migrations/1793062140681-TransferIndexes.ts[m
[36m@@ -1,16 +1,23 @@[m
[31m-import { MigrationInterface, QueryRunner } from "typeorm";[m
[32m+[m[32mimport { MigrationInterface, QueryRunner } from 'typeorm';[m
 [m
 export class TransferIndexes1793062140681 implements MigrationInterface {[m
[31m-    name = 'TransferIndexes1793062140681'[m
[32m+[m[32m  name = 'TransferIndexes1793062140681';[m
 [m
[31m-    public async up(queryRunner: QueryRunner): Promise<void> {[m
[31m-        await queryRunner.query(`CREATE INDEX "IDX_f81771288d1bdeea832925f9aa" ON "transfers"  ("to_wallet_id", "id") `);[m
[31m-        await queryRunner.query(`CREATE INDEX "IDX_ac4de5745d9432f3678591233c" ON "transfers"  ("from_wallet_id", "id") `);[m
[31m-    }[m
[31m-[m
[31m-    public async down(queryRunner: QueryRunner): Promise<void> {[m
[31m-        await queryRunner.query(`DROP INDEX "public"."IDX_ac4de5745d9432f3678591233c"`);[m
[31m-        await queryRunner.query(`DROP INDEX "public"."IDX_f81771288d1bdeea832925f9aa"`);[m
[31m-    }[m
[32m+[m[32m  public async up(queryRunner: QueryRunner): Promise<void> {[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `CREATE INDEX "IDX_f81771288d1bdeea832925f9aa" ON "transfers"  ("to_wallet_id", "id") `,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `CREATE INDEX "IDX_ac4de5745d9432f3678591233c" ON "transfers"  ("from_wallet_id", "id") `,[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
 [m
[32m+[m[32m  public async down(queryRunner: QueryRunner): Promise<void> {[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `DROP INDEX "public"."IDX_ac4de5745d9432f3678591233c"`,[m
[32m+[m[32m    );[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `DROP INDEX "public"."IDX_f81771288d1bdeea832925f9aa"`,[m
[32m+[m[32m    );[m
[32m+[m[32m  }[m
 }[m
[1mdiff --git a/src/migrations/1793530000000-TransferNoSelf.ts b/src/migrations/1793530000000-TransferNoSelf.ts[m
[1mindex d473be2..bef09da 100644[m
[1m--- a/src/migrations/1793530000000-TransferNoSelf.ts[m
[1m+++ b/src/migrations/1793530000000-TransferNoSelf.ts[m
[36m@@ -10,6 +10,8 @@[m [mexport class TransferNoSelf1793530000000 implements MigrationInterface {[m
   }[m
 [m
   public async down(queryRunner: QueryRunner): Promise<void> {[m
[31m-    await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "chk_transfers_no_self"`);[m
[32m+[m[32m    await queryRunner.query([m
[32m+[m[32m      `ALTER TABLE "transfers" DROP CONSTRAINT "chk_transfers_no_self"`,[m
[32m+[m[32m    );[m
   }[m
 }[m
[1mdiff --git a/src/wallet/transfer.entity.ts b/src/wallet/transfer.entity.ts[m
[1mindex 62ee347..85540a2 100644[m
[1m--- a/src/wallet/transfer.entity.ts[m
[1m+++ b/src/wallet/transfer.entity.ts[m
[36m@@ -10,7 +10,10 @@[m [mimport {[m
 } from 'typeorm';[m
 import { Wallet } from './wallet.entity';[m
 [m
[31m-const bigintTransformer = { to: (v: number) => v, from: (v: string) => Number(v) };[m
[32m+[m[32mconst bigintTransformer = {[m
[32m+[m[32m  to: (v: number) => v,[m
[32m+[m[32m  from: (v: string) => Number(v),[m
[32m+[m[32m};[m
 [m
 @Entity('transfers')[m
 @Index(['fromWalletId', 'idempotencyKey'], { unique: true })[m
[36m@@ -41,7 +44,12 @@[m [mexport class Transfer {[m
   @Column({ type: 'bigint', transformer: bigintTransformer })[m
   amount: number;[m
 [m
[31m-  @Column({ name: 'idempotency_key', type: 'varchar', length: 100, nullable: true })[m
[32m+[m[32m  @Column({[m
[32m+[m[32m    name: 'idempotency_key',[m
[32m+[m[32m    type: 'varchar',[m
[32m+[m[32m    length: 100,[m
[32m+[m[32m    nullable: true,[m
[32m+[m[32m  })[m
   idempotencyKey: string | null;[m
 [m
   @CreateDateColumn({ name: 'created_at' })[m
[1mdiff --git a/src/wallet/wallet.controller.ts b/src/wallet/wallet.controller.ts[m
[1mindex 8a99885..2db7758 100644[m
[1m--- a/src/wallet/wallet.controller.ts[m
[1m+++ b/src/wallet/wallet.controller.ts[m
[36m@@ -17,9 +17,9 @@[m [mimport { DepositDto } from './dto/deposit.dto';[m
 import { TransferDto } from './dto/transfer.dto';[m
 // путь к guard оставь тот, который у тебя уже был в этом файле[m
 import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';[m
[31m-import {RolesGuard} from "../auth/guards/roles.guard";[m
[31m-import {Roles} from "../auth/decorators/roles.decorator";[m
[31m-import {Role} from "../users/role.enum";[m
[32m+[m[32mimport { RolesGuard } from '../auth/guards/roles.guard';[m
[32m+[m[32mimport { Roles } from '../auth/decorators/roles.decorator';[m
[32m+[m[32mimport { Role } from '../users/role.enum';[m
 [m
 type AuthRequest = Request & { user: { id: number } };[m
 [m
[1mdiff --git a/src/wallet/wallet.entity.ts b/src/wallet/wallet.entity.ts[m
[1mindex 350b9b8..6831d76 100644[m
[1m--- a/src/wallet/wallet.entity.ts[m
[1m+++ b/src/wallet/wallet.entity.ts[m
[36m@@ -22,7 +22,11 @@[m [mexport class Wallet {[m
   @Column({ name: 'user_id', unique: true })[m
   userId: number;[m
 [m
[31m-  @Column({ type: 'bigint', default: 0, transformer: { to: (v: number) => v, from: (v: string) => Number(v) } })[m
[32m+[m[32m  @Column({[m
[32m+[m[32m    type: 'bigint',[m
[32m+[m[32m    default: 0,[m
[32m+[m[32m    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },[m
[32m+[m[32m  })[m
   balance: number;[m
 [m
   @CreateDateColumn({ name: 'created_at' })[m
[1mdiff --git a/src/wallet/wallet.service.ts b/src/wallet/wallet.service.ts[m
[1mindex cb07358..2344568 100644[m
[1m--- a/src/wallet/wallet.service.ts[m
[1m+++ b/src/wallet/wallet.service.ts[m
[36m@@ -1,5 +1,8 @@[m
 import {[m
[31m-  BadRequestException, ConflictException, Injectable, NotFoundException,[m
[32m+[m[32m  BadRequestException,[m
[32m+[m[32m  ConflictException,[m
[32m+[m[32m  Injectable,[m
[32m+[m[32m  NotFoundException,[m
 } from '@nestjs/common';[m
 import { InjectRepository } from '@nestjs/typeorm';[m
 import { DataSource, In, Repository } from 'typeorm';[m
[36m@@ -54,7 +57,9 @@[m [mexport class WalletService {[m
     if (fromUserId === toUserId) {[m
       throw new BadRequestException('cannot transfer to yourself');[m
     }[m
[31m-    const toExists = await this.dataSource.getRepository(User).existsBy({ id: toUserId });[m
[32m+[m[32m    const toExists = await this.dataSource[m
[32m+[m[32m      .getRepository(User)[m
[32m+[m[32m      .existsBy({ id: toUserId });[m
     if (!toExists) throw new NotFoundException('recipient not found');[m
 [m
     const from = await this.getOrCreate(fromUserId);[m
[36m@@ -76,7 +81,9 @@[m [mexport class WalletService {[m
         });[m
         if (existing) {[m
           if (existing.toWalletId !== to.id || existing.amount !== amount) {[m
[31m-            throw new ConflictException('idempotency key reused with different data');[m
[32m+[m[32m            throw new ConflictException([m
[32m+[m[32m              'idempotency key reused with different data',[m
[32m+[m[32m            );[m
           }[m
           return existing;[m
         }[m
[36m@@ -156,7 +163,9 @@[m [mexport class WalletService {[m
         direction: Number(r.to_wallet_id) === wallet.id ? 'in' : 'out',[m
         amount: Number(r.amount),[m
         counterpartyUserId:[m
[31m-          r.counterparty_user_id === null ? null : Number(r.counterparty_user_id),[m
[32m+[m[32m          r.counterparty_user_id === null[m
[32m+[m[32m            ? null[m
[32m+[m[32m            : Number(r.counterparty_user_id),[m
         createdAt: r.created_at,[m
       })),[m
       nextCursor: hasMore ? Number(page[page.length - 1].id) : null,[m
[1mdiff --git a/test/setup-env.ts b/test/setup-env.ts[m
[1mindex e6ca0f7..168cddb 100644[m
[1m--- a/test/setup-env.ts[m
[1m+++ b/test/setup-env.ts[m
[36m@@ -1,3 +1,3 @@[m
 // выполняется до загрузки тестов и направляет приложение на тестовую базу[m
 process.env.DB_NAME = 'auth_test';[m
[31m-process.env.NODE_ENV = 'development';[m
[32m+[m[32mprocess.env.NODE_ENV = 'test';[m
[1mdiff --git a/test/wallet.e2e-spec.ts b/test/wallet.e2e-spec.ts[m
[1mindex c07626c..540d7b0 100644[m
[1m--- a/test/wallet.e2e-spec.ts[m
[1m+++ b/test/wallet.e2e-spec.ts[m
[36m@@ -22,20 +22,36 @@[m [mdescribe('Wallet (e2e)', () => {[m
   const createUser = async (email: string, role: 'user' | 'admin' = 'user') => {[m
     await http().post('/auth/register').send({ email, password: PASSWORD });[m
     if (role === 'admin') {[m
[31m-      await dataSource.query('UPDATE users SET role = $1 WHERE email = $2', [role, email]);[m
[32m+[m[32m      await dataSource.query('UPDATE users SET role = $1 WHERE email = $2', [[m
[32m+[m[32m        role,[m
[32m+[m[32m        email,[m
[32m+[m[32m      ]);[m
     }[m
[31m-    const res = await http().post('/auth/login').send({ email, password: PASSWORD });[m
[32m+[m[32m    const res = await http()[m
[32m+[m[32m      .post('/auth/login')[m
[32m+[m[32m      .send({ email, password: PASSWORD });[m
     const token = res.body.accessToken as string;[m
     if (!token) throw new Error('login did not return accessToken');[m
[31m-    const [row] = await dataSource.query('SELECT id FROM users WHERE email = $1', [email]);[m
[32m+[m[32m    const [row] = await dataSource.query([m
[32m+[m[32m      'SELECT id FROM users WHERE email = $1',[m
[32m+[m[32m      [email],[m
[32m+[m[32m    );[m
     return { id: row.id as number, token };[m
   };[m
 [m
   const deposit = (token: string, amount: number) =>[m
     http().post('/wallet/deposit').set(bearer(token)).send({ amount });[m
 [m
[31m-  const transfer = (token: string, toUserId: number, amount: number, key?: string) => {[m
[31m-    const req = http().post('/wallet/transfer').set(bearer(token)).send({ toUserId, amount });[m
[32m+[m[32m  const transfer = ([m
[32m+[m[32m    token: string,[m
[32m+[m[32m    toUserId: number,[m
[32m+[m[32m    amount: number,[m
[32m+[m[32m    key?: string,[m
[32m+[m[32m  ) => {[m
[32m+[m[32m    const req = http()[m
[32m+[m[32m      .post('/wallet/transfer')[m
[32m+[m[32m      .set(bearer(token))[m
[32m+[m[32m      .send({ toUserId, amount });[m
     return key ? req.set('Idempotency-Key', key) : req;[m
   };[m
 [m
[36m@@ -83,9 +99,15 @@[m [mdescribe('Wallet (e2e)', () => {[m
       await deposit(alice.token, 10000).expect(201);[m
       expect(await balance(alice.token)).toBe(10000);[m
 [m
[31m-      const res = await http().get('/wallet/transactions').set(bearer(alice.token));[m
[32m+[m[32m      const res = await http()[m
[32m+[m[32m        .get('/wallet/transactions')[m
[32m+[m[32m        .set(bearer(alice.token));[m
       expect(res.body.items).toHaveLength(1);[m
[31m-      expect(res.body.items[0]).toMatchObject({ type: 'deposit', direction: 'in', amount: 10000 });[m
[32m+[m[32m      expect(res.body.items[0]).toMatchObject({[m
[32m+[m[32m        type: 'deposit',[m
[32m+[m[32m        direction: 'in',[m
[32m+[m[32m        amount: 10000,[m
[32m+[m[32m      });[m
       expect(res.body.items[0]).not.toHaveProperty('counterparty');[m
     });[m
 [m
[36m@@ -125,12 +147,28 @@[m [mdescribe('Wallet (e2e)', () => {[m
       expect(await balance(alice.token)).toBe(7000);[m
       expect(await balance(bob.token)).toBe(3000);[m
 [m
[31m-      const a = await http().get('/wallet/transactions').set(bearer(alice.token));[m
[32m+[m[32m      const a = await http()[m
[32m+[m[32m        .get('/wallet/transactions')[m
[32m+[m[32m        .set(bearer(alice.token));[m
       const b = await http().get('/wallet/transactions').set(bearer(bob.token));[m
[31m-      expect(a.body.items[0]).toMatchObject({ type: 'transfer', direction: 'out', amount: 3000 });[m
[31m-      expect(b.body.items[0]).toMatchObject({ type: 'transfer', direction: 'in', amount: 3000 });[m
[31m-      expect(a.body.items[0]).toMatchObject({ direction: 'out', counterpartyUserId: bob.id });[m
[31m-      expect(b.body.items[0]).toMatchObject({ direction: 'in', counterpartyUserId: alice.id });[m
[32m+[m[32m      expect(a.body.items[0]).toMatchObject({[m
[32m+[m[32m        type: 'transfer',[m
[32m+[m[32m        direction: 'out',[m
[32m+[m[32m        amount: 3000,[m
[32m+[m[32m      });[m
[32m+[m[32m      expect(b.body.items[0]).toMatchObject({[m
[32m+[m[32m        type: 'transfer',[m
[32m+[m[32m        direction: 'in',[m
[32m+[m[32m        amount: 3000,[m
[32m+[m[32m      });[m
[32m+[m[32m      expect(a.body.items[0]).toMatchObject({[m
[32m+[m[32m        direction: 'out',[m
[32m+[m[32m        counterpartyUserId: bob.id,[m
[32m+[m[32m      });[m
[32m+[m[32m      expect(b.body.items[0]).toMatchObject({[m
[32m+[m[32m        direction: 'in',[m
[32m+[m[32m        counterpartyUserId: alice.id,[m
[32m+[m[32m      });[m
     });[m
 [m
     it('rejects an amount above the balance and changes nothing', async () => {[m
[36m@@ -141,7 +179,9 @@[m [mdescribe('Wallet (e2e)', () => {[m
 [m
     it('does not charge twice for a repeated idempotency key', async () => {[m
       const first = await transfer(alice.token, bob.id, 3000, 'k1').expect(201);[m
[31m-      const second = await transfer(alice.token, bob.id, 3000, 'k1').expect(201);[m
[32m+[m[32m      const second = await transfer(alice.token, bob.id, 3000, 'k1').expect([m
[32m+[m[32m        201,[m
[32m+[m[32m      );[m
 [m
       expect(second.body.id).toBe(first.body.id);[m
       expect(await balance(alice.token)).toBe(7000);[m
[36m@@ -168,7 +208,9 @@[m [mdescribe('Wallet (e2e)', () => {[m
       await deposit(alice.token, 10000).expect(201);[m
 [m
       const results = await Promise.all([m
[31m-        Array.from({ length: 10 }, () => transfer(alice.token, bob.id, 5000, 'same-key')),[m
[32m+[m[32m        Array.from({ length: 10 }, () =>[m
[32m+[m[32m          transfer(alice.token, bob.id, 5000, 'same-key'),[m
[32m+[m[32m        ),[m
       );[m
 [m
       expect(results.every((r) => r.status === 201)).toBe(true);[m
[36m@@ -186,7 +228,9 @@[m [mdescribe('Wallet (e2e)', () => {[m
       await deposit(alice.token, 10000).expect(201);[m
 [m
       const results = await Promise.all([m
[31m-        Array.from({ length: 10 }, (_, i) => transfer(alice.token, bob.id, 3000, `key-${i}`)),[m
[32m+[m[32m        Array.from({ length: 10 }, (_, i) =>[m
[32m+[m[32m          transfer(alice.token, bob.id, 3000, `key-${i}`),[m
[32m+[m[32m        ),[m
       );[m
 [m
       const ok = results.filter((r) => r.status === 201).length;[m
[36m@@ -239,11 +283,9 @@[m [mdescribe('Wallet (e2e)', () => {[m
       let cursor: string | null = null;[m
       let guard = 0;[m
       do {[m
[31m-        const res: { body: { items: { id: number }[]; nextCursor: string | null } } = await page([m
[31m-          alice.token,[m
[31m-          2,[m
[31m-          cursor,[m
[31m-        ).expect(200);[m
[32m+[m[32m        const res: {[m
[32m+[m[32m          body: { items: { id: number }[]; nextCursor: string | null };[m
[32m+[m[32m        } = await page(alice.token, 2, cursor).expect(200);[m
         collected.push(...res.body.items.map((x) => x.id));[m
         cursor = res.body.nextCursor;[m
       } while (cursor && ++guard < 10);[m
