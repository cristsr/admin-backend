import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AC-2 (sm-0003) — transactional outbox. Domain events are written here in the
 * same transaction as the change that produced them; a relay re-emits pending
 * rows. Status is varchar (enum-like lives in the app layer).
 */
export class CreateOutboxEventsTable1784073600021
  implements MigrationInterface
{
  name = 'CreateOutboxEventsTable1784073600021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id"           SERIAL PRIMARY KEY,
        "event_type"   varchar NOT NULL,
        "payload"      jsonb NOT NULL,
        "status"       varchar NOT NULL DEFAULT 'PENDING',
        "attempts"     integer NOT NULL DEFAULT 0,
        "last_error"   text,
        "available_at" timestamptz NOT NULL DEFAULT NOW(),
        "created_at"   timestamptz NOT NULL DEFAULT NOW(),
        "processed_at" timestamptz
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_outbox_events_pending" ON "outbox_events" ("status", "available_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_outbox_events_pending"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
  }
}
