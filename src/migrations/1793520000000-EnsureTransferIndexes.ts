import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureTransferIndexes1793520000000 implements MigrationInterface {
  name = 'EnsureTransferIndexes1793520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_f81771288d1bdeea832925f9aa" ON "transfers" ("to_wallet_id", "id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ac4de5745d9432f3678591233c" ON "transfers" ("from_wallet_id", "id")`,
    );
  }

  public async down(): Promise<void> {
    // индексы принадлежат миграции TransferIndexes, здесь ничего не откатываем
  }
}
