import { Criteria } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import { Projector } from '@ledger/shared-kernel/application/projection/projector';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import {
  CurrencyCatalog,
  CurrencyCode,
} from '@ledger/shared-kernel/domain/value-objects';
import { SeedCurrencyCatalog } from '@ledger/shared-kernel/infrastructure/adapters/currency/seed-currency-catalog';
import { PROJ_POSTINGS } from './transaction-list.projector';

/** Read-model table for balances per account and currency. */
export const PROJ_BALANCES = 'proj_balances';

type PostingRow = {
  readonly account_id: string;
  readonly amount: string;
  readonly currency_code: string;
  readonly status: string;
};

/**
 * Maintains `proj_balances` (§6.2): confirmed and pending amounts per account
 * and currency, tracked separately (INV-5 — balances are a projection, never
 * written by a command). It recomputes each affected account+currency from
 * `proj_postings`, so it must run after `transaction_list` in the projector
 * order; recompute keeps it correct on replay and rebuild (RNF-5).
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
      await this.recompute(accountId, currencyCode, store, event.recordedAt);
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

  private async recompute(
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
      { account_id: accountId, currency_code: currencyCode },
      {
        account_id: accountId,
        currency_code: currencyCode,
        confirmed_amount: confirmed.toDecimalString(),
        pending_amount: pending.toDecimalString(),
        updated_at: updatedAt.toISOString(),
      },
    );
  }
}
