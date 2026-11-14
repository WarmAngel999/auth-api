import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboxPublisher1793600000000 implements MigrationInterface {
  name = 'OutboxPublisher1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "outbox_events" RENAME COLUMN "processed_at" TO "published_at"`,
    );
    await queryRunner.query(`DROP INDEX "idx_outbox_unprocessed"`);
    await queryRunner.query(
      `CREATE INDEX "idx_outbox_unpublished" ON "outbox_events" ("created_at") WHERE "published_at" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "outbox_events" DROP CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ALTER COLUMN "id" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ALTER COLUMN "id" TYPE uuid USING gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" ADD CONSTRAINT "PK_6689a16c00d09b8089f6237f1d2" PRIMARY KEY ("id")`,
    );
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "outbox_events_id_seq"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_outbox_unpublished"`);
    await queryRunner.query(
      `CREATE INDEX "idx_outbox_unprocessed" ON "outbox_events" ("published_at") WHERE "published_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "outbox_events" RENAME COLUMN "published_at" TO "processed_at"`,
    );
    // id остаётся uuid: числовой счётчик обратно честно не восстановить
  }
}
