import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converts budgets.period from a Postgres enum to varchar. Enum-like columns
 * are kept as text at the database level; the allowed values live in the
 * application layer (the Period enum). This is the one enum left from before
 * that convention, so it is migrated forward rather than editing the original
 * create-table migration.
 */
export class PeriodAsVarchar1784073600013 implements MigrationInterface {
  name = 'PeriodAsVarchar1784073600013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budgets" ALTER COLUMN "period" TYPE character varying USING "period"::text`,
    );
    await queryRunner.query(`DROP TYPE "budgets_period_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "budgets_period_enum" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM')`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ALTER COLUMN "period" TYPE "budgets_period_enum" USING "period"::"budgets_period_enum"`,
    );
  }
}
