import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Money was stored as integer, which silently rounds any decimal amount
 * (10.50 -> 11) with no error. Postgres numeric(14,2) is exact and is the
 * only safe representation for money here.
 *
 * Widening integer -> numeric is lossless, so `up` needs no data migration.
 * `down` is lossy by nature (it must round), and is written to be explicit
 * about that rather than silently truncating.
 */
export class MoneyAsNumeric1784073600011 implements MigrationInterface {
  name = 'MoneyAsNumeric1784073600011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "initial_balance" TYPE numeric(14,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ALTER COLUMN "amount" TYPE numeric(14,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ALTER COLUMN "amount" TYPE numeric(14,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled" ALTER COLUMN "amount" TYPE numeric(14,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scheduled" ALTER COLUMN "amount" TYPE integer USING ROUND("amount")`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ALTER COLUMN "amount" TYPE integer USING ROUND("amount")`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ALTER COLUMN "amount" TYPE integer USING ROUND("amount")`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "initial_balance" TYPE integer USING ROUND("initial_balance")`,
    );
  }
}
