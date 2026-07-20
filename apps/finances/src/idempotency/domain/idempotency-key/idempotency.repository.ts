import { ObjectLiteral } from '@shared';
import { IdempotencyKey } from './idempotency-key.entity';
import { IdempotencyReservation } from './idempotency-reservation.type';

export abstract class IdempotencyRepository {
  /**
   * Atomically inserts a PENDING row; on unique conflict returns the existing
   * one instead, with `created` false.
   */
  abstract reserve(
    reservation: IdempotencyReservation,
  ): Promise<{ created: boolean; row: IdempotencyKey }>;

  abstract complete(
    id: number,
    responseStatus: number,
    responseBody: ObjectLiteral,
  ): Promise<void>;

  /** Drops a failed request's reservation so the key becomes usable again. */
  abstract release(id: number): Promise<void>;

  abstract deleteExpired(now: Date): Promise<number>;
}
