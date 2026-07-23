import { SequentialIdGenerator } from '@ledger/shared/testing';
import {
  AccountName,
  AccountType,
  CurrencyCode,
  LedgerDate,
} from '@ledger/shared-kernel/domain/value-objects';
import { RootTypeImmutableException } from '@ledger/shared-kernel/domain/value-objects';
import { Account } from './account.aggregate';
import { AccountOpened, AccountRenamed } from './events';
import {
  AccountClosedException,
  CurrencyNotAllowedException,
  RealAccountCurrencyException,
  SystemAccountProtectedException,
} from './exceptions/account.exception';

const idGen = new SequentialIdGenerator();

function openReal(): Account {
  return Account.open(
    {
      name: AccountName.of('Assets:Bancolombia:Savings'),
      currencies: [CurrencyCode.of('COP')],
      openedOn: LedgerDate.of('2026-01-01'),
      isBankMirror: true,
      isSystem: false,
    },
    idGen,
  );
}

describe('Account', () => {
  it('opens a real account with exactly one currency and emits AccountOpened', () => {
    const account = openReal();
    const [event] = account.pullChanges();

    expect(event).toBeInstanceOf(AccountOpened);
    expect(account.type).toBe(AccountType.ASSETS);
  });

  it('rejects a real account with more than one currency (INV-4)', () => {
    expect(() =>
      Account.open(
        {
          name: AccountName.of('Assets:Wallet'),
          currencies: [CurrencyCode.of('COP'), CurrencyCode.of('USD')],
          openedOn: LedgerDate.of('2026-01-01'),
          isBankMirror: false,
          isSystem: false,
        },
        idGen,
      ),
    ).toThrow(RealAccountCurrencyException);
  });

  it('allows a nominal account with several currencies', () => {
    const account = Account.open(
      {
        name: AccountName.of('Expenses:Travel'),
        currencies: [CurrencyCode.of('COP'), CurrencyCode.of('USD')],
        openedOn: LedgerDate.of('2026-01-01'),
        isBankMirror: false,
        isSystem: false,
      },
      idGen,
    );

    expect(account.type).toBe(AccountType.EXPENSES);
  });

  it('rehydrates state from history', () => {
    const account = openReal();
    const events = account.pullChanges();
    const rebuilt = Account.rehydrate(account.id, [...events]);

    expect(rebuilt.name.value).toBe('Assets:Bancolombia:Savings');
    expect(rebuilt.version).toBe(1);
  });

  it('renames while preserving the root type (INV-14)', () => {
    const account = openReal();
    account.pullChanges();
    account.rename(AccountName.of('Assets:Bancolombia:Checking'));

    const [event] = account.pullChanges();
    expect(event).toBeInstanceOf(AccountRenamed);
    expect(account.name.value).toBe('Assets:Bancolombia:Checking');
  });

  it('rejects a rename that changes the root type (INV-14)', () => {
    const account = openReal();
    account.pullChanges();

    expect(() => account.rename(AccountName.of('Expenses:Food'))).toThrow(
      RootTypeImmutableException,
    );
  });

  it('protects system accounts from rename and close (INV-13)', () => {
    const system = Account.open(
      {
        name: AccountName.of('Equity:OpeningBalances'),
        currencies: [],
        openedOn: LedgerDate.of('2026-01-01'),
        isBankMirror: false,
        isSystem: true,
      },
      idGen,
    );
    system.pullChanges();

    expect(() => system.rename(AccountName.of('Equity:Opening'))).toThrow(
      SystemAccountProtectedException,
    );
    expect(() => system.close(LedgerDate.of('2026-12-31'))).toThrow(
      SystemAccountProtectedException,
    );
  });

  it('closes on a date and rejects postings outside the open range (INV-3 partial)', () => {
    const account = openReal();
    account.pullChanges();
    account.close(LedgerDate.of('2026-06-30'));

    account.ensureOpenOn(LedgerDate.of('2026-03-01'));
    expect(() => account.ensureOpenOn(LedgerDate.of('2026-07-01'))).toThrow(
      AccountClosedException,
    );
    expect(() => account.ensureOpenOn(LedgerDate.of('2025-12-31'))).toThrow(
      AccountClosedException,
    );
  });

  it('accepts allowed currencies and rejects others (INV-4)', () => {
    const account = openReal();

    account.ensureAcceptsCurrency(CurrencyCode.of('COP'));
    expect(() => account.ensureAcceptsCurrency(CurrencyCode.of('USD'))).toThrow(
      CurrencyNotAllowedException,
    );
  });
});
