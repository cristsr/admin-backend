import { ObjectLiteral } from '@shared';
import { IdempotencyKey } from './idempotency-key.entity';

export interface IdempotencyReservation {
  idempotencyKey: string;
  userId: number;
  endpoint: string;
  requestHash: string;
  expiresAt: Date;
}

export abstract class IdempotencyRepository {
  /**
   * Atomically reserve a key. Inserts a PENDING row; on unique conflict returns
   * the existing record instead so the caller can decide replay vs conflict vs
   * in-progress. `created` is false when the row already existed.
   */
  abstract reserve(
    reservation: IdempotencyReservation,
  ): Promise<{ created: boolean; row: IdempotencyKey }>;

  /** Store the final response and mark the record COMPLETED. */
  abstract complete(
    id: number,
    responseStatus: number,
    responseBody: ObjectLiteral,
  ): Promise<void>;

  /**
   * Drop a reservation whose request failed, so the key becomes usable again.
   * A failed request wrote nothing to keep — leaving the row PENDING would lock
   * the key until it expired, answering every retry with "still in progress".
   */
  abstract release(id: number): Promise<void>;

  /** Delete records whose expires_at is in the past. Returns the count. */
  abstract deleteExpired(now: Date): Promise<number>;
}
