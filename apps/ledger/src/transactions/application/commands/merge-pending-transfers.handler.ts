import { Injectable } from '@nestjs/common';
import { AuthContext } from '@ledger/shared-kernel/application/command-bus/auth-context.type';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { VoidPendingTransactionCommand } from '@ledger/transactions/application/void-transaction/void-pending-transaction.command';
import {
  NotATransferPairException,
  PendingLegNotFoundException,
} from '@ledger/transactions/domain/exceptions/transfer.exception';
import { AccountLookup } from '@ledger/transactions/domain/ports/account-lookup.port';
import { TransferLeg, TransferPairRule } from '@ledger/transactions/domain/services/transfer-pair.rule';
import { LedgerTransaction } from '@ledger/transactions/domain/transaction/ledger-transaction.aggregate';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { MergeTransfersOutputDto } from '../dto/merge-transfers-output.dto';
import { MergePendingTransfersCommand } from './merge-pending-transfers.command';

/** Account types whose postings represent movement of real money (§2.1). */
const REAL_ACCOUNT_TYPES = ['ASSETS', 'LIABILITIES'];

/** A resolved transfer leg together with its transaction's accounting date. */
interface PendingLeg {
  readonly leg: TransferLeg;
  readonly date: LedgerDate;
}

/**
 * Voids both pending legs and records a single confirmed transfer, reusing the
 * real EP-1 transaction commands through the {@link CommandBus} (DRY). Both
 * original external references are preserved in the transfer's metadata (§7.2).
 *
 * Both aggregates are loaded from the event store and re-validated as a transfer
 * pair before anything is dispatched: the caller names the two transactions, and
 * this decides whether merging them is legal. Deciding *which* pendings look
 * mergeable is a client concern, not the ledger's.
 *
 * TODO(atomicity): shared-transaction adapter across streams — the two voids and
 * the transfer record are separate stream appends, not one atomic operation.
 */
@Injectable()
export class MergePendingTransfersHandler {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly accounts: AccountLookup,
    private readonly rule: TransferPairRule,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(
    command: MergePendingTransfersCommand,
    ctx: AuthContext,
  ): Promise<MergeTransfersOutputDto> {
    const [firstId, secondId] = command.pendingIds;
    const [first, second] = await Promise.all([
      this.pendingLeg(ctx.userId, firstId),
      this.pendingLeg(ctx.userId, secondId),
    ]);

    const pair = this.rule.pair(first.leg, second.leg);

    if (!pair) {
      throw new NotATransferPairException(`"${firstId}" and "${secondId}" are not a transfer pair`);
    }

    // The transfer carries the outgoing leg's accounting date (§7.2).
    const outgoing = pair.outgoingTxnId === firstId ? first : second;
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
        outgoing.date.value,
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
        { merged_from: [firstId, secondId].join(',') },
      ),
      ctx,
    );

    return { transferTransactionId: recorded.aggregateId, voidedTransactionIds: [firstId, secondId] };
  }

  /** The single real-account leg of a pending transaction, or a domain failure. */
  private async pendingLeg(userId: string, transactionId: string): Promise<PendingLeg> {
    const transaction = await this.load(userId, transactionId);

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new PendingLegNotFoundException(`"${transactionId}" is not pending`);
    }

    const realPostings = await this.realPostings(userId, transaction);

    if (realPostings.length !== 1) {
      throw new NotATransferPairException(
        `"${transactionId}" must have exactly one real-account posting to be a transfer leg`,
      );
    }

    const [posting] = realPostings;

    return {
      leg: { transactionId, accountId: posting.accountId, amount: posting.amount },
      date: transaction.date,
    };
  }

  private async realPostings(userId: string, transaction: LedgerTransaction) {
    const flagged = await Promise.all(
      transaction.postings.map(async (posting) => {
        const facts = await this.accounts.factsOf(userId, posting.accountId);

        return { posting, isReal: !!facts && REAL_ACCOUNT_TYPES.includes(facts.type) };
      }),
    );

    return flagged.filter((entry) => entry.isReal).map((entry) => entry.posting);
  }

  private async load(userId: string, transactionId: string): Promise<LedgerTransaction> {
    const transaction = await this.transactions.load(userId, transactionId);

    if (!transaction) {
      throw new PendingLegNotFoundException(`Transaction "${transactionId}" does not exist`);
    }

    return transaction;
  }
}
