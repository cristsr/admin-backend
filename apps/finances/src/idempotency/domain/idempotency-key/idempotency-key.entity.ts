import { ObjectLiteral, PropertiesOnly } from '@shared';
import { IdempotencyStatus } from './idempotency-key.types';

/**
 * A user-scoped idempotency record (AC-3, sm-0003). The first request reserves
 * the key as PENDING; on completion its response is stored so a replay of the
 * same key + body returns the same result, and a different body is rejected.
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
