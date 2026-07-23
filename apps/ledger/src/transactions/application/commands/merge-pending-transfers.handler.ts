import { Injectable } from '@nestjs/common';
import { Money } from '@ledger/shared/domain/money';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import {
  CurrencyCatalog,
  CurrencyCode,
  LedgerDate,
} from '@ledger/shared-kernel/domain/value-objects';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { VoidPendingTransactionCommand } from '@ledger/transactions/application/void-transaction/void-pending-transaction.command';
import {
  NotATransferPairException,
  PendingLegNotFoundException,
} from '@ledger/transactions/domain/exceptions/transfer.exception';
import {
  PendingLegRow,
  TransferCandidateStore,
} from '@ledger/transactions/domain/ports/transfer-candidate-store.port';
import {
  PendingLeg,
  TransferDetector,
} from '@ledger/transactions/domain/services/transfer-detector.service';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { MergeTransfersOutputDto } from '../dto/merge-transfers-output.dto';
import { MergePendingTransfersCommand } from './merge-pending-transfers.command';

/**
 * Voids both pending legs and records a single confirmed transfer, reusing the
 * real EP-1 transaction commands through the {@link CommandBus} (DRY). Both
 * original external references are preserved in the transfer's metadata (§7.2).
 * The two legs are re-validated as a real transfer pair before anything is
 * dispatched (guard against a race).
 *
 * TODO(atomicity): shared-transaction adapter across streams — the two voids and
 * the transfer record are separate stream appends, not one atomic operation.
 */
@Injectable()
export class MergePendingTransfersHandler {
  constructor(
    private readonly store: TransferCandidateStore,
    private readonly detector: TransferDetector,
    private readonly commandBus: CommandBus,
    private readonly catalog: CurrencyCatalog,
  ) {}

  async execute(
    command: MergePendingTransfersCommand,
    ctx: AuthContext,
  ): Promise<MergeTransfersOutputDto> {
    const [firstId, secondId] = command.pendingIds;
    const legs = await this.store.pendingLegs(ctx.userId);

    const first = legs.find((leg) => leg.transactionId === firstId);
    const second = legs.find((leg) => leg.transactionId === secondId);

    if (!first || !second) {
      throw new PendingLegNotFoundException(`One of "${firstId}", "${secondId}" is not pending`);
    }

    const pair = this.detector.match(this.toLeg(first), [this.toLeg(second)]);

    if (!pair) {
      throw new NotATransferPairException(`"${firstId}" and "${secondId}" are not a transfer pair`);
    }

    const anchorless: AuthContext = { ...ctx, externalRef: null };
    await this.commandBus.dispatch(
      new VoidPendingTransactionCommand(firstId, 'merged into transfer'),
      anchorless,
    );
    await this.commandBus.dispatch(
      new VoidPendingTransactionCommand(secondId, 'merged into transfer'),
      anchorless,
    );

    const recorded = await this.commandBus.dispatch(
      new RecordTransactionCommand(
        first.date,
        null,
        'Transfer',
        [
          {
            accountId: pair.outgoingAccountId,
            amount: pair.amount.negate().toDecimalString(),
            currency: pair.currency,
          },
          {
            accountId: pair.incomingAccountId,
            amount: pair.amount.toDecimalString(),
            currency: pair.currency,
          },
        ],
        TransactionStatus.CONFIRMED,
        null,
        [],
        {
          merged_from: [firstId, secondId].join(','),
          merged_external_refs: [first.externalRef ?? '', second.externalRef ?? ''].join(','),
        },
      ),
      ctx,
    );

    const transferTxnId = recorded.aggregateId;

    return { transferTransactionId: transferTxnId, voidedTransactionIds: [firstId, secondId] };
  }

  private toLeg(row: PendingLegRow): PendingLeg {
    return {
      transactionId: row.transactionId,
      accountId: row.accountId,
      amount: Money.of(row.amount, this.catalog.resolve(CurrencyCode.of(row.currencyCode))),
      date: LedgerDate.of(row.date),
      isRealAccount: row.isRealAccount,
    };
  }
}
