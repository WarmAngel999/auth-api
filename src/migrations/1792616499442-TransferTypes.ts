import { MigrationInterface, QueryRunner } from "typeorm";

export class TransferTypes1792616499442 implements MigrationInterface {
    name = 'TransferTypes1792616499442'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transfers" ADD "type" character varying(20) NOT NULL DEFAULT 'transfer'`);
        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e904613f0dc6b9365e0c17414"`);
        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "from_wallet_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "idempotency_key" DROP NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4e904613f0dc6b9365e0c17414" ON "transfers"  ("from_wallet_id", "idempotency_key") `);
        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transfers" DROP CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4e904613f0dc6b9365e0c17414"`);
        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "idempotency_key" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transfers" ALTER COLUMN "from_wallet_id" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4e904613f0dc6b9365e0c17414" ON "transfers" USING btree ("from_wallet_id", "idempotency_key") `);
        await queryRunner.query(`ALTER TABLE "transfers" ADD CONSTRAINT "FK_f6caf20d8fa02090ef9a643925d" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transfers" DROP COLUMN "type"`);
    }

}
