import { MigrationInterface, QueryRunner } from 'typeorm';

/** Projection checkpoints for async catch-up and rebuild (§6.1, RNF-5). */
export class CreateProjectionCheckpoints1790000000002 implements MigrationInterface {
  name = 'CreateProjectionCheckpoints1790000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "projection_checkpoints" (
        "projection_name" TEXT PRIMARY KEY,
        "last_position"   BIGINT NOT NULL,
        "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "projection_checkpoints"`);
  }
}
