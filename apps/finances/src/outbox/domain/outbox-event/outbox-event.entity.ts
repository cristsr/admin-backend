import { ObjectLiteral, PropertiesOnly } from '@shared';
import { OutboxStatus } from './outbox-event.types';

/**
 * A domain event persisted transactionally with the change that produced it
 * (AC-2, sm-0003). A relay re-emits it in-process so no event is lost if the
 * process dies between the commit and the handler.
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
