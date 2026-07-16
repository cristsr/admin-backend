import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { TypeOrmAccountEntity } from '../account/infrastructure/adapters/persistence/typeorm/account';
import { TypeOrmBudgetEntity } from '../budget/infrastructure/adapters/persistence/typeorm/budget';
import { TypeOrmCategoryEntity } from '../category/infrastructure/adapters/persistence/typeorm/category';
import { TypeOrmSubcategoryEntity } from '../category/infrastructure/adapters/persistence/typeorm/subcategory';
import { TypeOrmMovementEntity } from '../movement/infrastructure/adapters/persistence/typeorm/movement';
import { TypeOrmScheduledEntity } from '../scheduled/infrastructure/adapters/persistence/typeorm/scheduled';

config({ path: 'apps/finances/.env' });

export default new DataSource({
  type: 'postgres',
  url: process.env.DB_URI,
  entities: [
    TypeOrmAccountEntity,
    TypeOrmCategoryEntity,
    TypeOrmSubcategoryEntity,
    TypeOrmMovementEntity,
    TypeOrmBudgetEntity,
    TypeOrmScheduledEntity,
  ],
  migrations: ['apps/finances/src/database/migrations/*.ts'],
  synchronize: false,
});
