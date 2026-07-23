import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { BalanceAssertion } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.aggregate';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import { CommandResult, EventStore } from '@ledger/shared/ep1-ep2-contracts.assumed';

/**
 * {@link BalanceAssertionRepository} over the assumed EP-1 {@link EventStore}:
 * `load` rebuilds from the stream, `save` appends the pending events under
 * optimistic concurrency (`expectedVersion`).
 */
@Injectable()
export class EventStoreBalanceAssertionRepository extends BalanceAssertionRepository {
  constructor(private readonly eventStore: EventStore) {
    super();
  }

  async load(assertionId: string): Promise<Nullable<BalanceAssertion>> {
    const events = await this.eventStore.load(assertionId);

    if (!events.length) return null;

    return BalanceAssertion.fromHistory(events);
  }

  save(assertion: BalanceAssertion, expectedVersion: number): Promise<CommandResult> {
    const events = assertion.pullEvents();

    return this.eventStore.append(assertion.id, expectedVersion, events);
  }
}
