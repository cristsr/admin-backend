import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Read-model tables for reconciliation (§6.2). No
 * business constraints: the truth lives in the event stream and a bug is fixed
 * by rebuild (§6.3). `NUMERIC(20,6)` materializes amounts; exact arithmetic
 * stays in the `Money` value object. Enum-like columns are `TEXT` (no DB enums).
 */
export class CreateReconciliationProjections1790000000005 implements MigrationInterface {
  name = 'CreateReconciliationProjections1790000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "proj_assertions" (
        "assertion_id"    uuid PRIMARY KEY,
        "user_id"         uuid NOT NULL,
        "account_id"      uuid NOT NULL,
        "date"            date NOT NULL,
        "occurred_at"     timestamptz,
        "expected_amount" numeric(20, 6) NOT NULL,
        "currency_code"   text NOT NULL,
        "tolerance"       numeric(20, 6) NOT NULL DEFAULT 0,
        "status"          text NOT NULL,
        "difference"      numeric(20, 6),
        "resolved_by_txn" uuid,
        "revoke_reason"   text,
        "checked_at"      timestamptz,
        "created_at"      timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_proj_assertions_account"
        ON "proj_assertions" ("user_id", "account_id", "date")
        WHERE "status" <> 'REVOKED'
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_proj_assertions_user_status"
        ON "proj_assertions" ("user_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE "proj_adjustment_audit" (
        "user_id"          uuid NOT NULL,
        "account_id"       uuid NOT NULL,
        "currency_code"    text NOT NULL,
        "total_adjusted"   numeric(20, 6) NOT NULL DEFAULT 0,
        "adjustment_count" integer NOT NULL DEFAULT 0,
        "last_adjusted_on" date,
        "updated_at"       timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id", "account_id", "currency_code")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "proj_adjustment_audit_entries" (
        "adjustment_txn_id" uuid PRIMARY KEY,
        "user_id"           uuid NOT NULL,
        "account_id"        uuid NOT NULL,
        "assertion_id"      uuid NOT NULL,
        "amount"            numeric(20, 6) NOT NULL,
        "currency_code"     text NOT NULL,
        "resolved_on"       date NOT NULL,
        "created_at"        timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_adjustment_entries_account"
        ON "proj_adjustment_audit_entries" ("user_id", "account_id")
    `);

  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "proj_adjustment_audit_entries"`);
    await queryRunner.query(`DROP TABLE "proj_adjustment_audit"`);
    await queryRunner.query(`DROP TABLE "proj_assertions"`);
  }
}
