import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notifications1793700000000 implements MigrationInterface {
  name = 'Notifications1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" SERIAL NOT NULL,
        "user_id" integer NOT NULL,
        "event_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "text" text NOT NULL,
        "read_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notifications_event_id" UNIQUE ("event_id"),
        CONSTRAINT "FK_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_user_id_id" ON "notifications" ("user_id", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_notifications_unread" ON "notifications" ("user_id") WHERE "read_at" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notifications"`);
  }
}
