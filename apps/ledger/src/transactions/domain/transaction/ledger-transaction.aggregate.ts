import { AggregateRoot } from '@cqrs/domain/aggregate/aggregate-root';
import { DomainEvent } from '@cqrs/domain/aggregate/domain-event';
import { Clock, IdGenerator } from '@cqrs/domain/ports';
import { Nullable } from '@shared';
import { LedgerDate, Payee } from '@ledger/shared/domain/value-objects';
import { BalanceRule } from '@ledger/transactions/domain/balance/balance-rule';
import { PostingLine } from '@ledger/transactions/domain/posting/posting-line';
import {
  TransactionAmended,
  TransactionAnnotated,
  TransactionConfirmed,
  TransactionRecorded,
  TransactionReversed,
  TransactionVoided,
  TransfersMerged,
} from './events';
import {
  ImmutableTransactionException,
  InsufficientPostingsException,
  InvalidTransactionStateException,
} from './exceptions/transaction.exception';
import { TransactionAnnotations } from './transaction-annotations.type';
import { TransactionStatus } from './transaction-status';

/** Arguments to record a new transaction. */
export type RecordTransactionArgs = {
  readonly date: LedgerDate;
  readonly payee: Nullable<Payee>;
  readonly description: string;
  readonly postings: readonly PostingLine[];
  readonly initialStatus: TransactionStatus;
  readonly invoiceUrl: Nullable<string>;
  readonly tags: readonly string[];
  readonly metadata: Readonly<Record<string, string>>;
  /**
   * Instant the movement actually happened, when known (§2.4). Optional because
   * not knowing it is the ordinary case — only a source that timestamps the
   * movement itself, like a bank notification, can supply one.
   */
  readonly occurredAt?: Nullable<Date>;
};

/**
 * What the handler needs to record the linked reversing transaction after a
 * confirmed transaction is reversed (§3.4). Keeps a single audited write path.
 */
export type ReversalPlan = {
  readonly reversalId: string;
  readonly sourceTransactionId: string;
  readonly date: LedgerDate;
  readonly postings: readonly PostingLine[];
  readonly description: string;
};

const MIN_POSTINGS = 2;

/**
 * The transaction aggregate (§3.3). Groups postings and protects INV-1 (zero
 * balance per currency, via {@link BalanceRule}), INV-2 (>= 2 postings) and
 * INV-6 (economic immutability once confirmed vs. free annotation). Covers the
 * PENDING -> CONFIRMED lifecycle plus amendment, annotation, voiding and the
 * reversal of confirmed transactions.
 */
export class LedgerTransaction extends AggregateRoot<string> {
  private txStatus!: TransactionStatus;
  private txPostings: readonly PostingLine[] = [];
  private txDate!: LedgerDate;
  private annotations!: TransactionAnnotations;
  private reversed = false;

  /** Records a transaction, enforcing INV-2 and INV-1 before emitting anything. */
  static record(
    args: RecordTransactionArgs,
    balance: BalanceRule,
    idGenerator: IdGenerator,
  ): LedgerTransaction {
    LedgerTransaction.ensureRecordable(args.initialStatus);
    LedgerTransaction.ensureWellFormed(args.postings, balance);

    const transaction = new LedgerTransaction(idGenerator.next());
    transaction.raise(
      new TransactionRecorded({
        transactionId: transaction.id,
        date: args.date.value,
        payee: args.payee?.value ?? null,
        description: args.description,
        status: args.initialStatus,
        invoiceUrl: args.invoiceUrl,
        tags: args.tags,
        postings: args.postings,
        metadata: args.metadata,
        occurredAt: args.occurredAt ?? null,
      }),
    );

    return transaction;
  }

  /** Rebuilds a transaction from its ordered history. */
  static rehydrate(id: string, events: readonly DomainEvent[]): LedgerTransaction {
    const transaction = new LedgerTransaction(id);
    transaction.loadFromHistory(events);

    return transaction;
  }

  get status(): TransactionStatus {
    return this.txStatus;
  }

  get date(): LedgerDate {
    return this.txDate;
  }

  get postings(): readonly PostingLine[] {
    return this.txPostings;
  }

  /** Economic amendment — only while PENDING (INV-6). Re-checks INV-1/INV-2. */
  amend(postings: readonly PostingLine[], date: LedgerDate, balance: BalanceRule): void {
    if (this.txStatus !== TransactionStatus.PENDING) {
      throw new ImmutableTransactionException(
        `Cannot amend a ${this.txStatus} transaction; reverse it instead`,
      );
    }

    LedgerTransaction.ensureWellFormed(postings, balance);
    this.raise(new TransactionAmended(date.value, postings));
  }

