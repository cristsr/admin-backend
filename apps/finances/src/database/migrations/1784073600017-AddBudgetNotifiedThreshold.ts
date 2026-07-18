import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records how far a budget has already alerted in its current period, so each
 * threshold (WARNING/EXCEEDED) is notified once per period instead of on every
 * movement that keeps it over the line (AC-1). Enum-like value stored as
 * varchar; NULL means nothing notified yet.
 */
export class AddBudgetNotifiedThreshold1784073600017
  implements MigrationInterface
{
  name = 'AddBudgetNotifiedThreshold1784073600017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD "notified_threshold" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budgets" DROP COLUMN "notified_threshold"`,
    );
  }
}
