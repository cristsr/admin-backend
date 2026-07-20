import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds accounts.allow_negative_balance so credit-like accounts can go negative. */
export class AddAccountAllowNegativeBalance1784073600020
  implements MigrationInterface
{
  name = 'AddAccountAllowNegativeBalance1784073600020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD "allow_negative_balance" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP COLUMN "allow_negative_balance"`,
    );
  }
}
