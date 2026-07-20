import { MigrationInterface, QueryRunner } from 'typeorm';

/** Creates the exchanges table. */
export class CreateExchangesTable1784073600019 implements MigrationInterface {
  name = 'CreateExchangesTable1784073600019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "exchanges" (
        "id" SERIAL PRIMARY KEY,
        "from" character varying NOT NULL,
        "to" character varying NOT NULL,
        "rate" double precision NOT NULL,
        "date" timestamp NOT NULL,
        "user_id" integer,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now(),
        "deleted_at" timestamp with time zone
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "exchanges"`);
  }
}
