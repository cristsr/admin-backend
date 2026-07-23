import { AccountType } from '@ledger/shared-kernel/domain/value-objects';
import { DerivedKind } from './derived-kind';
import { TransactionKindDeriver } from './transaction-kind.deriver';

describe('TransactionKindDeriver', () => {
  const deriver = new TransactionKindDeriver();

  it('classifies any EXPENSES as EXPENSE', () => {
    expect(deriver.derive([AccountType.ASSETS, AccountType.EXPENSES])).toBe(DerivedKind.EXPENSE);
  });

  it('classifies any INCOME as INCOME', () => {
    expect(deriver.derive([AccountType.ASSETS, AccountType.INCOME])).toBe(DerivedKind.INCOME);
  });

  it('classifies only ASSETS/LIABILITIES as TRANSFER', () => {
    expect(deriver.derive([AccountType.ASSETS, AccountType.LIABILITIES])).toBe(
      DerivedKind.TRANSFER,
    );
  });

  it('classifies an unclassifiable mix as COMPOUND, never throwing', () => {
    expect(deriver.derive([AccountType.ASSETS, AccountType.EQUITY])).toBe(DerivedKind.COMPOUND);
    expect(deriver.derive([])).toBe(DerivedKind.TRANSFER);
  });
});
