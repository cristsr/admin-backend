import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds transfer_group to movements to link the two legs of a transfer. */
export class MovementTransferGroup1784073600015 implements MigrationInterface {
  name = 'MovementTransferGroup1784073600015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "movements" ADD "transfer_group" character varying`);
    await queryRunner.query(
      `CREATE INDEX "IDX_movements_transfer_group" ON "movements" ("transfer_group") WHERE "transfer_group" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_movements_transfer_group"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "transfer_group"`);
  }
}
