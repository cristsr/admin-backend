import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The append-only event store (§6.1): the ledger's source of truth. Optimistic
 * concurrency via UNIQUE (aggregate_id, sequence); idempotency via the partial
 * UNIQUE (user_id, external_ref); immutability enforced by a trigger (INV-12).
 */
export class CreateEventStore1790000000001 implements MigrationInterface {
  name = 'CreateEventStore1790000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_store" (
        "global_position" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "event_id"        UUID NOT NULL UNIQUE,
        "user_id"         UUID NOT NULL,
        "aggregate_type"  TEXT NOT NULL,
        "aggregate_id"    UUID NOT NULL,
        "sequence"        BIGINT NOT NULL,
        "event_type"      TEXT NOT NULL,
        "schema_version"  SMALLINT NOT NULL DEFAULT 1,
        "client_id"       TEXT NOT NULL,
        "external_ref"    TEXT,
        "payload"         JSONB NOT NULL,
        "occurred_at"     TIMESTAMPTZ NOT NULL,
        "recorded_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_event_aggregate_sequence" UNIQUE ("aggregate_id", "sequence")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "idx_event_external_ref"
        ON "event_store" ("user_id", "external_ref")
        WHERE "external_ref" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_event_aggregate" ON "event_store" ("aggregate_id", "sequence")
    `);

    await queryRunner.query(`
      CREATE INDEX "idx_event_user" ON "event_store" ("user_id", "global_position")
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION reject_event_mutation() RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'event_store is append-only';
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_event_store_immutable"
        BEFORE UPDATE OR DELETE ON "event_store"
        FOR EACH ROW EXECUTE FUNCTION reject_event_mutation()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_event_store_immutable" ON "event_store"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS reject_event_mutation()`);
    await queryRunner.query(`DROP TABLE "event_store"`);
  }
}
