import { ObjectLiteral, PropertiesOnly } from '@shared';
import { OutboxStatus } from './outbox-event.types';

/**
 * Domain event persisted with the change that produced it; a relay re-emits it
 * so nothing is lost if the process dies after the commit.
 */
export class OutboxEvent {
  id: number;

  eventType: string;

  payload: ObjectLiteral;

  status: OutboxStatus;

  attempts: number;

  lastError?: string;

  availableAt: Date;

  createdAt: Date;

  processedAt?: Date;

  private constructor(payload?: Partial<OutboxEvent>) {
    Object.assign(this, payload);
  }

  static create(payload: PropertiesOnly<OutboxEvent>): OutboxEvent {
    return new OutboxEvent(payload);
  }
}
