import { AccountType } from '@ledger/shared/domain/value-objects';
import { DerivedKind } from './derived-kind';

/**
 * Derives the presentational kind from the account types a transaction touches
 * (RF-4): any EXPENSES → EXPENSE; any INCOME → INCOME; only ASSETS/LIABILITIES
 * → TRANSFER; anything else → COMPOUND. Never throws (§9.4.4) — an unclassifiable
 * mix is COMPOUND, not an error.
 *
 * Two cases RF-4 leaves undefined resolve to COMPOUND rather than to an
 * arbitrary concrete kind, per the protection rule of §9.4.4 ("unknown
 * combinations are COMPOUND, never an error" — and never a wrong guess):
 *
 * - **No account types at all.** An empty list means no account could be
 *   resolved, so nothing is known about the transaction. Reporting TRANSFER
 *   would assert "only real accounts participate" from zero evidence.
 * - **EXPENSES and INCOME together.** RF-4 defines no precedence between them;
 *   picking one by rule order would label a mixed transaction as a plain
 *   expense or income.
 */
export class TransactionKindDeriver {
  derive(accountTypes: readonly AccountType[]): DerivedKind {
    if (accountTypes.length === 0) return DerivedKind.COMPOUND;

    const hasExpenses = accountTypes.includes(AccountType.EXPENSES);
    const hasIncome = accountTypes.includes(AccountType.INCOME);

    if (hasExpenses && hasIncome) return DerivedKind.COMPOUND;
    if (hasExpenses) return DerivedKind.EXPENSE;
    if (hasIncome) return DerivedKind.INCOME;

    const onlyReal = accountTypes.every(
      (type) => type === AccountType.ASSETS || type === AccountType.LIABILITIES,
    );

    return onlyReal ? DerivedKind.TRANSFER : DerivedKind.COMPOUND;
  }
}
