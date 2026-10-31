import { MigrationInterface, QueryRunner } from "typeorm";

export class OutboxEvents1793486174692 implements MigrationInterface {
    name = 'OutboxEvents1793486174692'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f81771288d1bdeea832925f9aa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ac4de5745d9432f3678591233c"`);
        await queryRunner.query(`CREATE TABLE "outbox_events" ("id" SERIAL NOT NULL, "type" character varying NOT NULL, "payload" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "processed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_outbox_unprocessed" ON "outbox_events"  ("processed_at") WHERE "processed_at" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_outbox_unprocessed"`);
        await queryRunner.query(`DROP TABLE "outbox_events"`);
        await queryRunner.query(`CREATE INDEX "IDX_ac4de5745d9432f3678591233c" ON "transfers" USING btree ("id", "from_wallet_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_f81771288d1bdeea832925f9aa" ON "transfers" USING btree ("id", "to_wallet_id") `);
    }

}
