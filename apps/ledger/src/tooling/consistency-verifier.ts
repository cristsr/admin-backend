import { Projector } from '@cqrs/application/projection/projector';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { InMemoryReadModelStore } from '@cqrs/infrastructure/adapters/read-model-store/in-memory/in-memory-read-model-store';
import { Criteria } from '@shared';
import { PROJ_ACCOUNTS } from '@ledger/accounts/application/read-models/account-tree.read-model';
import { AccountTreeProjector } from '@ledger/accounts/infrastructure/projections/account-tree.projector';
import { Money } from '@ledger/shared/domain/money';
import { CurrencyCatalog, CurrencyCode } from '@ledger/shared/domain/value-objects';
import { PROJ_BALANCES } from '@ledger/transactions/application/read-models/account-balances.read-model';
import { AccountBalancesProjector } from '@ledger/transactions/infrastructure/projections/account-balances.projector';
import { TransactionListProjector } from '@ledger/transactions/infrastructure/projections/transaction-list.projector';
import {
  BalanceDiscrepancy,
  BalanceVerificationReport,
} from './balance-verification-report.type';

/** Default number of events one `readAll` page pulls while replaying. */
const DEFAULT_PAGE_SIZE = 1000;

type BalanceRow = {
  readonly account_id: string;
  readonly currency_code: string;
  readonly confirmed_amount: string;
  readonly pending_amount: string;
};

type Balance = {
  readonly confirmed: Money;
  readonly pending: Money;
};

/**
 * Answers whether `proj_balances` still agrees with the stream that produced it.
 *
 * Drift is measured by replaying the user's events through the very projectors
 * that maintain the table and diffing the result against what is stored — never
 * against a second, hand-written sum. A separate implementation of the fold
 * would be another place for the accounting rules to live (INV-11), and a bug
 * in it would report drift that is not there.
 */
export class ConsistencyVerifier {
  constructor(
    private readonly eventStore: EventStore,
    private readonly readModel: ReadModelStore,
    private readonly catalog: CurrencyCatalog,
    private readonly pageSize: number = DEFAULT_PAGE_SIZE,
  ) {}

  async verifyBalances(userId: string): Promise<BalanceVerificationReport> {
    const replayed = await this.replayBalances(userId);
    const stored = await this.storedBalances(userId);

    const discrepancies: BalanceDiscrepancy[] = [];

    for (const key of new Set([...replayed.keys(), ...stored.keys()])) {
      const [accountId, currencyCode] = key.split('|');
      const zero = this.zeroBalance(currencyCode);
      const stream = replayed.get(key) ?? zero;
      const projected = stored.get(key) ?? zero;

      if (
        stream.confirmed.equals(projected.confirmed) &&
        stream.pending.equals(projected.pending)
      ) {
        continue;
      }

      discrepancies.push({
        accountId,
        currencyCode,
        streamConfirmed: stream.confirmed,
        streamPending: stream.pending,
        projectedConfirmed: projected.confirmed,
        projectedPending: projected.pending,
        driftConfirmed: stream.confirmed.subtract(projected.confirmed),
        driftPending: stream.pending.subtract(projected.pending),
      });
    }

    return { ok: discrepancies.length === 0, discrepancies };
  }

  /**
   * Materializes the user's balances from scratch in memory. The projector
   * order matters: balances are recomputed from `proj_postings`, which the
   * transaction list writes, which in turn reads the account tree.
   */
  private async replayBalances(userId: string): Promise<Map<string, Balance>> {
    const scratch = new InMemoryReadModelStore();
    const projectors: readonly Projector[] = [
      new AccountTreeProjector(),
      new TransactionListProjector(),
      new AccountBalancesProjector(this.catalog),
    ];

    for await (const event of this.userEvents(userId)) {
      for (const projector of projectors) {
        if (projector.handles(event.eventType)) {
          await projector.project(event, scratch);
        }
      }
    }

    return this.balancesFrom(scratch);
  }

  /**
   * The stored balances that belong to this user, plus any row whose account
   * belongs to nobody.
   *
   * `proj_balances` carries no user id, so ownership has to come from the
   * account tree — without that filter another user's balance reads as drift
   * and the report is useless past the first tenant (INV-9). An orphan row is
   * kept on purpose: an account-less balance is drift by definition, and
   * dropping it would hide exactly what this tool exists to find.
   */
  private async storedBalances(userId: string): Promise<Map<string, Balance>> {
    const owners = await this.accountOwners();
    const stored = await this.balancesFrom(this.readModel);

    for (const key of [...stored.keys()]) {
      const owner = owners.get(key.split('|')[0]);

      if (owner !== undefined && owner !== userId) stored.delete(key);
    }

    return stored;
  }

  /** Maps every projected account to the user holding it. */
  private async accountOwners(): Promise<Map<string, string>> {
    const rows = await this.readModel.query<{ account_id: string; user_id: string }>(
      PROJ_ACCOUNTS,
      Criteria.none(),
    );

    return new Map(rows.map((row) => [row.account_id, row.user_id]));
  }

  private async balancesFrom(store: ReadModelStore): Promise<Map<string, Balance>> {
    const rows = await store.query<BalanceRow>(PROJ_BALANCES, Criteria.none());
    const balances = new Map<string, Balance>();

    for (const row of rows) {
      const currency = this.catalog.resolve(CurrencyCode.of(row.currency_code));

      balances.set(`${row.account_id}|${row.currency_code}`, {
        confirmed: Money.of(row.confirmed_amount, currency),
        pending: Money.of(row.pending_amount, currency),
      });
    }

    return balances;
  }

  /**
   * Walks the global stream in pages, keeping only one user's events.
   *
   * `readAll` is exclusive on `fromPosition`, so the cursor is the last
   * position seen, never the one after it — advancing past it would skip the
   * event sitting on a page boundary and report drift that is not there.
   *
   * @yields {StoredEvent} every event belonging to `userId`, in global order.
   */
  private async *userEvents(userId: string): AsyncGenerator<StoredEvent> {
    let position = 0n;

    for (;;) {
      const page = await this.eventStore.readAll(position, this.pageSize);

      if (!page.length) return;

      for (const event of page) {
        if (event.userId === userId) yield event;
      }

      position = page[page.length - 1].globalPosition;
    }
  }

  private zeroBalance(currencyCode: string): Balance {
    const zero = Money.zero(this.catalog.resolve(CurrencyCode.of(currencyCode)));

    return { confirmed: zero, pending: zero };
  }
}
