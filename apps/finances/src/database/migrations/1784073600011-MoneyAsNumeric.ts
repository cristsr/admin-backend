import { MigrationInterface, QueryRunner } from 'typeorm';

/** Stores money columns as numeric(14,2) instead of integer. */
export class MoneyAsNumeric1784073600011 implements MigrationInterface {
  name = 'MoneyAsNumeric1784073600011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" ALTER COLUMN "initial_balance" TYPE numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "movements" ALTER COLUMN "amount" TYPE numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "budgets" ALTER COLUMN "amount" TYPE numeric(14,2)`);
    await queryRunner.query(`ALTER TABLE "scheduled" ALTER COLUMN "amount" TYPE numeric(14,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scheduled" ALTER COLUMN "amount" TYPE integer USING ROUND("amount")`,
    );
    await queryRunner.query(`ALTER TABLE "budgets" ALTER COLUMN "amount" TYPE integer USING ROUND("amount")`);
    await queryRunner.query(
      `ALTER TABLE "movements" ALTER COLUMN "amount" TYPE integer USING ROUND("amount")`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "initial_balance" TYPE integer USING ROUND("initial_balance")`,
    );
  }
}
