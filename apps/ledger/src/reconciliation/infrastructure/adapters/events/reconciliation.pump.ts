import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ReevaluateAssertionsReactor } from '@ledger/reconciliation/application/reactors/reevaluate-assertions.reactor';
import { AdjustmentAuditProjector } from '@ledger/reconciliation/infrastructure/projections/adjustment-audit.projector';
import { AssertionStatusProjector } from '@ledger/reconciliation/infrastructure/projections/assertion-status.projector';
import { ProjectionCheckpointRepository } from '@ledger/shared-kernel/application/projection/projection-checkpoint.repository';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';

/** How many events a single `readAll` slice pulls from the global stream. */
const BATCH_SIZE = 100;

/** How often the pump drains the stream, in milliseconds. */
const PUMP_INTERVAL_MS = 5_000;

/**
 * Projection name shared by the pump and the rebuild registry, so both advance
 * the same checkpoint.
 */
export const RECONCILIATION_PROJECTION = 'reconciliation';

/**
 * Drives the reconciliation read models and {@link ReevaluateAssertionsReactor}
 * from the global stream with a persisted checkpoint. The spec (§8.1) classifies
 * `assertion_status` and `adjustment_audit` as asynchronous projections served
 * by a poller with checkpoint, unlike `transaction_list`/`account_balances`
 * which project inside the command transaction.
 *
 * Each event first updates the projections and only then feeds the reactor, so a
 * reactor lookup always reads a current `assertion_status` (§3.2). That ordering
 * is a correctness guarantee: two independent pollers would let the reactor run
 * ahead of the projections and query stale state.
 *
 * Delivery is at-least-once, which is safe because the projections upsert by key
 * and `EvaluateAssertion` stays silent on an unchanged verdict (RNF-4).
 */
@Injectable()
export class ReconciliationPump {
  private readonly logger = new Logger(ReconciliationPump.name);
  private draining = false;

  constructor(
    private readonly eventStore: EventStore,
    private readonly readModel: ReadModelStore,
    private readonly checkpoints: ProjectionCheckpointRepository,
    private readonly reactor: ReevaluateAssertionsReactor,
    private readonly statusProjector: AssertionStatusProjector,
    private readonly auditProjector: AdjustmentAuditProjector,
  ) {}

  /** Consumes every event past the checkpoint; advances it only on success. */
  async pump(): Promise<void> {
    let checkpoint = await this.checkpoints.lastPosition(RECONCILIATION_PROJECTION);
    let batch = await this.eventStore.readAll(checkpoint, BATCH_SIZE);

    while (batch.length) {
      for (const event of batch) {
        await this.handle(event);
        checkpoint = event.globalPosition;
        await this.checkpoints.advance(RECONCILIATION_PROJECTION, checkpoint);
      }

      batch = await this.eventStore.readAll(checkpoint, BATCH_SIZE);
    }
  }

  /**
   * Scheduled drain. Skips its turn while a previous run is still going, so a
   * slow batch never gets a second pump racing it over the same checkpoint.
   */
  @Interval(PUMP_INTERVAL_MS)
  async drain(): Promise<void> {
    if (this.draining) return; // guard: a previous tick is still running

    this.draining = true;

    try {
      await this.pump();
    } catch {
      // handle() already logged with the failing position; the checkpoint did
      // not advance, so the next tick retries the same event.
    } finally {
      this.draining = false;
    }
  }

  private async handle(event: StoredEvent): Promise<void> {
    try {
      await this.statusProjector.project(event, this.readModel);
      await this.auditProjector.project(event, this.readModel);
      await this.reactor.on(event);
    } catch (error) {
      // A silently failing pump breaks re-evaluation invisibly (RNF-12): surface
      // it and stop so the checkpoint does not skip the event.
      this.logger.error(
        `Reconciliation pump failed at position ${event.globalPosition}`,
        error as Error,
      );
      throw error;
    }
  }
}
