import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { Clock } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { SystemAccountLookup } from '@ledger/reconciliation/application/ports/system-account-lookup.port';
import { BalanceAssertionRepository } from '@ledger/reconciliation/application/repositories/balance-assertion.repository';
import { AssertionNotFoundException, DiscrepancyNotResolvableException } from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { AdjustmentFactory } from '@ledger/reconciliation/domain/services/adjustment.factory';
import { PostingOrigin } from '@ledger/shared/domain/value-objects/posting-origin';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { PostingInput } from '@ledger/transactions/application/types/posting-input.type';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { ResolveDiscrepancyCommand } from './resolve-discrepancy.command';

/**
 * Closes a `MISMATCHED` discrepancy: records a system adjustment
 * (directly `CONFIRMED`) between the affected account and `Equity:Adjustments`
 * for the exact difference (reusing the real `RecordTransaction`, DRY), then
 * emits `DiscrepancyResolved` linked to the adjustment. The adjustment's own
 * `TransactionRecorded` re-triggers the reactor, which re-evaluates the
 * assertion to MATCHED.
 *
 * The adjustment and the `DiscrepancyResolved` land on different streams, so both
 * appends run inside `EventStore.withTransaction`: an assertion marked resolved
 * without its adjustment would claim the money is explained when it is not.
 *
 * The adjustment carries the `external_ref`, so it is also what a retry replays:
 * the returned `aggregateId` is the adjustment transaction, matching what the
 * idempotency policy reconstructs from the anchor (INV-10). The assertion id is
 * the caller's own path parameter and needs no echoing.
 */
export class ResolveDiscrepancyHandler extends CommandHandler<ResolveDiscrepancyCommand> {
  constructor(
    private readonly assertions: BalanceAssertionRepository,
    private readonly commandBus: CommandBus,
    private readonly accounts: SystemAccountLookup,
    private readonly factory: AdjustmentFactory,
    private readonly clock: Clock,
    private readonly eventStore: EventStore,
  ) {
    super();
  }

  async execute(command: ResolveDiscrepancyCommand, ctx: AuthContext): Promise<CommandResult> {
    const assertion = await this.assertions.load(ctx.userId, command.assertionId);

    if (!assertion) {
      throw new AssertionNotFoundException(`Assertion "${command.assertionId}" not found`);
    }

    const difference = assertion.difference;

    if (!assertion.isResolvable || !difference) {
      throw new DiscrepancyNotResolvableException(
        `Assertion "${command.assertionId}" is not a resolvable discrepancy`,
      );
    }

    const adjustmentsAccountId = await this.accounts.adjustmentsAccountId(ctx.userId);
    const postings = this.factory.build(assertion.account, adjustmentsAccountId, difference);

    return this.eventStore.withTransaction(async () => {
      // The adjustment carries the command's external_ref, so the money movement
      // is the idempotency anchor; the linking append below stays unstamped.
      const recordResult = await this.commandBus.dispatch(
        new RecordTransactionCommand(
          this.clock.now().toISOString().slice(0, 10),
          null,
          'Reconciliation adjustment',
          postings.map((posting) => this.toInput(posting)),
          TransactionStatus.CONFIRMED,
          null,
          [],
          { source: 'system', resolves_assertion: assertion.id },
          // No business instant: the adjustment happens when it is decided, not
          // at some earlier moment in the world.
          null,
          // The adjustment posts against `Equity:Adjustments`; only a system
          // origin may reach a technical account (INV-13).
          PostingOrigin.SYSTEM,
        ),
        ctx,
      );

      const adjustmentTxnId = recordResult.aggregateId;
      assertion.markResolved(adjustmentTxnId);
      const result = await this.assertions.save(assertion, { ...ctx, externalRef: null });

      return {
        aggregateId: adjustmentTxnId,
        streamPosition: result.lastPosition,
        idempotentReplay: false,
      };
    });
  }

  private toInput(posting: PostingLine): PostingInput {
    return {
      accountId: posting.accountId,
      amount: posting.amount.toDecimalString(),
      currency: posting.currencyCode,
      metadata: posting.metadata,
    };
  }
}
