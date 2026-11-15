import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReconciliationReports1793800000000 implements MigrationInterface {
  name = 'ReconciliationReports1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reconciliation_reports" (
        "id" SERIAL NOT NULL,
        "checked_wallets" integer NOT NULL,
        "mismatches" jsonb NOT NULL DEFAULT '[]',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reconciliation_reports" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reconciliation_reports"`);
  }
}
