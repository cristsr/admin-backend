import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Read-model table for the per-user ledger settings, maintained by
 * `LedgerSettingsProjector` from `LedgerInitialized`. Keyed by user id — one row
 * per ledger. Holds the presentation settings plus the two system account ids
 * that reconciliation adjustments and opening balances post against.
 */
export class CreateLedgerSettingsProjection1790000000004 implements MigrationInterface {
  name = 'CreateLedgerSettingsProjection1790000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "proj_ledger_settings" (
        "user_id"                     UUID PRIMARY KEY,
        "presentation_currency"       TEXT NOT NULL,
        "timezone"                    TEXT NOT NULL,
        "opening_balances_account_id" UUID NOT NULL,
        "adjustments_account_id"      UUID NOT NULL,
        "is_initialized"              BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "proj_ledger_settings"`);
  }
}
