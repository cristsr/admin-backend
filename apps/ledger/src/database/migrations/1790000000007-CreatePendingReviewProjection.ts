import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `pending_review` (§3.6): the frontend's review inbox. Holds only transactions
 * awaiting review, so the row disappears on confirm or void — unlike
 * `proj_transactions`, which keeps every transaction for the life of the ledger.
 *
 * Minimal constraints, like the rest of the read side (§6.3): the truth lives in
 * the stream and a projection bug is fixed by rebuilding, never by editing rows.
 */
export class CreatePendingReviewProjection1790000000007 implements MigrationInterface {
  name = 'CreatePendingReviewProjection1790000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "proj_pending_review" (
        "transaction_id" UUID PRIMARY KEY,
        "user_id"        UUID NOT NULL,
        "date"           DATE NOT NULL,
        "occurred_at"    TIMESTAMPTZ NOT NULL,
        "payee"          TEXT,
        "description"    TEXT NOT NULL,
        "posting_count"  INTEGER NOT NULL,
        "client_id"      TEXT NOT NULL,
        "external_ref"   TEXT
      )
    `);

    // The inbox is always read per user, oldest first (INV-9).
    await queryRunner.query(`
      CREATE INDEX "idx_proj_pending_review_user"
        ON "proj_pending_review" ("user_id", "date")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "proj_pending_review"`);
  }
}
