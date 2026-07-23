import { Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import {
  AccountLookup,
  DomainEvent,
  LocalDate,
  PostingSnapshot,
  TRANSACTION_AMENDED,
  TRANSACTION_CONFIRMED,
  TRANSACTION_RECORDED,
  TRANSACTION_VOIDED,
  TransactionEventPayload,
  TransactionStatus,
  resolveAssumedCurrency,
} from '@ledger/shared/ep1-ep2-contracts.assumed';
import {
  PendingLegRow,
  TransferCandidateStore,
} from '@ledger/transactions/domain/ports/transfer-candidate-store.port';
import { PendingLeg, TransferDetector } from '@ledger/transactions/domain/services/transfer-detector.service';

const REAL_ACCOUNT_TYPES: ReadonlySet<string> = new Set(['ASSETS', 'LIABILITIES']);

/**
 * Materializes `transfer_candidates` (RF-15): as pending legs appear it pairs
 * them (opposite amount, same currency, distinct real accounts, within window)
 * and removes pairs when a leg leaves `PENDING` (void/confirm/merge). Only writer
 * of the projection; reads account types through the assumed `proj_accounts`.
 */
@Injectable()
export class TransferCandidatesProjector {
  constructor(
    private readonly store: TransferCandidateStore,
    private readonly detector: TransferDetector,
    private readonly accounts: AccountLookup,
  ) {}

  async project(event: DomainEvent): Promise<void> {
    if (event.type === TRANSACTION_RECORDED || event.type === TRANSACTION_AMENDED) {
      return this.onLegUpserted(event);
    }

    if (event.type === TRANSACTION_VOIDED || event.type === TRANSACTION_CONFIRMED) {
      const payload = event.payload as TransactionEventPayload;

      return this.store.removePendingLeg(payload.transactionId);
    }
  }

  private async onLegUpserted(event: DomainEvent): Promise<void> {
    const payload = event.payload as TransactionEventPayload;
    const realPosting = await this.firstRealPending(event.userId, payload.postings);

    if (!realPosting) return; // guard: no real pending leg to track

    const row: PendingLegRow = {
      transactionId: payload.transactionId,
      userId: event.userId,
      accountId: realPosting.accountId,
      amount: realPosting.amount,
      currencyCode: realPosting.currency,
      date: realPosting.date,
      isRealAccount: true,
      externalRef: event.externalRef,
    };

    await this.store.upsertPendingLeg(row);
    await this.detectPairFor(event.userId, row);
  }

  private async detectPairFor(userId: string, row: PendingLegRow): Promise<void> {
    const legs = await this.store.pendingLegs(userId);
    const candidate = this.toLeg(row);
    const others = legs.filter((leg) => leg.transactionId !== row.transactionId).map((leg) => this.toLeg(leg));

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
    postings: readonly PostingSnapshot[],
  ): Promise<Nullable<PostingSnapshot>> {
    for (const posting of postings) {
      if (posting.status !== TransactionStatus.PENDING) continue;

      const facts = await this.accounts.factsOf(userId, posting.accountId);

      if (facts && REAL_ACCOUNT_TYPES.has(facts.type)) return posting;
    }

    return null;
  }

  private toLeg(row: PendingLegRow): PendingLeg {
    return {
      transactionId: row.transactionId,
      accountId: row.accountId,
      amount: Money.of(row.amount, resolveAssumedCurrency(row.currencyCode)),
      date: LocalDate.of(row.date),
      isRealAccount: row.isRealAccount,
    };
  }
}
