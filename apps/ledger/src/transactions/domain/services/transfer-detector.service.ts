import { Inject, Injectable } from '@nestjs/common';
import { Nullable } from '@shared';
import { Money } from '@ledger/shared/domain/money';
import { LedgerDate } from '@ledger/shared-kernel/domain/value-objects';

/** A pending transaction leg on a real account, as seen by the detector. */
export interface PendingLeg {
  readonly transactionId: string;
  readonly accountId: string;
  readonly amount: Money;
  readonly date: LedgerDate;
  readonly isRealAccount: boolean;
}

/** A detected pair of pending legs that qualifies as a transfer (RF-15). */
export interface TransferCandidatePair {
  readonly outgoingTxnId: string;
  readonly incomingTxnId: string;
  readonly amount: Money;
  readonly currency: string;
  readonly outgoingAccountId: string;
  readonly incomingAccountId: string;
  readonly withinDays: number;
}

/** Configurable detection window and tolerance (open question #4). */
export interface TransferDetectionConfig {
  readonly windowDays: number;
  readonly amountTolerance: string;
}

/** DI token for {@link TransferDetectionConfig}. */
export const TRANSFER_DETECTION_CONFIG = Symbol('TRANSFER_DETECTION_CONFIG');

/**
 * Pure matching rule for transfer detection (RF-15): two pending legs pair up
 * when their amounts are opposite (within tolerance), same currency, on distinct
 * real accounts, and within the configured day window.
 */
@Injectable()
export class TransferDetector {
  constructor(
    @Inject(TRANSFER_DETECTION_CONFIG) private readonly config: TransferDetectionConfig,
  ) {}

  /** The first `other` leg that pairs with `candidate`, or null if none qualifies. */
  match(candidate: PendingLeg, others: readonly PendingLeg[]): Nullable<TransferCandidatePair> {
    if (!candidate.isRealAccount || candidate.amount.isZero()) return null;

    const partner = others.find((other) => this.pairs(candidate, other));

    if (!partner) return null;

    return this.toPair(candidate, partner);
  }

  private pairs(candidate: PendingLeg, other: PendingLeg): boolean {
    if (other.transactionId === candidate.transactionId) return false;
    if (!other.isRealAccount) return false;
    if (other.accountId === candidate.accountId) return false;
    if (other.amount.currency.code !== candidate.amount.currency.code) return false;
    if (!this.areOpposite(candidate.amount, other.amount)) return false;

    return this.withinWindow(candidate.date, other.date);
  }

  /** Opposite sign and netting to within tolerance (usually exactly zero). */
  private areOpposite(a: Money, b: Money): boolean {
    if (a.isNegative() === b.isNegative()) return false;

    const net = a.add(b);
    const magnitude = net.isNegative() ? net.negate() : net;
    const tolerance = Money.of(this.config.amountTolerance, a.currency);

    return magnitude.compareTo(tolerance) <= 0;
  }

  private withinWindow(a: LedgerDate, b: LedgerDate): boolean {
    return this.gapDays(a, b) <= this.config.windowDays;
  }

  private toPair(candidate: PendingLeg, partner: PendingLeg): TransferCandidatePair {
    const outgoing = candidate.amount.isNegative() ? candidate : partner;
    const incoming = candidate.amount.isNegative() ? partner : candidate;

    return {
      outgoingTxnId: outgoing.transactionId,
      incomingTxnId: incoming.transactionId,
      amount: incoming.amount,
      currency: incoming.amount.currency.code,
      outgoingAccountId: outgoing.accountId,
      incomingAccountId: incoming.accountId,
      withinDays: this.gapDays(candidate.date, partner.date),
    };
  }

  private gapDays(a: LedgerDate, b: LedgerDate): number {
    const dayMs = 86_400_000;
    const epochA = this.epochDay(a);
    const epochB = this.epochDay(b);

    return Math.abs(epochA - epochB) / dayMs;
  }

  /** Milliseconds since the Unix epoch for a `LedgerDate`'s calendar day (UTC). */
  private epochDay(date: LedgerDate): number {
    const [year, month, day] = date.value.split('-').map(Number);

    return Date.UTC(year, month - 1, day);
  }
}
