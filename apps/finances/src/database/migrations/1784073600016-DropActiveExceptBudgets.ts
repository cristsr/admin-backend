import { MigrationInterface, QueryRunner } from 'typeorm';

/** Drops the redundant active column from all tables except budgets. */
export class DropActiveExceptBudgets1784073600016 implements MigrationInterface {
  name = 'DropActiveExceptBudgets1784073600016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "active"`);
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "active"`);
    await queryRunner.query(`ALTER TABLE "subcategories" DROP COLUMN "active"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "active"`);
    await queryRunner.query(`ALTER TABLE "scheduled" DROP COLUMN "active"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "scheduled" ADD "active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "movements" ADD "active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "subcategories" ADD "active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "categories" ADD "active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "active" boolean NOT NULL DEFAULT true`);
  }
}
