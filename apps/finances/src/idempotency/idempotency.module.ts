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
 * AC-3 (sm-0003) — idempotent user writes via an Idempotency-Key header. Exports
 * the interceptor so write controllers can opt in per endpoint.
 */
@Module({
  imports: [TypeOrmModule.forFeature([TypeOrmIdempotencyKeyEntity])],
  providers: [
    { provide: IdempotencyRepository, useClass: TypeOrmIdempotencyRepository },
    IdempotencyInterceptor,
    IdempotencyPurgeScheduler,
  ],
  exports: [IdempotencyInterceptor],
})
export class IdempotencyModule {}
