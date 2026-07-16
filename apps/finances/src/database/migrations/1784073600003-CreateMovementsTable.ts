import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMovementsTable1784073600003 implements MigrationInterface {
  name = 'CreateMovementsTable1784073600003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "movements" (
        "id" SERIAL PRIMARY KEY,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone,
        "deleted_at" timestamp with time zone,
        "date" timestamp with time zone NOT NULL,
        "type" character varying NOT NULL,
        "description" character varying NOT NULL,
        "amount" integer NOT NULL,
        "category_id" integer,
        "subcategory_id" integer,
        "account_id" integer,
        "user_id" integer,
        CONSTRAINT "FK_movements_category" FOREIGN KEY ("category_id")
          REFERENCES "categories" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_movements_subcategory" FOREIGN KEY ("subcategory_id")
          REFERENCES "subcategories" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_movements_account" FOREIGN KEY ("account_id")
          REFERENCES "accounts" ("id") ON DELETE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "movements"`);
  }
}
