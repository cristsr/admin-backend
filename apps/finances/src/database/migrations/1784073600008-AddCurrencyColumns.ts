import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCurrencyColumns1784073600008 implements MigrationInterface {
  name = 'AddCurrencyColumns1784073600008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD COLUMN "currency" character varying(3) NOT NULL DEFAULT 'COP'`,
    );
    await queryRunner.query(
      `ALTER TABLE "movements" ADD COLUMN "currency" character varying(3) NOT NULL DEFAULT 'COP'`,
    );
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD COLUMN "currency" character varying(3) NOT NULL DEFAULT 'COP'`,
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled" ADD COLUMN "currency" character varying(3) NOT NULL DEFAULT 'COP'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "scheduled" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "budgets" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "currency"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "currency"`);
  }
}
