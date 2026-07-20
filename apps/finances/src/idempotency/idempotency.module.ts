import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdempotencyRepository } from './domain/idempotency-key';
import { IdempotencyInterceptor } from './infrastructure/adapters/http';
import {
  TypeOrmIdempotencyKeyEntity,
  TypeOrmIdempotencyRepository,
} from './infrastructure/adapters/persistence/typeorm';
import { IdempotencyPurgeScheduler } from './infrastructure/adapters/schedulers/idempotency-purge.scheduler';

/**
 * Exports the repository too: `@UseInterceptors(IdempotencyInterceptor)` makes
 * Nest resolve the interceptor inside the consumer's module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TypeOrmIdempotencyKeyEntity])],
  providers: [
    { provide: IdempotencyRepository, useClass: TypeOrmIdempotencyRepository },
    IdempotencyInterceptor,
    IdempotencyPurgeScheduler,
  ],
  exports: [IdempotencyInterceptor, IdempotencyRepository],
})
export class IdempotencyModule {}
