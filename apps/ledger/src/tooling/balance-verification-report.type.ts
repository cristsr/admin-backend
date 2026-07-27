import { Money } from '@ledger/shared/domain/money';

export type BalanceDiscrepancy = {
  readonly accountId: string;
  readonly currencyCode: string;
  readonly streamConfirmed: Money;
  readonly streamPending: Money;
  readonly projectedConfirmed: Money;
  readonly projectedPending: Money;
  readonly driftConfirmed: Money;
  readonly driftPending: Money;
};

export type BalanceVerificationReport = {
  readonly ok: boolean;
  readonly discrepancies: readonly BalanceDiscrepancy[];
};
