import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds merchant, invoice and source columns to movements. */
export class EnrichMovements1784073600012 implements MigrationInterface {
  name = 'EnrichMovements1784073600012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "movements" ADD "merchant" character varying`);
    await queryRunner.query(`ALTER TABLE "movements" ADD "notes" text`);
    await queryRunner.query(`ALTER TABLE "movements" ADD "payment_method" character varying`);
    await queryRunner.query(
      `ALTER TABLE "movements" ADD "source" character varying NOT NULL DEFAULT 'MANUAL'`,
    );
    await queryRunner.query(`ALTER TABLE "movements" ADD "invoice_number" character varying`);
    await queryRunner.query(`ALTER TABLE "movements" ADD "invoice_issuer" character varying`);
    await queryRunner.query(`ALTER TABLE "movements" ADD "invoice_url" character varying`);
    await queryRunner.query(`ALTER TABLE "movements" ADD "invoice_issued_at" TIMESTAMP WITH TIME ZONE`);

    // Rows carrying an external reference came from the webhook.
    await queryRunner.query(
      `UPDATE "movements" SET "source" = 'WEBHOOK' WHERE "external_reference" IS NOT NULL`,
    );

    // IF EXISTS: only synchronize-managed databases ever had this column.
    await queryRunner.query(`ALTER TABLE "scheduled" DROP COLUMN IF EXISTS "external_reference"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "scheduled" ADD "external_reference" character varying`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "invoice_issued_at"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "invoice_url"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "invoice_issuer"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "invoice_number"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "source"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "payment_method"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "notes"`);
    await queryRunner.query(`ALTER TABLE "movements" DROP COLUMN "merchant"`);
  }
}
