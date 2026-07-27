import { Projector } from '@cqrs/application/projection/projector';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { Criteria, Nullable } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { AccountType } from '@ledger/shared/domain/value-objects';
import { DerivedKind } from '@ledger/transactions/domain/derivation/derived-kind';
import { TransactionKindDeriver } from '@ledger/transactions/domain/derivation/transaction-kind.deriver';
import { PostingPayload } from '@ledger/transactions/domain/posting/posting.serializer';

/** Read-model tables owned by this projector. */
export const PROJ_TRANSACTIONS = 'proj_transactions';
export const PROJ_POSTINGS = 'proj_postings';

type TransactionRow = {
  readonly transaction_id: string;
  readonly user_id: string;
  readonly date: string;
  readonly occurred_at: Nullable<string>;
  readonly payee: Nullable<string>;
  readonly description: string;
  readonly status: string;
  readonly derived_kind: string;
  readonly invoice_url: Nullable<string>;
  readonly tags: readonly string[];
  readonly client_id: string;
  readonly external_ref: Nullable<string>;
  readonly reverses_id: Nullable<string>;
  readonly metadata: Readonly<Record<string, string>>;
};

type PostingRow = {
  readonly posting_id: string;
  readonly transaction_id: string;
  readonly user_id: string;
  readonly account_id: string;
  readonly amount: string;
  readonly currency_code: string;
  readonly status: string;
  readonly date: string;
  readonly occurred_at: Nullable<string>;
  readonly metadata: Readonly<Record<string, string>>;
};

/**
 * Maintains `proj_transactions` (denormalized, includes `payee`, `derived_kind`,
 * `reverses_id`) and one `proj_postings` row per posting (§6.2). `derived_kind`
 * is computed from the touched account types read from `account_tree` (RF-4).
 */
export class TransactionListProjector extends Projector {
  readonly name = 'transaction_list';
  readonly consumes = [
    'TransactionRecorded',
    'TransactionAmended',
    'TransactionAnnotated',
    'TransactionConfirmed',
    'TransactionVoided',
    'TransactionReversed',
    'TransfersMerged',
  ];

