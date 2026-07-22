import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubcategoriesBaseColumns1784073600007 implements MigrationInterface {
  name = 'AddSubcategoriesBaseColumns1784073600007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subcategories"
        ADD COLUMN "active" boolean NOT NULL DEFAULT true,
        ADD COLUMN "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        ADD COLUMN "updated_at" timestamp with time zone,
        ADD COLUMN "deleted_at" timestamp with time zone
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subcategories"
        DROP COLUMN "deleted_at",
        DROP COLUMN "updated_at",
        DROP COLUMN "created_at",
        DROP COLUMN "active"
    `);
  }
}
