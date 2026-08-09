import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The append-only event store: the source of truth for any application built on
 * this library. Optimistic concurrency via UNIQUE (aggregate_id, sequence);
 * idempotency via the partial UNIQUE (user_id, external_ref); immutability
 * enforced by a trigger. Since hu-0024, every event also carries a chain hash
 * (`hash`, AC-2) and, on the anchor event, the hash of its command's inputs
 * (`external_ref_hash`, AC-5) — both `NOT NULL`/CHECK-enforced (AC-8), no
 * legacy row without them can exist.
 *
 * Ships with the library rather than with a consumer because it is the schema
 * `PostgresEventStore` requires to work at all — an app that owned it could
 * drift from the adapter that reads it.
 */
export class CreateEventStore1790000000001 implements MigrationInterface {
  name = 'CreateEventStore1790000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "event_store" (
        "global_position"   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        "event_id"          UUID NOT NULL UNIQUE,
        "user_id"           UUID NOT NULL,
        "aggregate_type"    TEXT NOT NULL,
        "aggregate_id"      UUID NOT NULL,
        "sequence"          BIGINT NOT NULL,
        "event_type"        TEXT NOT NULL,
        "schema_version"    SMALLINT NOT NULL DEFAULT 1,
        "client_id"         TEXT NOT NULL,
        "external_ref"      TEXT,
        "external_ref_hash" CHAR(64),
        "payload"           JSONB NOT NULL,
        "hash"              CHAR(64) NOT NULL,
        "occurred_at"       TIMESTAMPTZ NOT NULL,
        "recorded_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_event_aggregate_sequence" UNIQUE ("aggregate_id", "sequence"),
        CONSTRAINT "ck_event_external_ref_hash"
          CHECK (("external_ref" IS NULL) = ("external_ref_hash" IS NULL))
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
