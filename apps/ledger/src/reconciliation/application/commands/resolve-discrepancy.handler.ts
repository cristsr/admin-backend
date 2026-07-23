import { Injectable } from '@nestjs/common';
import { BalanceAssertionRepository } from '@ledger/reconciliation/domain/balance-assertion/balance-assertion.repository';
import {
  AssertionNotFoundException,
  DiscrepancyNotResolvableException,
} from '@ledger/reconciliation/domain/balance-assertion/exceptions/balance-assertion.exception';
import { AdjustmentFactory } from '@ledger/reconciliation/domain/services/adjustment.factory';
import { Clock, IdGenerator } from '@ledger/shared/domain/ports';
import {
  CommandBus,
  ConfirmTransactionCommand,
  PostingLine,
  RecordTransactionCommand,
  SystemAccountLookup,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import { ResolveDiscrepancyOutputDto } from '../dto/resolve-discrepancy-output.dto';
import { ResolveDiscrepancyCommand } from './resolve-discrepancy.command';

/**
 * Closes a `MISMATCHED` discrepancy (§7.5): records+confirms a system adjustment
 * between the affected account and `Equity:Adjustments` for the exact difference
 * (reusing EP-1 commands, DRY), then emits `DiscrepancyResolved`. The adjustment
 * re-triggers the reactor (EP-3.4), which re-evaluates the assertion to MATCHED.
 */
@Injectable()
export class ResolveDiscrepancyHandler {
  constructor(
    private readonly assertions: BalanceAssertionRepository,
    private readonly commandBus: CommandBus,
    private readonly accounts: SystemAccountLookup,
    private readonly factory: AdjustmentFactory,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: ResolveDiscrepancyCommand): Promise<ResolveDiscrepancyOutputDto> {
    const assertion = await this.assertions.load(command.assertionId);

    if (!assertion) {
      throw new AssertionNotFoundException(`Assertion "${command.assertionId}" not found`);
    }

    const difference = assertion.difference;

    if (!assertion.isResolvable || !difference) {
      throw new DiscrepancyNotResolvableException(
        `Assertion "${command.assertionId}" is not a resolvable discrepancy`,
      );
    }

    const adjustmentsAccountId = await this.accounts.adjustmentsAccountId(assertion.owner);
    const adjustmentTxnId = this.ids.next();
    const postings = this.factory.build(assertion.account, adjustmentsAccountId, difference);

    await this.recordAndConfirmAdjustment(command, assertion.id, adjustmentTxnId, postings);

    const expectedVersion = assertion.currentVersion;
    assertion.markResolved(adjustmentTxnId, this.clock);
    const result = await this.assertions.save(assertion, expectedVersion);

    return {
      assertionId: assertion.id,
      adjustmentTransactionId: adjustmentTxnId,
      streamPosition: result.streamPosition,
    };
  }

  private async recordAndConfirmAdjustment(
    command: ResolveDiscrepancyCommand,
    assertionId: string,
    adjustmentTxnId: string,
    postings: readonly PostingLine[],
  ): Promise<void> {
    await this.commandBus.execute(
      new RecordTransactionCommand(
        command.context,
        command.externalRef,
        adjustmentTxnId,
        this.clock.now().toISOString().slice(0, 10),
        'Reconciliation adjustment',
        postings.map((posting) => posting.toInput()),
        { source: 'system', resolves_assertion: assertionId },
      ),
    );

    await this.commandBus.execute(
      new ConfirmTransactionCommand(command.context, null, adjustmentTxnId),
    );
  }
}
