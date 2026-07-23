import { AccountType } from '@ledger/shared-kernel/domain/value-objects';
import { DerivedKind } from './derived-kind';

/**
 * Derives the presentational kind from the account types a transaction touches
 * (RF-4): any EXPENSES → EXPENSE; any INCOME → INCOME; only ASSETS/LIABILITIES
 * → TRANSFER; anything else → COMPOUND. Never throws (§9.4.4) — an unclassifiable
 * mix is COMPOUND, not an error.
 */
export class TransactionKindDeriver {
  derive(accountTypes: readonly AccountType[]): DerivedKind {
    if (accountTypes.includes(AccountType.EXPENSES)) return DerivedKind.EXPENSE;
    if (accountTypes.includes(AccountType.INCOME)) return DerivedKind.INCOME;

    const onlyReal = accountTypes.every(
      (type) => type === AccountType.ASSETS || type === AccountType.LIABILITIES,
    );

    return onlyReal ? DerivedKind.TRANSFER : DerivedKind.COMPOUND;
  }
}
