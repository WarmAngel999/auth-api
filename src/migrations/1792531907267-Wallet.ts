import { MigrationInterface, QueryRunner } from "typeorm";

export class Wallet1792531907267 implements MigrationInterface {
    name = 'Wallet1792531907267'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "wallets" ("id" SERIAL NOT NULL, "user_id" integer NOT NULL, "balance" bigint NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_92558c08091598f7a4439586cda" UNIQUE ("user_id"), CONSTRAINT "REL_92558c08091598f7a4439586cd" UNIQUE ("user_id"), CONSTRAINT "CHK_85653df8d42151cc73643e0534" CHECK ("balance" >= 0), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "transfers" ("id" SERIAL NOT NULL, "from_wallet_id" integer NOT NULL, "to_wallet_id" integer NOT NULL, "amount" bigint NOT NULL, "idempotency_key" character varying(100) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "CHK_e56b38900a24943d38b5e705a2" CHECK ("amount" > 0), CONSTRAINT "PK_f712e908b465e0085b4408cabc3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4e904613f0dc6b9365e0c17414" ON "transfers"  ("from_wallet_id", "idempotency_key") `);
        await queryRunner.query(`ALTER TABLE "wallets" ADD CONSTRAINT "FK_92558c08091598f7a4439586cda" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_1a07635b8213a2a49f4933ba7af" FOREIGN KEY ("to_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_1a07635b8213a2a49f4933ba7af"`);
        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d"`);
        await queryRunner.query(`ALTER TABLE "wallets" DROP CONSTRAINT "FK_92558c08091598f7a4439586cda"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e904613f0dc6b9365e0c17414"`);
        await queryRunner.query(`DROP TABLE "transfers"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
    }

}
