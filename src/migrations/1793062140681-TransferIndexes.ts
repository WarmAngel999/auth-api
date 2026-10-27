import { MigrationInterface, QueryRunner } from "typeorm";

export class TransferIndexes1793062140681 implements MigrationInterface {
    name = 'TransferIndexes1793062140681'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_f81771288d1bdeea832925f9aa" ON "transfers"  ("to_wallet_id", "id") `);
        await queryRunner.query(`CREATE INDEX "IDX_ac4de5745d9432f3678591233c" ON "transfers"  ("from_wallet_id", "id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_ac4de5745d9432f3678591233c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f81771288d1bdeea832925f9aa"`);
    }

}
