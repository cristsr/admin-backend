import { Injectable, Logger } from '@nestjs/common';
import { AdjustmentAuditProjector } from '@ledger/reconciliation/application/projectors/adjustment-audit.projector';
import { AssertionStatusProjector } from '@ledger/reconciliation/application/projectors/assertion-status.projector';
import { ReevaluateAssertionsReactor } from '@ledger/reconciliation/application/reactors/reevaluate-assertions.reactor';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';

/** How many events a single `readAll` slice pulls from the global stream. */
const BATCH_SIZE = 100;

/**
 * Drives the reconciliation read models and {@link ReevaluateAssertionsReactor}
 * from the global stream with a checkpoint (molded on the outbox relay of
 * `apps/finances`): at-least-once delivery, which is safe because both the
 * projections and re-evaluation are idempotent. Each event first updates the
 * projections, then feeds the reactor — so a reactor lookup always reads a
 * current `assertion_status` (§3.2). The checkpoint is a `bigint` global
 * position (never `number`) to match the real store.
 */
@Injectable()
export class ReevaluateAssertionsEventHandler {
  private readonly logger = new Logger(ReevaluateAssertionsEventHandler.name);
  private checkpoint = 0n;

  constructor(
    private readonly eventStore: EventStore,
    private readonly reactor: ReevaluateAssertionsReactor,
    private readonly statusProjector: AssertionStatusProjector,
    private readonly auditProjector: AdjustmentAuditProjector,
  ) {}

  /** Consumes every event past the checkpoint; advances it only on success. */
  async pump(): Promise<void> {
    let batch = await this.eventStore.readAll(this.checkpoint, BATCH_SIZE);

    while (batch.length) {
      for (const event of batch) {
        await this.handle(event);
        this.checkpoint = event.globalPosition;
      }

      batch = await this.eventStore.readAll(this.checkpoint, BATCH_SIZE);
    }
  }

  get currentCheckpoint(): bigint {
    return this.checkpoint;
  }

  private async handle(event: StoredEvent): Promise<void> {
    try {
      await this.statusProjector.project(event);
      await this.auditProjector.project(event);
      await this.reactor.on(event);
    } catch (error) {
      // A silently failing pump breaks re-evaluation invisibly (RNF-12): surface
      // it and stop so the checkpoint does not skip the event.
      this.logger.error(`Reconciliation pump failed at position ${event.globalPosition}`, error as Error);
      throw error;
    }
  }
}
