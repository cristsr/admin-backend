import { Nullable } from '@shared';
import { Money } from '@ledger/shared/domain/money';

/** The real-account leg of a pending transaction, as the merge rule sees it. */
export interface TransferLeg {
  readonly transactionId: string;
  readonly accountId: string;
  readonly amount: Money;
}

/** Two legs that qualify as the two sides of one transfer (RF-16). */
export interface TransferPair {
  readonly outgoingTxnId: string;
  readonly incomingTxnId: string;
  readonly amount: Money;
  readonly currency: string;
  readonly outgoingAccountId: string;
  readonly incomingAccountId: string;
}

/**
 * Whether two pending legs are the two sides of a single transfer: opposite
 * amounts that net to exactly zero, same currency, distinct real accounts.
 *
 * This is a validation rule, not a suggestion engine — the caller names both
 * transactions explicitly and this decides whether merging them is a legal
 * accounting operation. There is deliberately no time window and no amount
 * tolerance: those belong to whoever proposes candidates to a human, which is
 * outside this ledger's scope.
 */
export class TransferPairRule {
  /** The pair the two legs form, or null when they are not a transfer. */
  pair(first: TransferLeg, second: TransferLeg): Nullable<TransferPair> {
    if (!this.qualifies(first, second)) return null;

    const outgoing = first.amount.isNegative() ? first : second;
    const incoming = first.amount.isNegative() ? second : first;

    return {
      outgoingTxnId: outgoing.transactionId,
      incomingTxnId: incoming.transactionId,
      amount: incoming.amount,
      currency: incoming.amount.currency.code,
      outgoingAccountId: outgoing.accountId,
      incomingAccountId: incoming.accountId,
    };
  }

  private qualifies(first: TransferLeg, second: TransferLeg): boolean {
    if (first.transactionId === second.transactionId) return false;
    if (first.accountId === second.accountId) return false;
    if (first.amount.isZero() || second.amount.isZero()) return false;
    if (first.amount.currency.code !== second.amount.currency.code) return false;
    if (first.amount.isNegative() === second.amount.isNegative()) return false;

    return first.amount.add(second.amount).isZero();
  }
}
