import { Injectable } from '@nestjs/common';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import {
  AssertionNotFoundException,
  DiscrepancyNotResolvableException,
} from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { SystemAccountLookup } from '@ledger/reconciliation/domain/ports/system-account-lookup.port';
import { AdjustmentFactory } from '@ledger/reconciliation/domain/services/adjustment.factory';
import { Clock } from '@ledger/shared/domain/ports';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { PostingInput } from '@ledger/transactions/application/posting-input.type';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { ResolveDiscrepancyOutputDto } from '../dto/resolve-discrepancy-output.dto';
import { ResolveDiscrepancyCommand } from './resolve-discrepancy.command';

/**
 * Closes a `MISMATCHED` discrepancy (§7.5): records a system adjustment
 * (directly `CONFIRMED`) between the affected account and `Equity:Adjustments`
 * for the exact difference (reusing the real EP-1 `RecordTransaction`, DRY), then
 * emits `DiscrepancyResolved` linked to the adjustment. The adjustment's own
 * `TransactionRecorded` re-triggers the reactor (EP-3.4), which re-evaluates the
 * assertion to MATCHED.
 *
 * TODO(atomicity): shared-transaction adapter across streams — the adjustment
 * append and the `DiscrepancyResolved` append are two separate streams; in the
 * dev phase this is append-per-stream, not one cross-aggregate transaction.
 */
@Injectable()
export class ResolveDiscrepancyHandler {
  constructor(
    private readonly assertions: BalanceAssertionRepository,
    private readonly commandBus: CommandBus,
    private readonly accounts: SystemAccountLookup,
    private readonly factory: AdjustmentFactory,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: ResolveDiscrepancyCommand,
    ctx: AuthContext,
  ): Promise<ResolveDiscrepancyOutputDto> {
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
      ),
      ctx,
    );

    const adjustmentTxnId = recordResult.aggregateId;
    assertion.markResolved(adjustmentTxnId);
    const result = await this.assertions.save(assertion, { ...ctx, externalRef: null });

    return {
      assertionId: assertion.id,
      adjustmentTransactionId: adjustmentTxnId,
      streamPosition: result.lastPosition,
    };
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
