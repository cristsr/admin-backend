import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMovementExternalReference1784073600009
  implements MigrationInterface
{
  name = 'AddMovementExternalReference1784073600009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "movements"
        ADD COLUMN "external_reference" character varying
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_movements_external_reference"
        ON "movements" ("external_reference")
        WHERE "external_reference" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "UQ_movements_external_reference"`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" DROP COLUMN "external_reference"`,
    );
  }
}
