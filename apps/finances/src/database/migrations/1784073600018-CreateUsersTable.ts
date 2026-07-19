import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `users` table in the finances database. Brought over from the
 * former standalone `users` service when it was folded into this monolith;
 * schema mirrors {@link UserEntity}.
 */
export class CreateUsersTable1784073600018 implements MigrationInterface {
  name = 'CreateUsersTable1784073600018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" SERIAL PRIMARY KEY,
        "name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "email" character varying NOT NULL,
        "auth0_id" character varying,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "UQ_users_auth0_id" UNIQUE ("auth0_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_auth0_id" ON "users" ("auth0_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