  /** Annotative change — allowed in any non-VOIDED state (INV-6). */
  annotate(annotations: TransactionAnnotations): void {
    if (this.txStatus === TransactionStatus.VOIDED) {
      throw new InvalidTransactionStateException('Cannot annotate a VOIDED transaction');
    }

    this.raise(new TransactionAnnotated(annotations));
  }

  /** PENDING -> CONFIRMED, freezing the postings. */
  confirm(clock: Clock): void {
    if (this.txStatus !== TransactionStatus.PENDING) {
      throw new InvalidTransactionStateException(
        `Only PENDING transactions can be confirmed; this one is ${this.txStatus}`,
      );
    }

    this.raise(new TransactionConfirmed(clock.now().toISOString()));
  }

  /** PENDING -> VOIDED with a reason. */
  void(reason: string): void {
    if (this.txStatus !== TransactionStatus.PENDING) {
      throw new InvalidTransactionStateException(
        `Only PENDING transactions can be voided; this one is ${this.txStatus}`,
      );
    }

    this.raise(new TransactionVoided(reason));
  }

  /**
   * Reverses a CONFIRMED transaction. Emits {@link TransactionReversed} here and
   * returns a {@link ReversalPlan} the handler records as the linked reversing
   * transaction (metadata `reverses_id`).
   */
  reverse(reversalId: string): ReversalPlan {
    if (this.txStatus !== TransactionStatus.CONFIRMED) {
      throw new InvalidTransactionStateException(
        `Only CONFIRMED transactions can be reversed; this one is ${this.txStatus}`,
      );
    }

    if (this.reversed) {
      throw new InvalidTransactionStateException('Transaction is already reversed');
    }

    this.raise(new TransactionReversed(reversalId));

    return {
      reversalId,
      sourceTransactionId: this.id,
      date: this.txDate,
      postings: this.txPostings.map((posting) => posting.negated()),
      description: `Reversal of ${this.id}`,
    };
  }

  /**
   * Records that this confirmed transfer is the result of merging two pending
   * transactions (RF-16, §3.4), emitting {@link TransfersMerged} with the ids of
   * the voided pendings and this transfer's postings.
   *
   * The fact belongs to the **resulting transfer's** stream, not to the two
   * legs': the merge is what brought this aggregate into being, while each leg's
   * own history already tells the whole truth about it with `TransactionVoided`.
   * Emitting it twice — once per leg — would duplicate a single fact across
   * streams with no aggregate owning it.
   */
  mergedFrom(mergedTransactionIds: readonly string[]): void {
    if (this.txStatus !== TransactionStatus.CONFIRMED) {
      throw new InvalidTransactionStateException(
        `Only a CONFIRMED transfer can result from a merge; this one is ${this.txStatus}`,
      );
    }

    this.raise(
      new TransfersMerged({ mergedTransactionIds, postings: this.txPostings }),
    );
  }

  protected apply(event: DomainEvent): void {
    if (event instanceof TransactionRecorded) {
      this.txStatus = event.props.status;
      this.txPostings = event.props.postings;
      this.txDate = LedgerDate.of(event.props.date);
      this.annotations = {
        payee: event.props.payee,
        description: event.props.description,
        invoiceUrl: event.props.invoiceUrl,
        tags: event.props.tags,
        metadata: event.props.metadata,
      };

      return;
    }

    if (event instanceof TransactionAmended) {
      this.txPostings = event.postings;
      this.txDate = LedgerDate.of(event.date);

      return;
    }

    if (event instanceof TransactionAnnotated) {
      this.annotations = event.annotations;

      return;
    }

    if (event instanceof TransactionConfirmed) {
      this.txStatus = TransactionStatus.CONFIRMED;

      return;
    }

    if (event instanceof TransactionVoided) {
      this.txStatus = TransactionStatus.VOIDED;

      return;
    }

    if (event instanceof TransactionReversed) {
      this.reversed = true;
    }

    // TransfersMerged carries no state: it is provenance, and the transfer's
    // own lifecycle events already describe what it is.
  }

  private static ensureRecordable(status: TransactionStatus): void {
    if (status === TransactionStatus.VOIDED) {
      throw new InvalidTransactionStateException(
        'A transaction cannot be recorded directly as VOIDED',
      );
    }
  }

  private static ensureWellFormed(
    postings: readonly PostingLine[],
    balance: BalanceRule,
  ): void {
    if (postings.length < MIN_POSTINGS) {
      throw new InsufficientPostingsException(
        `A transaction needs at least ${MIN_POSTINGS} postings`,
      );
    }

    balance.ensureBalanced(postings);
  }
}
