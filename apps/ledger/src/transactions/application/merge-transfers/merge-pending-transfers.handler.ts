import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandHandler } from '@cqrs/application/command-bus/command-handler';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { Nullable } from '@shared';
import { LedgerDate } from '@ledger/shared/domain/value-objects';
import { LedgerTransactionRepository } from '@ledger/transactions/application/ledger-transaction.repository';
import { RecordTransactionCommand } from '@ledger/transactions/application/record-transaction/record-transaction.command';
import { VoidPendingTransactionCommand } from '@ledger/transactions/application/void-transaction/void-pending-transaction.command';
import {
  NotATransferPairException,
  PendingLegNotFoundException,
} from '@ledger/transactions/domain/exceptions/transfer.exception';
import { AccountLookup } from '@ledger/transactions/domain/ports/account-lookup.port';
import { TransferLeg, TransferPairRule } from '@ledger/transactions/domain/services/transfer-pair.rule';
import { TransactionNotFoundException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { LedgerTransaction } from '@ledger/transactions/domain/transaction/ledger-transaction.aggregate';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { MergePendingTransfersCommand } from './merge-pending-transfers.command';

/** Account types whose postings represent movement of real money. */
const REAL_ACCOUNT_TYPES = ['ASSETS', 'LIABILITIES'];

/** A resolved transfer leg together with its transaction's date and reference. */
type PendingLeg = {
  readonly leg: TransferLeg;
  readonly date: LedgerDate;
  readonly externalRef: Nullable<string>;
};

/**
 * Voids both pending legs and records a single confirmed transfer, reusing the
 * real transaction commands through the {@link CommandBus} (DRY). Both
 * original external references are preserved in the transfer's metadata.
 *
 * Both aggregates are loaded from the event store and re-validated as a transfer
 * pair before anything is dispatched: the caller names the two transactions, and
 * this decides whether merging them is legal. Deciding *which* pendings look
 * mergeable is a client concern, not the ledger's.
 *
 * The two voids and the transfer land on three different streams, so all three
 * appends run inside `EventStore.withTransaction`. Without it, a process dying
 * after the first void leaves the user with a pending cancelled and nothing
 * replacing it — visible data loss, not a recoverable intermediate state.
 *
 * The merge itself is then recorded as {@link TransfersMerged} on the resulting
 * transfer, inside the same scope.
 *
 * Only the recorded transfer carries the `external_ref`; the voids and the merge
 * fact are anchorless. That makes the transfer the single idempotency anchor, so
 * a retry replays its id instead of merging twice (INV-10). The two voided ids
 * are the caller's own request body and are not echoed back.
 */
export class MergePendingTransfersHandler extends CommandHandler<MergePendingTransfersCommand> {
  constructor(
    private readonly transactions: LedgerTransactionRepository,
    private readonly accounts: AccountLookup,
    private readonly rule: TransferPairRule,
    private readonly commandBus: CommandBus,
    private readonly eventStore: EventStore,
  ) {
    super();
  }

  async execute(
    command: MergePendingTransfersCommand,
    ctx: AuthContext,
  ): Promise<CommandResult> {
    const [firstId, secondId] = command.pendingIds;
    const [first, second] = await Promise.all([
      this.pendingLeg(ctx.userId, firstId),
      this.pendingLeg(ctx.userId, secondId),
    ]);

    const pair = this.rule.pair(first.leg, second.leg);

    if (!pair) {
      throw new NotATransferPairException(`"${firstId}" and "${secondId}" are not a transfer pair`);
    }

    // The transfer carries the outgoing leg's accounting date.
    const outgoing = pair.outgoingTxnId === firstId ? first : second;
    const anchorless: AuthContext = { ...ctx, externalRef: null };

    return this.eventStore.withTransaction(async () => {
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
          this.traceabilityMetadata([firstId, secondId], [first, second]),
        ),
        ctx,
      );

      const merged = await this.recordMergeFact(recorded.aggregateId, [firstId, secondId], anchorless);

      return {
        aggregateId: recorded.aggregateId,
        streamPosition: merged,
        idempotentReplay: false,
      };
    });
  }

  /**
   * Traceability of the merge: the ids of the two voided pendings plus
   * the external references both carried, so an integration can still find its
   * own movements after the originals were replaced.
   *
   * `merged_external_refs` is positional against `merged_from` — a leg the
   * client did not stamp leaves its slot empty rather than shifting the other
   * one — and is omitted entirely when neither leg carries a reference.
   */
  private traceabilityMetadata(
    ids: readonly string[],
    legs: readonly PendingLeg[],
  ): Record<string, string> {
    const metadata: Record<string, string> = { merged_from: ids.join(',') };

    if (legs.every((leg) => !leg.externalRef)) return metadata;

    metadata.merged_external_refs = legs.map((leg) => leg.externalRef ?? '').join(',');

    return metadata;
  }

  /**
   * Emits {@link TransfersMerged} on the transfer just recorded. It is
   * the fact of the merge itself, additional to — never a replacement for — the
   * two `TransactionVoided` and the `TransactionRecorded` that make up each
   * transaction's own lifecycle. The append joins the surrounding scope, so the
   * merge fact and the events it describes commit together. Returns the global
   * position it reached — the last one the whole merge produced, which is what
   * a read-your-writes caller has to wait for.
   */
  private async recordMergeFact(
    transferId: string,
    mergedIds: readonly string[],
    ctx: AuthContext,
  ): Promise<bigint> {
    const transfer = await this.transactions.load(ctx.userId, transferId);

    if (!transfer) {
      throw new TransactionNotFoundException(`Transfer "${transferId}" was not recorded`);
    }

    transfer.mergedFrom(mergedIds);
    const result = await this.transactions.save(transfer, ctx);

    return result.lastPosition;
  }

  /**
   * The single real-account leg of a pending transaction, or a domain failure.
   * The leg's `external_ref` comes from its stream envelope — the write side
   * never reads a projection.
   */
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
      externalRef: await this.transactions.externalRefOf(userId, transactionId),
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
