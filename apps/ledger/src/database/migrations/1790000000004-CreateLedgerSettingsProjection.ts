import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateLedgerSettingsProjection1790000000004
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'proj_ledger_settings',
        columns: [
          {
            name: 'user_id',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'presentation_currency',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'timezone',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'now()',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('proj_ledger_settings');
  }
}
