import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds budgets.notified_threshold to track the highest threshold already alerted. */
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
