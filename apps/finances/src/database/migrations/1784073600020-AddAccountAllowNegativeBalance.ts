import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-1 (sm-0003) — per-account policy for negative balance. Debit accounts keep
 * false; credit-card-like accounts set true so transfers that would leave them
 * negative are not rejected.
 */
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
