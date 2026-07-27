import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core read-model tables (§6.2): the account tree, the denormalized transaction
 * list with its postings, and balances. Constraints stay minimal (§6.3) — the
 * stream is the source of truth and these tables are rebuildable — with the one
 * exception RNF-1 calls for: account names are unique per user.
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
    // Unique, not a plain index: RNF-1 asks that invariants be reinforced in
    // storage "wherever possible", and "one hierarchical name per user" (§2.1.1)
    // is one of those. It is defense in depth exactly like the append-only
    // trigger of §3.7 — the authority stays in the aggregate plus
    // `AccountNameRegistry`; this only refuses to persist a state they already
    // forbid, so §6.3's "deliberately minimal constraints" is not weakened.
    //
    // Verified against the two writers that can produce duplicates: a rename
    // propagating to descendants (`AccountTreeProjector` orders its rewrites so
    // no name is transiently duplicated) and a rebuild (which replays the exact
    // same state sequence the live run produced, and therefore cannot violate
    // what the live run did not). DEFERRABLE INITIALLY DEFERRED was considered
    // and rejected: `PostgresReadModelStore` issues every upsert on its own
    // connection outside any transaction, so deferring the check would defer it
    // to the end of that single statement — no help at all.
    await queryRunner.query(`CREATE UNIQUE INDEX "idx_proj_accounts_user" ON "proj_accounts" ("user_id", "name")`);

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
        -- Denormalized from the transaction so an intraday assertion can order
        -- postings without joining (§2.4). Null when the movement's instant is
        -- unknown, which is what makes a verdict INDETERMINATE rather than wrong.
        "occurred_at"    TIMESTAMPTZ,
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
