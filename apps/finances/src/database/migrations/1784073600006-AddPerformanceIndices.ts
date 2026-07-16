import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndices1784073600006
  implements MigrationInterface
{
  name = 'AddPerformanceIndices1784073600006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_movements_user_id" ON "movements" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_movements_date" ON "movements" ("date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_movements_category_id" ON "movements" ("category_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_movements_account_id" ON "movements" ("account_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_budgets_user_id" ON "budgets" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_budgets_account_id" ON "budgets" ("account_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_scheduled_user_id" ON "scheduled" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_scheduled_date" ON "scheduled" ("date")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_subcategories_category_id" ON "subcategories" ("category_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_subcategories_category_id"`);
    await queryRunner.query(`DROP INDEX "IDX_scheduled_date"`);
    await queryRunner.query(`DROP INDEX "IDX_scheduled_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_budgets_account_id"`);
    await queryRunner.query(`DROP INDEX "IDX_budgets_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_movements_account_id"`);
    await queryRunner.query(`DROP INDEX "IDX_movements_category_id"`);
    await queryRunner.query(`DROP INDEX "IDX_movements_date"`);
    await queryRunner.query(`DROP INDEX "IDX_movements_user_id"`);
  }
}
