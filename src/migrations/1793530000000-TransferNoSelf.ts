import { MigrationInterface, QueryRunner } from 'typeorm';

export class TransferNoSelf1793530000000 implements MigrationInterface {
  name = 'TransferNoSelf1793530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transfers" ADD CONSTRAINT "chk_transfers_no_self" CHECK (from_wallet_id <> to_wallet_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transfers" DROP CONSTRAINT "chk_transfers_no_self"`,
    );
  }
}
