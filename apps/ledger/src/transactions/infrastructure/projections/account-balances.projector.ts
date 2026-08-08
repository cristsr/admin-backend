import { Projector } from '@cqrs/application/projection/projector';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { Criteria } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import {
  CurrencyCatalog,
  CurrencyCode,
} from '@ledger/shared/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared/infrastructure/adapters/currency/seed-currency-catalog';
import { PROJ_BALANCES } from '@ledger/transactions/infrastructure/projections/account-balances.schema';
import { PROJ_POSTINGS } from '@ledger/transactions/application/read-models/transaction-list.read-model';

type PostingRow = {
  readonly account_id: string;
  readonly amount: string;
  readonly currency_code: string;
  readonly status: string;
};

/**
 * Maintains `proj_balances`: confirmed and pending amounts per account
 * and currency, tracked separately (INV-5 — balances are a projection, never
 * written by a command). It recomputes each affected account+currency from
 * `proj_postings`, so it must run after `transaction_list` in the projector
 * order; recompute keeps it correct on replay and rebuild.
 */
export class AccountBalancesProjector extends Projector {
  readonly name = 'account_balances';
  readonly consumes = [
    'TransactionRecorded',
    'TransactionAmended',
    'TransactionConfirmed',
    'TransactionVoided',
    'TransactionReversed',
  ];

  constructor(private readonly catalog: CurrencyCatalog = new SeedCurrencyCatalog()) {
    super();
  }

  async project(event: StoredEvent, store: ReadModelStore): Promise<void> {
    const affected = await this.affectedPairs(event.aggregateId, store);

    for (const { accountId, currencyCode } of affected) {
      await this.recompute(event.userId, accountId, currencyCode, store, event.recordedAt);
    }
  }

  private async affectedPairs(
    transactionId: string,
    store: ReadModelStore,
  ): Promise<readonly { accountId: string; currencyCode: string }[]> {
    const rows = await store.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none().equals('transaction_id', transactionId),
    );

    const unique = new Map<string, { accountId: string; currencyCode: string }>();

    for (const row of rows) {
      unique.set(`${row.account_id}|${row.currency_code}`, {
        accountId: row.account_id,
        currencyCode: row.currency_code,
      });
    }

    return [...unique.values()];
  }

  /**
   * Rewrites one account+currency balance, stamped with its owning user.
   *
   * The owner is taken from the event rather than looked up: every event belongs
   * to exactly one user (INV-9), and a balance that does not carry its owner can
   * only be attributed by crossing against `proj_accounts` — a join the read
   * side cannot express, which is what forced its readers to fetch every user's
   * balances and discard in memory.
   */
  private async recompute(
    userId: string,
    accountId: string,
    currencyCode: string,
    store: ReadModelStore,
    updatedAt: Date,
  ): Promise<void> {
    const rows = await store.query<PostingRow>(
      PROJ_POSTINGS,
      Criteria.none().equals('account_id', accountId).equals('currency_code', currencyCode),
    );

    const currency = this.catalog.resolve(CurrencyCode.of(currencyCode));
    let confirmed = Money.zero(currency);
    let pending = Money.zero(currency);

    for (const row of rows) {
      const amount = Money.of(row.amount, currency);

      if (row.status === 'CONFIRMED') confirmed = confirmed.add(amount);
      else if (row.status === 'PENDING') pending = pending.add(amount);
    }

    await store.upsert(
      PROJ_BALANCES,
      { user_id: userId, account_id: accountId, currency_code: currencyCode },
      {
        user_id: userId,
        account_id: accountId,
        currency_code: currencyCode,
        confirmed_amount: confirmed.toDecimalString(),
        pending_amount: pending.toDecimalString(),
        updated_at: updatedAt.toISOString(),
      },
    );
  }
}
