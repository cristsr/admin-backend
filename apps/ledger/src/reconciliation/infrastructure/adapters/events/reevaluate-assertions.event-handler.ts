import { Injectable, Logger } from '@nestjs/common';
import { ReevaluateAssertionsReactor } from '@ledger/reconciliation/application/reactors/reevaluate-assertions.reactor';
import { EventStore } from '@ledger/shared/ep1-ep2-contracts.assumed';

/**
 * Drives {@link ReevaluateAssertionsReactor} from the global stream with a
 * checkpoint (molded on the outbox relay of `apps/finances`): at-least-once
 * delivery, which is safe because re-evaluation is idempotent. The handler only
 * delegates — all reaction logic lives in the reactor (§3.2).
 */
@Injectable()
export class ReevaluateAssertionsEventHandler {
  private readonly logger = new Logger(ReevaluateAssertionsEventHandler.name);
  private checkpoint = 0;

  constructor(
    private readonly eventStore: EventStore,
    private readonly reactor: ReevaluateAssertionsReactor,
  ) {}

  /** Consumes every event past the checkpoint; advances it only on success. */
  async pump(): Promise<void> {
    const batch = await this.eventStore.readAll(this.checkpoint);

    for (const { position, event } of batch) {
      try {
        await this.reactor.on(event);
      } catch (error) {
        // A silently failing reactor breaks re-evaluation invisibly (RNF-12):
        // surface it and stop so the checkpoint does not skip the event.
        this.logger.error(`Reactor failed at position ${position}`, error as Error);
        throw error;
      }

      this.checkpoint = position;
    }
  }

  get currentCheckpoint(): number {
    return this.checkpoint;
  }
}
