import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config({ path: 'apps/ledger/.env' });

/**
 * CLI entry point for TypeORM migrations of the ledger database. Entities are
 * listed explicitly — none, the write side is event-sourced and the read side
 * is plain projection tables.
 *
 * Two migration sources: the event store and its projection checkpoints are the
 * schema `@cqrs` needs to work at all, so they ship with that library; the
 * projection tables are this ledger's own. They share a database, so they share
 * one migrations table — and the `@cqrs` timestamps come first, which is what
 * keeps the ordering right.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DB_URI,
  entities: [],
  migrations: [
    'libs/cqrs/src/infrastructure/adapters/migrations/*.ts',
    'apps/ledger/src/database/migrations/*.ts',
  ],
  synchronize: false,
});
