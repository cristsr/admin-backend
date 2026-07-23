import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBudgetAndGoalProjections1790000000006 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'proj_budgets',
        columns: [
          { name: 'budget_id', type: 'uuid', isPrimary: true },
          { name: 'category', type: 'varchar', isNullable: false },
          { name: 'period', type: 'varchar', length: '20', isNullable: false },
          { name: 'limit_amount', type: 'varchar', isNullable: false },
          { name: 'currency', type: 'varchar', length: '3', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'proj_budgets',
      new TableIndex({ name: 'idx_proj_budgets_category_period', columnNames: ['category', 'period'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'proj_goals',
        columns: [
          { name: 'goal_id', type: 'uuid', isPrimary: true },
          { name: 'name', type: 'varchar', isNullable: false },
          { name: 'target_amount', type: 'varchar', isNullable: false },
          { name: 'target_date', type: 'date', isNullable: false },
          { name: 'achieved', type: 'boolean', default: false },
          { name: 'achieved_at', type: 'varchar', isNullable: true },
          { name: 'updated_at', type: 'timestamptz', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'proj_goals',
      new TableIndex({ name: 'idx_proj_goals_achieved', columnNames: ['achieved'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('proj_goals');
    await queryRunner.dropTable('proj_budgets');
  }
}
