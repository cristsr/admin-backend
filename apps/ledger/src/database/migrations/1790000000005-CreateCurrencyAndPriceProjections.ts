import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCurrencyAndPriceProjections1790000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'proj_currencies',
        columns: [
          {
            name: 'code',
            type: 'varchar',
            length: '3',
            isPrimary: true,
          },
          {
            name: 'minor_units',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'proj_prices',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isGenerated: true,
            generationStrategy: 'uuid',
            isPrimary: true,
          },
          {
            name: 'base',
            type: 'varchar',
            length: '3',
            isNullable: false,
          },
          {
            name: 'quote',
            type: 'varchar',
            length: '3',
            isNullable: false,
          },
          {
            name: 'date',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'rate',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'source',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'global_position',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      'proj_prices',
      new TableIndex({
        name: 'idx_proj_prices_lookup',
        columnNames: ['base', 'quote', 'date', 'source', 'global_position'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('proj_prices');
    await queryRunner.dropTable('proj_currencies');
  }
}
