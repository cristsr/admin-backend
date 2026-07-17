import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces scheduled.repeat (a boolean that said something recurred but never
 * how often) with a real cadence. `date` now holds the next occurrence, which
 * the generator advances after materializing each one.
 *
 * Existing rows: repeat = true had no cadence to recover, so they become
 * MONTHLY — the most common case and the one a user is most likely to have
 * meant; everything else becomes a one-off.
 */
export class ScheduledFrequency1784073600014 implements MigrationInterface {
  name = 'ScheduledFrequency1784073600014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scheduled" ADD "frequency" character varying`,
    );
    await queryRunner.query(
      `UPDATE "scheduled" SET "frequency" = CASE WHEN "repeat" = true THEN 'MONTHLY' ELSE 'ONCE' END`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled" ALTER COLUMN "frequency" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "scheduled" DROP COLUMN "repeat"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "scheduled" ADD "repeat" boolean`);
    await queryRunner.query(
      `UPDATE "scheduled" SET "repeat" = ("frequency" <> 'ONCE')`,
    );
    await queryRunner.query(`ALTER TABLE "scheduled" DROP COLUMN "frequency"`);
  }
}
