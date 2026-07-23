import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config({ path: 'apps/ledger/.env' });

/**
 * CLI entry point for TypeORM migrations of the ledger database. Entities are
 * listed explicitly — none yet, the event store schema arrives with EP-1.5 —
 * and migrations live next to this file.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DB_URI,
  entities: [],
  migrations: ['apps/ledger/src/database/migrations/*.ts'],
  synchronize: false,
});
