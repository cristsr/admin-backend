import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates the outbox_events table for the transactional outbox. */
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
