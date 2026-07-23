import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import { StoredEvent } from '@ledger/shared-kernel/domain/event/stored-event.type';
import { CurrencyCatalog, CurrencyCode, LedgerDate } from '@ledger/shared-kernel/domain/value-objects';
import { AccountLookup } from '@ledger/transactions/domain/ports/account-lookup.port';
import {
  PendingLegRow,
  TransferCandidateStore,
} from '@ledger/transactions/domain/ports/transfer-candidate-store.port';
import {
  PendingLeg,
  TransferDetector,
} from '@ledger/transactions/domain/services/transfer-detector.service';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';

const REAL_ACCOUNT_TYPES: ReadonlySet<string> = new Set(['ASSETS', 'LIABILITIES']);

/** A posting as it appears in a transaction event payload. */
interface EventPosting {
  readonly accountId: string;
  readonly amount: string;
  readonly currency: string;
}

/**
 * Materializes `transfer_candidates` (RF-15): as pending legs appear it pairs
 * them (opposite amount, same currency, distinct real accounts, within window)
 * and removes pairs when a leg leaves `PENDING` (void/confirm/merge). Only writer
 * of the projection; reads account types through `proj_accounts`. Driven by the
 * async transfer pump; persists to a bespoke in-memory store (TODO(persistence)).
 */
@Injectable()
export class TransferCandidatesProjector {
  constructor(
    private readonly store: TransferCandidateStore,
    private readonly detector: TransferDetector,
    private readonly accounts: AccountLookup,
    private readonly catalog: CurrencyCatalog,
  ) {}

  async project(event: StoredEvent): Promise<void> {
    if (event.eventType === 'TransactionRecorded' || event.eventType === 'TransactionAmended') {
      return this.onLegUpserted(event);
    }

    if (event.eventType === 'TransactionVoided' || event.eventType === 'TransactionConfirmed') {
      return this.store.removePendingLeg(event.aggregateId);
    }
  }

  private async onLegUpserted(event: StoredEvent): Promise<void> {
    const payload = event.payload as Record<string, unknown>;

    // Only pending transactions produce candidate legs. `TransactionAmended`
    // only fires while PENDING, so a missing status is treated as pending.
    const status = (payload.status as string) ?? TransactionStatus.PENDING;
    if (status !== TransactionStatus.PENDING) return this.store.removePendingLeg(event.aggregateId);

    const postings = (payload.postings as EventPosting[]) ?? [];
    const date = payload.date as string;
    const realPosting = await this.firstRealPending(event.userId, postings);

    if (!realPosting) return; // guard: no real pending leg to track

    const row: PendingLegRow = {
      transactionId: event.aggregateId,
      userId: event.userId,
      accountId: realPosting.accountId,
      amount: realPosting.amount,
      currencyCode: realPosting.currency,
      date,
      isRealAccount: true,
      externalRef: event.externalRef,
    };

    await this.store.upsertPendingLeg(row);
    await this.detectPairFor(event.userId, row);
  }

  private async detectPairFor(userId: string, row: PendingLegRow): Promise<void> {
    const legs = await this.store.pendingLegs(userId);
    const candidate = this.toLeg(row);
    const others = legs
      .filter((leg) => leg.transactionId !== row.transactionId)
      .map((leg) => this.toLeg(leg));

    const pair = this.detector.match(candidate, others);

    if (!pair) return;

    await this.store.upsertPair({
      pairId: `${pair.outgoingTxnId}:${pair.incomingTxnId}`,
      userId,
      outgoingTxnId: pair.outgoingTxnId,
      incomingTxnId: pair.incomingTxnId,
      outgoingAccountId: pair.outgoingAccountId,
      incomingAccountId: pair.incomingAccountId,
      amount: pair.amount.toDecimalString(),
      currencyCode: pair.currency,
      gapDays: pair.withinDays,
    });
  }

  private async firstRealPending(
    userId: string,
    postings: readonly EventPosting[],
  ): Promise<Nullable<EventPosting>> {
    for (const posting of postings) {
      const facts = await this.accounts.factsOf(userId, posting.accountId);

      if (facts && REAL_ACCOUNT_TYPES.has(facts.type)) return posting;
    }

    return null;
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
