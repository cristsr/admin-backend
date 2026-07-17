import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `active` sat on every table next to `deleted_at`, with no rule telling the
 * two apart, and every query had to filter both. Soft-delete already says
 * whether a row is gone, so the flag is dropped everywhere it meant nothing.
 *
 * budgets keeps it, where it means something else entirely: whether the budget
 * is the current period. When a repeating budget rolls over, the previous one
 * is deactivated and kept as history — that is not a deletion.
 */
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
    await queryRunner.query(
      `ALTER TABLE "scheduled" ADD "active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ADD "active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "subcategories" ADD "active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD "active" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD "active" boolean NOT NULL DEFAULT true`,
    );
  }
}
