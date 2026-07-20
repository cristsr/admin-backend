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
 * the interceptor so write controllers can opt in per endpoint, and the
 * repository it depends on: `@UseInterceptors(IdempotencyInterceptor)` makes
 * Nest instantiate the interceptor inside the *consumer's* module, so that
 * module has to be able to resolve the repository too.
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
