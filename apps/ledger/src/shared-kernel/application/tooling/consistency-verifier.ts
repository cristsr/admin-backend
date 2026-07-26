import { Criteria } from '@shared';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { Money } from '@ledger/shared/domain/money';
import { Currency } from '@ledger/shared/domain/money/currency';
import { EventRegistry } from '@ledger/shared-kernel/application/event/event-registry';
import {
  BalanceDiscrepancy,
  BalanceVerificationReport,
} from './balance-verification-report.type';

type PostingProjection = {
  readonly accountId: string;
  readonly amount: Money;
  readonly currencyCode: string;
  readonly status: 'CONFIRMED' | 'PENDING';
};

type TransactionLedgerEntry = {
  readonly postings: readonly PostingProjection[];
  readonly status: 'CONFIRMED' | 'PENDING';
};

type StoredEventLike = {
  readonly userId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
};

export class ConsistencyVerifier {
  constructor(
    private readonly eventStore: EventStore,
    private readonly readModel: ReadModelStore,
    private readonly eventRegistry: EventRegistry,
  ) {}

  async verifyBalances(userId: string): Promise<BalanceVerificationReport> {
    const events = await this.eventStore.readAll(0n, Number.MAX_SAFE_INTEGER);
    const userEvents = (events as unknown as StoredEventLike[]).filter(
      (e) => e.userId === userId,
    );

    const streamBalances = this.computeBalances(userEvents);
    const projectedBalances = await this.loadProjectedBalances(userId);

    const discrepancies: BalanceDiscrepancy[] = [];
    const allKeys = new Set([
      ...streamBalances.keys(),
      ...projectedBalances.keys(),
    ]);

    for (const key of allKeys) {
      const [accountId, currencyCode] = key.split('|');
      const stream = streamBalances.get(key);
      const projected = projectedBalances.get(key);

      const streamConfirmed = stream?.confirmed ?? Money.zero(this.resolveCurrency(currencyCode));
      const streamPending = stream?.pending ?? Money.zero(this.resolveCurrency(currencyCode));
      const projectedConfirmed = projected?.confirmed ?? Money.zero(this.resolveCurrency(currencyCode));
      const projectedPending = projected?.pending ?? Money.zero(this.resolveCurrency(currencyCode));

      if (
        !streamConfirmed.equals(projectedConfirmed) ||
        !streamPending.equals(projectedPending)
      ) {
        discrepancies.push({
          accountId,
          currencyCode,
          streamConfirmed,
          streamPending,
          projectedConfirmed,
          projectedPending,
          driftConfirmed: streamConfirmed.subtract(projectedConfirmed),
          driftPending: streamPending.subtract(projectedPending),
        });
      }
    }

    return { ok: discrepancies.length === 0, discrepancies };
  }

  private computeBalances(
    events: readonly StoredEventLike[],
  ): Map<string, { confirmed: Money; pending: Money }> {
    const ledger = new Map<string, TransactionLedgerEntry>();

    for (const event of events) {
      if (event.aggregateType !== 'LedgerTransaction') continue;

      switch (event.eventType) {
        case 'TransactionRecorded': {
          const p = event.payload as {
            status: string;
            postings: readonly {
              accountId: string;
              amount: string;
              currency: string;
              metadata: Readonly<Record<string, string>>;
            }[];
          };
          const postings = p.postings.map((raw) => ({
            accountId: raw.accountId,
            amount: Money.of(raw.amount, this.resolveCurrency(raw.currency)),
            currencyCode: raw.currency,
            status: p.status as 'CONFIRMED' | 'PENDING',
          }));
          ledger.set(event.aggregateId, {
            postings,
            status: p.status as 'CONFIRMED' | 'PENDING',
          });
          break;
        }
        case 'TransactionAmended': {
          const p = event.payload as {
            status: string;
            postings: readonly {
              accountId: string;
              amount: string;
              currency: string;
              metadata: Readonly<Record<string, string>>;
            }[];
          };
          const entry = ledger.get(event.aggregateId);
          if (entry) {
            const amendedPostings = p.postings.map((raw) => ({
              accountId: raw.accountId,
              amount: Money.of(raw.amount, this.resolveCurrency(raw.currency)),
              currencyCode: raw.currency,
              status: entry.status,
            }));
            ledger.set(event.aggregateId, {
              postings: amendedPostings,
              status: entry.status,
            });
          }
          break;
        }
        case 'TransactionConfirmed': {
          const entry = ledger.get(event.aggregateId);
          if (entry) {
            const confirmedPostings = entry.postings.map((p) => ({
              ...p,
              status: 'CONFIRMED' as const,
            }));
            ledger.set(event.aggregateId, {
              postings: confirmedPostings,
              status: 'CONFIRMED',
            });
          }
          break;
        }
        case 'TransactionVoided': {
          ledger.delete(event.aggregateId);
          break;
        }
        case 'TransactionReversed': {
          // Reversal creates a separate aggregate with its own TransactionRecorded.
          // The original transaction's aggregate processes this but doesn't add
          // new postings — the reversal is represented by the new aggregate.
          break;
        }
      }
    }

    return this.aggregateLedger(ledger);
  }

  private aggregateLedger(
    ledger: Map<string, TransactionLedgerEntry>,
  ): Map<string, { confirmed: Money; pending: Money }> {
    const balances = new Map<string, { confirmed: Money; pending: Money }>();

    for (const entry of ledger.values()) {
      for (const posting of entry.postings) {
        const key = `${posting.accountId}|${posting.currencyCode}`;
        const currency = posting.amount.currency;
        const current = balances.get(key) ?? {
          confirmed: Money.zero(currency),
          pending: Money.zero(currency),
        };

        if (posting.status === 'CONFIRMED') {
          balances.set(key, {
            confirmed: current.confirmed.add(posting.amount),
            pending: current.pending,
          });
        } else {
          balances.set(key, {
            confirmed: current.confirmed,
            pending: current.pending.add(posting.amount),
          });
        }
      }
    }

    return balances;
  }

  private async loadProjectedBalances(
    _userId: string,
  ): Promise<Map<string, { confirmed: Money; pending: Money }>> {
    const rows = await this.readModel.query<{
      account_id: string;
      currency_code: string;
      confirmed_amount: string;
      pending_amount: string;
    }>('proj_balances', Criteria.none());

    const map = new Map<string, { confirmed: Money; pending: Money }>();

    for (const row of rows) {
      const currency = this.resolveCurrency(row.currency_code);
      map.set(`${row.account_id}|${row.currency_code}`, {
        confirmed: Money.of(row.confirmed_amount, currency),
        pending: Money.of(row.pending_amount, currency),
      });
    }

    return map;
  }

  private resolveCurrency(code: string): Currency {
    const map: Record<string, number> = {
      COP: 0,
      USD: 2,
      EUR: 2,
      GBP: 2,
      MXN: 2,
      ARS: 2,
      CLP: 0,
      PEN: 2,
      BRL: 2,
      UYU: 2,
      PYG: 0,
      VES: 2,
      BOB: 2,
    };
    const minorUnits = map[code];
    if (minorUnits === undefined) {
      throw new Error(`Unknown currency code: ${code}`);
    }
    return Currency.of(code, minorUnits);
  }
}
