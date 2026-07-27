import { AccountName } from './account-name';
import { AccountType } from './account-type';
import {
  InvalidAccountNameException,
  RootTypeImmutableException,
} from './value-object.exception';

describe('AccountName', () => {
  it('parses a valid multi-segment name and derives its root type', () => {
    const name = AccountName.of('Assets:Bancolombia:Savings');

    expect(name.value).toBe('Assets:Bancolombia:Savings');
    expect(name.rootType).toBe(AccountType.ASSETS);
    expect(name.leaf).toBe('Savings');
  });

  it('accepts every root type case-insensitively and normalizes the label', () => {
    expect(AccountName.of('expenses:Food').rootType).toBe(AccountType.EXPENSES);
    expect(AccountName.of('EQUITY:OpeningBalances').rootType).toBe(AccountType.EQUITY);
  });

  it('rejects an unknown root type', () => {
    expect(() => AccountName.of('Cash:Wallet')).toThrow(InvalidAccountNameException);
  });

  it('rejects empty segments and double separators', () => {
    expect(() => AccountName.of('Assets::Savings')).toThrow(InvalidAccountNameException);
    expect(() => AccountName.of('Assets:')).toThrow(InvalidAccountNameException);
    expect(() => AccountName.of('')).toThrow(InvalidAccountNameException);
  });

  it('returns null parent for a root-level account', () => {
    expect(AccountName.of('Assets').parentName()).toBeNull();
  });

  it('computes the parent name', () => {
    const parent = AccountName.of('Assets:Bank:Savings').parentName();

    expect(parent?.value).toBe('Assets:Bank');
  });

  it('detects descendants by full-segment prefix', () => {
    const ancestor = AccountName.of('Assets:Bank');

    expect(AccountName.of('Assets:Bank:Savings').isDescendantOf(ancestor)).toBe(true);
    expect(AccountName.of('Assets:Banking').isDescendantOf(ancestor)).toBe(false);
    expect(AccountName.of('Assets').isDescendantOf(ancestor)).toBe(false);
  });

  it('reparents preserving the tail', () => {
    const moved = AccountName.of('Assets:Bank:Savings').reparentFrom(
      AccountName.of('Assets:Bank'),
      AccountName.of('Assets:Bancolombia'),
    );

    expect(moved.value).toBe('Assets:Bancolombia:Savings');
  });

  it('rejects a reparent that would change the root type (INV-14)', () => {
    expect(() =>
      AccountName.of('Assets:Bank:Savings').reparentFrom(
        AccountName.of('Assets:Bank'),
        AccountName.of('Expenses:Bank'),
      ),
    ).toThrow(RootTypeImmutableException);
  });

  it('rejects reparenting a name that is not under the old prefix', () => {
    expect(() =>
      AccountName.of('Assets:Other').reparentFrom(
        AccountName.of('Assets:Bank'),
        AccountName.of('Assets:Bancolombia'),
      ),
    ).toThrow(InvalidAccountNameException);
  });

  it('compares by value', () => {
    expect(AccountName.of('Assets:Bank').equals(AccountName.of('Assets:Bank'))).toBe(true);
    expect(AccountName.of('Assets:Bank').equals(AccountName.of('Assets:Cash'))).toBe(false);
  });
});
