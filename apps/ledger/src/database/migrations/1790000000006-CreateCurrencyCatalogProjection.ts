import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reference currency catalog (§6.2). Deliberately without `user_id`: a
 * currency's decimal precision is universal, not a per-user fact — the one
 * projection in the ledger that is global by design.
 *
 * No seed rows here on purpose. `rebuild currencies` truncates this table and
 * replays the stream, so anything inserted by a migration would disappear on the
 * first rebuild; the ISO base currencies live in the adapter instead.
 */
export class CreateCurrencyCatalogProjection1790000000006 implements MigrationInterface {
  name = 'CreateCurrencyCatalogProjection1790000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "proj_currencies" (
        "code"          TEXT PRIMARY KEY,
        "minor_units"   SMALLINT NOT NULL,
        "name"          TEXT NOT NULL,
        "registered_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "proj_currencies"`);
  }
}
