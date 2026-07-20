import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates the categorization_rules table for user-defined auto-categorization. */
export class CreateCategorizationRulesTable1784073600024
  implements MigrationInterface
{
  name = 'CreateCategorizationRulesTable1784073600024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categorization_rules" (
        "id"             SERIAL PRIMARY KEY,
        "user_id"        integer NOT NULL,
        "pattern"        varchar NOT NULL,
        "category_id"    integer NOT NULL,
        "subcategory_id" integer,
        "priority"       integer NOT NULL DEFAULT 0,
        "created_at"     timestamptz NOT NULL DEFAULT NOW(),
        "updated_at"     timestamptz,
        "deleted_at"     timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_categorization_rules_user_priority" ON "categorization_rules" ("user_id", "priority")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "idx_categorization_rules_user_priority"`,
    );
    await queryRunner.query(`DROP TABLE "categorization_rules"`);
  }
}
