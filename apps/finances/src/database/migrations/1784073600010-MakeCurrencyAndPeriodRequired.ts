import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeCurrencyAndPeriodRequired1784073600010
  implements MigrationInterface
{
  name = 'MakeCurrencyAndPeriodRequired1784073600010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled" ALTER COLUMN "currency" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ALTER COLUMN "period" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budgets" ALTER COLUMN "period" SET DEFAULT 'MONTHLY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled" ALTER COLUMN "currency" SET DEFAULT 'COP'`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ALTER COLUMN "currency" SET DEFAULT 'COP'`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ALTER COLUMN "currency" SET DEFAULT 'COP'`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ALTER COLUMN "currency" SET DEFAULT 'COP'`,
    );
  }
}
