import { ObjectLiteral, PropertiesOnly } from '@shared';
import { IdempotencyStatus } from './idempotency-key.types';

/**
 * User-scoped idempotency record: the first request reserves the key, and its
 * stored response is replayed when the same key and body arrive again.
 */
export class IdempotencyKey {
  id: number;

  idempotencyKey: string;

  userId: number;

  endpoint: string;

  requestHash: string;

  status: IdempotencyStatus;

  responseStatus?: number;

  responseBody?: ObjectLiteral;

  createdAt: Date;

  expiresAt: Date;

  private constructor(payload?: Partial<IdempotencyKey>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<IdempotencyKey>): IdempotencyKey {
    return new IdempotencyKey(payload);
  }
}
