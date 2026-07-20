import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates the idempotency_keys table for idempotent user writes. */
export class CreateIdempotencyKeysTable1784073600022
  implements MigrationInterface
{
  name = 'CreateIdempotencyKeysTable1784073600022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "idempotency_keys" (
        "id"              SERIAL PRIMARY KEY,
        "idempotency_key" varchar NOT NULL,
        "user_id"         integer NOT NULL,
        "endpoint"        varchar NOT NULL,
        "request_hash"    varchar NOT NULL,
        "status"          varchar NOT NULL DEFAULT 'PENDING',
        "response_status" integer,
        "response_body"   jsonb,
        "created_at"      timestamptz NOT NULL DEFAULT NOW(),
        "expires_at"      timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_idempotency_user_key" ON "idempotency_keys" ("user_id", "idempotency_key")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_idempotency_expires_at" ON "idempotency_keys" ("expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_idempotency_expires_at"`);
    await queryRunner.query(`DROP INDEX "uq_idempotency_user_key"`);
    await queryRunner.query(`DROP TABLE "idempotency_keys"`);
  }
}
