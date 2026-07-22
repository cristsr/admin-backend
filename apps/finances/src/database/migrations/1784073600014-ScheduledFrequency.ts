import { MigrationInterface, QueryRunner } from 'typeorm';

/** Replaces the scheduled.repeat boolean with a frequency column. */
export class ScheduledFrequency1784073600014 implements MigrationInterface {
  name = 'ScheduledFrequency1784073600014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "scheduled" ADD "frequency" character varying`);
    await queryRunner.query(
      `UPDATE "scheduled" SET "frequency" = CASE WHEN "repeat" = true THEN 'MONTHLY' ELSE 'ONCE' END`,
    );
    await queryRunner.query(`ALTER TABLE "scheduled" ALTER COLUMN "frequency" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "scheduled" DROP COLUMN "repeat"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "scheduled" ADD "repeat" boolean`);
    await queryRunner.query(`UPDATE "scheduled" SET "repeat" = ("frequency" <> 'ONCE')`);
    await queryRunner.query(`ALTER TABLE "scheduled" DROP COLUMN "frequency"`);
  }
}