  constructor(private readonly deriver: TransactionKindDeriver = new TransactionKindDeriver()) {
    super();
  }

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    if (event.eventType === 'TransactionRecorded') return this.onRecorded(event, payload, store);
    if (event.eventType === 'TransactionAmended') return this.onAmended(event, payload, store);
    if (event.eventType === 'TransactionAnnotated') return this.onAnnotated(event, payload, store);
    if (event.eventType === 'TransactionConfirmed') return this.onStatus(event, 'CONFIRMED', store);
    if (event.eventType === 'TransactionVoided') return this.onStatus(event, 'VOIDED', store);
    if (event.eventType === 'TransactionReversed') return this.onReversed(event, payload, store);
    if (event.eventType === 'TransfersMerged') return this.onMerged(event, payload, store);
  }

  private async onRecorded(
    event: StoredEvent,
    payload: Record<string, unknown>,
    store: ReadModelStore,
  ): Promise<void> {
    const postings = payload.postings as PostingPayload[];
    const status = payload.status as string;
    const derivedKind = await this.deriveKind(event.userId, postings, store);
    const metadata = (payload.metadata as Record<string, string>) ?? {};

    const row: TransactionRow = {
      transaction_id: event.aggregateId,
      user_id: event.userId,
      date: payload.date as string,
      // The declared business instant, not the envelope's: the envelope always
      // has one (it falls back to the append time), and that would erase the
      // difference between "happened at 14:03" and "instant unknown" — which is
      // exactly what an intraday assertion needs to tell apart (§2.4).
      occurred_at: (payload.occurredAt as Nullable<string>) ?? null,
      payee: (payload.payee as Nullable<string>) ?? null,
      description: payload.description as string,
      status,
      derived_kind: derivedKind,
      invoice_url: (payload.invoiceUrl as Nullable<string>) ?? null,
      tags: (payload.tags as string[]) ?? [],
      client_id: event.clientId,
      external_ref: event.externalRef,
      reverses_id: metadata.reverses_id ?? null,
      metadata,
    };

    await store.upsert(PROJ_TRANSACTIONS, { transaction_id: event.aggregateId }, row);
    await this.writePostings(event, payload.date as string, status, row.occurred_at, postings, store);
  }

  private async onAmended(
    event: StoredEvent,
    payload: Record<string, unknown>,
    store: ReadModelStore,
  ): Promise<void> {
    const existing = await this.transaction(event.aggregateId, store);

    if (!existing) return;

    const postings = payload.postings as PostingPayload[];
    const date = payload.date as string;
    const derivedKind = await this.deriveKind(event.userId, postings, store);

    await store.upsert(
      PROJ_TRANSACTIONS,
      { transaction_id: event.aggregateId },
      { ...existing, date, derived_kind: derivedKind },
    );

    // An amendment revises what was posted, not when it happened: the instant
    // stays whatever the recording declared.
    await this.clearPostings(event.aggregateId, store);
    await this.writePostings(event, date, existing.status, existing.occurred_at, postings, store);
  }

  private async onAnnotated(
    event: StoredEvent,
    payload: Record<string, unknown>,
    store: ReadModelStore,
  ): Promise<void> {
    const existing = await this.transaction(event.aggregateId, store);

    if (!existing) return;

    await store.upsert(
      PROJ_TRANSACTIONS,
      { transaction_id: event.aggregateId },
      {
        ...existing,
        payee: (payload.payee as Nullable<string>) ?? null,
        description: payload.description as string,
        invoice_url: (payload.invoiceUrl as Nullable<string>) ?? null,
        tags: (payload.tags as string[]) ?? [],
        metadata: (payload.metadata as Record<string, string>) ?? {},
      },
    );
  }

  private async onStatus(
    event: StoredEvent,
    status: string,
    store: ReadModelStore,
  ): Promise<void> {
    const existing = await this.transaction(event.aggregateId, store);

    if (!existing) return;

    await store.upsert(
      PROJ_TRANSACTIONS,
      { transaction_id: event.aggregateId },
      { ...existing, status },
    );

    const postings = await this.postings(event.aggregateId, store);

    for (const posting of postings) {
      await store.upsert(PROJ_POSTINGS, { posting_id: posting.posting_id }, { ...posting, status });
    }
  }

  private async writePostings(
    event: StoredEvent,
    date: string,
    status: string,
    occurredAt: Nullable<string>,
    postings: readonly PostingPayload[],
    store: ReadModelStore,
  ): Promise<void> {
    await Promise.all(
      postings.map((posting, index) => {
        const row: PostingRow = {
          posting_id: `${event.aggregateId}#${index}`,
          transaction_id: event.aggregateId,
          user_id: event.userId,
          account_id: posting.accountId,
          amount: posting.amount,
          currency_code: posting.currency,
          status,
          date,
          occurred_at: occurredAt,
          metadata: posting.metadata ?? {},
        };

        return store.upsert(PROJ_POSTINGS, { posting_id: row.posting_id }, row);
      }),
    );
  }

  private async onReversed(
    event: StoredEvent,
    payload: Record<string, unknown>,
    store: ReadModelStore,
  ): Promise<void> {
    const existing = await this.transaction(event.aggregateId, store);

    if (!existing) return;

    await store.upsert(
      PROJ_TRANSACTIONS,
      { transaction_id: event.aggregateId },
      {
        ...existing,
        reverses_id: payload.reversalTransactionId as string,
      },
    );
  }

  /**
   * Points each voided leg at the transfer that replaced it (§3.6). The
   * transfer's own row already carries `merged_from`; this closes the other
   * direction so a client reading a voided pending can follow it forward
   * without scanning every transfer's metadata.
   *
   * The transfer's postings travel in the event but are not re-projected:
   * its `TransactionRecorded` already wrote them, and writing them twice would
   * duplicate the `proj_postings` rows the balances recompute from.
   */
  private async onMerged(
    event: StoredEvent,
    payload: Record<string, unknown>,
    store: ReadModelStore,
  ): Promise<void> {
    const mergedIds = (payload.mergedTransactionIds as string[]) ?? [];

    for (const mergedId of mergedIds) {
      const existing = await this.transaction(mergedId, store);

      if (!existing) continue;

      await store.upsert(
        PROJ_TRANSACTIONS,
        { transaction_id: mergedId },
        { ...existing, metadata: { ...existing.metadata, merged_into: event.aggregateId } },
      );
    }
  }

  private async clearPostings(transactionId: string, store: ReadModelStore): Promise<void> {
    const postings = await this.postings(transactionId, store);

    await Promise.all(
      postings.map((posting) => store.delete(PROJ_POSTINGS, { posting_id: posting.posting_id })),
    );
  }

  private async deriveKind(
    userId: string,
    postings: readonly PostingPayload[],
    store: ReadModelStore,
  ): Promise<string> {
    const accounts = await store.query<{ account_id: string; type: string }>(
      PROJ_ACCOUNTS,
      Criteria.none().equals('user_id', userId),
    );
    const typeById = new Map(accounts.map((account) => [account.account_id, account.type]));
    const types = postings.map((posting) => typeById.get(posting.accountId));

    // An account still missing from `account_tree` (projections catch up
    // independently) makes the whole classification unreliable: deriving from
    // the subset that did resolve would publish a concrete kind from partial
    // evidence. §9.4.4 — what cannot be classified is COMPOUND.
    if (types.some((type) => !type)) return DerivedKind.COMPOUND;

    return this.deriver.derive(types as AccountType[]);
  }

  private async transaction(
    transactionId: string,
    store: ReadModelStore,
  ): Promise<Nullable<TransactionRow>> {
    const [row] = await store.query<TransactionRow>(
      PROJ_TRANSACTIONS,
      Criteria.none().equals('transaction_id', transactionId),
    );

    return row ?? null;
  }

  private async postings(transactionId: string, store: ReadModelStore): Promise<PostingRow[]> {
    return store.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none().equals('transaction_id', transactionId),
    );
  }
}
