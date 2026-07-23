import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core read-model tables (§6.2): the account tree, the denormalized transaction
 * list with its postings, and balances. Deliberately free of business
 * constraints — the stream is the source of truth and these are rebuildable.
 */
export class CreateCoreProjections1790000000003 implements MigrationInterface {
  name = 'CreateCoreProjections1790000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "proj_accounts" (
        "account_id"     UUID PRIMARY KEY,
        "user_id"        UUID NOT NULL,
        "type"           TEXT NOT NULL,
        "name"           TEXT NOT NULL,
        "parent_id"      UUID,
        "currency_code"  TEXT,
        "opened_on"      DATE NOT NULL,
        "closed_on"      DATE,
        "is_bank_mirror" BOOLEAN NOT NULL,
        "is_system"      BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_proj_accounts_user" ON "proj_accounts" ("user_id", "name")`);

    await queryRunner.query(`
      CREATE TABLE "proj_transactions" (
        "transaction_id" UUID PRIMARY KEY,
        "user_id"        UUID NOT NULL,
        "date"           DATE NOT NULL,
        "occurred_at"    TIMESTAMPTZ,
        "payee"          TEXT,
        "description"    TEXT NOT NULL,
        "status"         TEXT NOT NULL,
        "derived_kind"   TEXT NOT NULL,
        "invoice_url"    TEXT,
        "tags"           TEXT[] NOT NULL DEFAULT '{}',
        "client_id"      TEXT NOT NULL,
        "external_ref"   TEXT,
        "reverses_id"    UUID,
        "metadata"       JSONB NOT NULL DEFAULT '{}'
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_proj_txn_user_date" ON "proj_transactions" ("user_id", "date")`);
    await queryRunner.query(`CREATE INDEX "idx_proj_txn_payee" ON "proj_transactions" ("user_id", "payee")`);

    await queryRunner.query(`
      CREATE TABLE "proj_postings" (
        "posting_id"     TEXT PRIMARY KEY,
        "transaction_id" UUID NOT NULL,
        "user_id"        UUID NOT NULL,
        "account_id"     UUID NOT NULL,
        "amount"         NUMERIC(20, 6) NOT NULL,
        "currency_code"  TEXT NOT NULL,
        "status"         TEXT NOT NULL,
        "date"           DATE NOT NULL,
        "metadata"       JSONB NOT NULL DEFAULT '{}'
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_proj_postings_account" ON "proj_postings" ("account_id", "date")`);
    await queryRunner.query(`CREATE INDEX "idx_proj_postings_txn" ON "proj_postings" ("transaction_id")`);

    await queryRunner.query(`
      CREATE TABLE "proj_balances" (
        "account_id"       UUID NOT NULL,
        "currency_code"    TEXT NOT NULL,
        "confirmed_amount" NUMERIC(20, 6) NOT NULL DEFAULT 0,
        "pending_amount"   NUMERIC(20, 6) NOT NULL DEFAULT 0,
        "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY ("account_id", "currency_code")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "proj_balances"`);
    await queryRunner.query(`DROP TABLE "proj_postings"`);
    await queryRunner.query(`DROP TABLE "proj_transactions"`);
    await queryRunner.query(`DROP TABLE "proj_accounts"`);
  }
}
