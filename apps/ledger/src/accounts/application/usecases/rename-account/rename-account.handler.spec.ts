import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { AccountNameReader } from '@ledger/accounts/application/ports/account-name-reader.port';
import { IdGenerator } from '@cqrs/domain/ports';
import { AccountRepository } from '@ledger/accounts/application/repositories/account.repository';
import { AccountNameRegistry } from '@ledger/accounts/application/services/account-name.registry';
import { Account } from '@ledger/accounts/domain/account/account.aggregate';
import { AccountNotFoundException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import {
  NameCollisionException,
  SystemAccountProtectedException,
} from '@ledger/accounts/domain/account/exceptions/account.exception';
import {
  AccountName,
  CurrencyCode,
  LedgerDate,
} from '@ledger/shared/domain/value-objects';
import { RenameAccountCommand } from './rename-account.command';
import { RenameAccountHandler } from './rename-account.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

const ids: IdGenerator = { next: () => 'acc-1' };

/** A real aggregate, so the rename goes through INV-13/INV-14 as in production. */
function anAccount(name: string, isSystem = false): Account {
  const account = Account.open(
    {
      name: AccountName.of(name),
      currencies: [CurrencyCode.of('COP')],
      openedOn: LedgerDate.of('2026-01-01'),
      isBankMirror: false,
      isSystem,
    },
    ids,
  );
  account.pullChanges();

  return account;
}

function setup(names: readonly string[]) {
  /** A reader holding exactly the names the test declares, for one user. */
  const reader = new (class extends AccountNameReader {
    async isTaken(_userId: string, name: string): Promise<boolean> {
      return names.includes(name);
    }

    async namesOf(): Promise<readonly string[]> {
      return names;
    }
  })();

  const accounts = {
    load: jest.fn(),
    save: jest.fn().mockResolvedValue({ events: [], version: 2, lastPosition: 9n }),
  } as unknown as jest.Mocked<AccountRepository>;

  const dispatcher: jest.Mocked<ProjectionDispatcher> = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };

  const handler = new RenameAccountHandler(
    accounts,
    new AccountNameRegistry(reader),
    dispatcher,
  );

  return { handler, accounts, dispatcher };
}

describe('RenameAccountHandler', () => {
  it('renames an account and dispatches the resulting events', async () => {
    const { handler, accounts, dispatcher } = setup(['Assets:Bank', 'Expenses:Food']);
    accounts.load.mockResolvedValue(anAccount('Assets:Bank'));
    accounts.save.mockResolvedValue({ events: ['ev-1'] as never, version: 2, lastPosition: 9n });

    const result = await handler.execute(
      new RenameAccountCommand('acc-1', 'Assets:Bancolombia'),
      ctx,
    );

    expect(result.streamPosition).toBe(9n);
    expect(accounts.save).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(['ev-1']);
  });

  it('rejects a rename onto an existing name with NAME_COLLISION', async () => {
    const { handler, accounts } = setup(['Assets:Bank', 'Assets:Cash']);
    accounts.load.mockResolvedValue(anAccount('Assets:Bank'));

    await expect(
      handler.execute(new RenameAccountCommand('acc-1', 'Assets:Cash'), ctx),
    ).rejects.toBeInstanceOf(NameCollisionException);
    expect(accounts.save).not.toHaveBeenCalled();
  });

  it('accepts renaming an account to its own current name', async () => {
    const { handler, accounts } = setup(['Assets:Bank', 'Assets:Bank:Savings']);
    accounts.load.mockResolvedValue(anAccount('Assets:Bank'));

    await expect(
      handler.execute(new RenameAccountCommand('acc-1', 'Assets:Bank'), ctx),
    ).resolves.toMatchObject({ aggregateId: 'acc-1' });
  });

  it('rejects when a descendant would collide after propagation', async () => {
    const { handler, accounts } = setup([
      'Assets:Cash',
      'Assets:Cash:Savings',
      'Assets:Bank:Savings',
    ]);
    accounts.load.mockResolvedValue(anAccount('Assets:Cash'));

    await expect(
      handler.execute(new RenameAccountCommand('acc-1', 'Assets:Bank'), ctx),
    ).rejects.toBeInstanceOf(NameCollisionException);
    expect(accounts.save).not.toHaveBeenCalled();
  });

  it('rejects renaming an unknown account', async () => {
    const { handler, accounts } = setup([]);
    accounts.load.mockResolvedValue(null);

    await expect(
      handler.execute(new RenameAccountCommand('missing', 'Assets:Bank'), ctx),
    ).rejects.toBeInstanceOf(AccountNotFoundException);
  });

  it('still lets the aggregate protect a system account (INV-13)', async () => {
    const { handler, accounts } = setup(['Equity:Adjustments']);
    accounts.load.mockResolvedValue(anAccount('Equity:Adjustments', true));

    await expect(
      handler.execute(new RenameAccountCommand('acc-1', 'Equity:Renamed'), ctx),
    ).rejects.toBeInstanceOf(SystemAccountProtectedException);
  });
});
