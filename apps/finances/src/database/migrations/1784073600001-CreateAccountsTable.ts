import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAccountsTable1784073600001 implements MigrationInterface {
  name = 'CreateAccountsTable1784073600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" SERIAL PRIMARY KEY,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone,
        "deleted_at" timestamp with time zone,
        "name" character varying NOT NULL,
        "initial_balance" integer,
        "user_id" integer
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "accounts"`);
  }
}
