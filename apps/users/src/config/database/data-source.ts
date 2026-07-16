import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { UserEntity } from '../../user/entities';

config({ path: 'apps/users/.env' });

export default new DataSource({
  type: 'postgres',
  url: process.env.DB_URI,
  entities: [UserEntity],
  migrations: ['apps/users/src/config/database/migrations/*.ts'],
  synchronize: false,
});
