import { Injectable } from '@nestjs/common';
import { Money } from '@ledger/shared/domain/money';
import { IdGenerator } from '@ledger/shared/domain/ports';
import {
  CommandBus,
  ConfirmTransactionCommand,
  LocalDate,
  RecordTransactionCommand,
  VoidPendingTransactionCommand,
  resolveAssumedCurrency,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import {
  NotATransferPairException,
  PendingLegNotFoundException,
} from '@ledger/transactions/domain/exceptions/transfer.exception';
import {
  PendingLegRow,
  TransferCandidateStore,
} from '@ledger/transactions/domain/ports/transfer-candidate-store.port';
import { PendingLeg, TransferDetector } from '@ledger/transactions/domain/services/transfer-detector.service';
import { MergeTransfersOutputDto } from '../dto/merge-transfers-output.dto';
import { MergePendingTransfersCommand } from './merge-pending-transfers.command';

/**
 * Voids both pending legs and records+confirms a single transfer, reusing the
 * assumed EP-1 commands (DRY). Both original external references are preserved
 * in the transfer's metadata (§7.2). The two legs are re-validated as a real
 * transfer pair before anything is dispatched (guard against a race).
 *
 * At integration this becomes one atomic `MergePendingTransfers` aggregate
 * operation emitting `TransfersMerged`; in isolation the orchestration through
 * the bus exercises the same observable outcome.
 */
@Injectable()
export class MergePendingTransfersHandler {
  constructor(
    private readonly store: TransferCandidateStore,
    private readonly detector: TransferDetector,
    private readonly commandBus: CommandBus,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: MergePendingTransfersCommand): Promise<MergeTransfersOutputDto> {
    const [firstId, secondId] = command.pendingIds;
    const legs = await this.store.pendingLegs(command.context.userId);

    const first = legs.find((leg) => leg.transactionId === firstId);
    const second = legs.find((leg) => leg.transactionId === secondId);

    if (!first || !second) {
      throw new PendingLegNotFoundException(`One of "${firstId}", "${secondId}" is not pending`);
    }

    const pair = this.detector.match(this.toLeg(first), [this.toLeg(second)]);

    if (!pair) {
      throw new NotATransferPairException(`"${firstId}" and "${secondId}" are not a transfer pair`);
    }

    const transferTxnId = this.ids.next();

    await this.commandBus.execute(
      new VoidPendingTransactionCommand(command.context, null, firstId, 'merged into transfer'),
    );
    await this.commandBus.execute(
      new VoidPendingTransactionCommand(command.context, null, secondId, 'merged into transfer'),
    );

    await this.commandBus.execute(
      new RecordTransactionCommand(
        command.context,
        command.externalRef,
        transferTxnId,
        first.date,
        'Transfer',
        [
          { accountId: pair.outgoingAccountId, amount: pair.amount.negate().toDecimalString(), currency: pair.currency },
          { accountId: pair.incomingAccountId, amount: pair.amount.toDecimalString(), currency: pair.currency },
        ],
        { merged_from: [firstId, secondId], merged_external_refs: [first.externalRef, second.externalRef] },
      ),
    );

    await this.commandBus.execute(
      new ConfirmTransactionCommand(command.context, null, transferTxnId),
    );

    return { transferTransactionId: transferTxnId, voidedTransactionIds: [firstId, secondId] };
  }

  private toLeg(row: PendingLegRow): PendingLeg {
    return {
      transactionId: row.transactionId,
      accountId: row.accountId,
      amount: Money.of(row.amount, resolveAssumedCurrency(row.currencyCode)),
      date: LocalDate.of(row.date),
      isRealAccount: row.isRealAccount,
    };
  }
}
