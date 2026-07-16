import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBudgetsTable1784073600004 implements MigrationInterface {
  name = 'CreateBudgetsTable1784073600004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "budgets_period_enum" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM')
    `);

    await queryRunner.query(`
      CREATE TABLE "budgets" (
        "id" SERIAL PRIMARY KEY,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone,
        "deleted_at" timestamp with time zone,
        "name" character varying NOT NULL,
        "amount" integer NOT NULL,
        "start_date" timestamp NOT NULL,
        "end_date" timestamp NOT NULL,
        "repeat" boolean NOT NULL,
        "period" "budgets_period_enum" NOT NULL DEFAULT 'MONTHLY',
        "category_id" integer,
        "account_id" integer,
        "user_id" integer,
        CONSTRAINT "FK_budgets_category" FOREIGN KEY ("category_id")
          REFERENCES "categories" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_budgets_account" FOREIGN KEY ("account_id")
          REFERENCES "accounts" ("id") ON DELETE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "budgets"`);
    await queryRunner.query(`DROP TYPE "budgets_period_enum"`);
  }
}
