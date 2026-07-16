import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCategoriesTable1784073600002 implements MigrationInterface {
  name = 'CreateCategoriesTable1784073600002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" SERIAL PRIMARY KEY,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone,
        "deleted_at" timestamp with time zone,
        "name" character varying NOT NULL,
        "icon" character varying NOT NULL,
        "color" character varying NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "subcategories" (
        "id" SERIAL PRIMARY KEY,
        "name" character varying NOT NULL,
        "category_id" integer NOT NULL,
        CONSTRAINT "FK_subcategories_category" FOREIGN KEY ("category_id")
          REFERENCES "categories" ("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "subcategories"`);
    await queryRunner.query(`DROP TABLE "categories"`);
  }
}
