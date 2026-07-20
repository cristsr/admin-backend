import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds categories.system and seeds the default "Sin categorizar" category. */
export class AddCategorySystemAndSeedDefault1784073600023
  implements MigrationInterface
{
  name = 'AddCategorySystemAndSeedDefault1784073600023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "system" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`
      INSERT INTO "categories" ("name", "icon", "color", "system", "created_at")
      VALUES ('Sin categorizar', 'help-circle', '#9E9E9E', true, NOW())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "categories" WHERE "system" = true AND "name" = 'Sin categorizar'`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "system"`);
  }
}
