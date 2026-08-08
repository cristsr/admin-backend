import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { AccountNameReader } from '@ledger/accounts/application/ports/account-name-reader.port';
import { IdGenerator } from '@cqrs/domain/ports';
import { AccountRepository } from '@ledger/accounts/application/repositories/account.repository';
import { AccountNameRegistry } from '@ledger/accounts/application/services/account-name.registry';
import { NameCollisionException } from '@ledger/accounts/domain/account/exceptions/account.exception';
import { OpenAccountCommand } from './open-account.command';
import { OpenAccountHandler } from './open-account.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

function setup() {
  const accounts = {
    save: jest.fn(),
  } as unknown as jest.Mocked<AccountRepository>;

  // Nothing is taken, so every name this handler claims is free.
  const names = {
    isTaken: jest.fn().mockResolvedValue(false),
    namesOf: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<AccountNameReader>;

  const idGenerator: jest.Mocked<IdGenerator> = { next: jest.fn().mockReturnValue('gen-1') };
  const dispatcher: jest.Mocked<ProjectionDispatcher> = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const handler = new OpenAccountHandler(
    accounts,
    new AccountNameRegistry(names),
    idGenerator,
    dispatcher,
  );

  return { handler, accounts, names, dispatcher };
}

describe('OpenAccountHandler', () => {
  it('should open a new account and return its id', async () => {
    const { handler, accounts, names } = setup();
    names.isTaken.mockResolvedValue(false);
    const savedAccount = { id: 'account-1', pullChanges: () => [] } as any;
    (savedAccount as any).id = 'account-1';
    accounts.save.mockResolvedValue({ events: [], version: 1, lastPosition: 5n });

    const result = await handler.execute(
      new OpenAccountCommand('Assets:Bank:Savings', ['COP'], '2026-01-01', false),
      ctx,
    );

    expect(result.aggregateId).toBeTruthy();
    expect(result.idempotentReplay).toBe(false);
    expect(names.isTaken).toHaveBeenCalledTimes(1);
    expect(accounts.save).toHaveBeenCalledTimes(1);
  });

  it('should reject a duplicate name with NAME_COLLISION', async () => {
    const { handler, names } = setup();
    names.isTaken.mockResolvedValue(true);

    await expect(
      handler.execute(new OpenAccountCommand('Assets:Duplicate', ['COP'], '2026-01-01', false), ctx),
    ).rejects.toBeInstanceOf(NameCollisionException);
  });

  it('should allow same name for different users (rules Art. 5)', async () => {
    const { handler, accounts, names } = setup();
    names.isTaken.mockResolvedValue(false);
    accounts.save.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

    await handler.execute(
      new OpenAccountCommand('Assets:Checking', ['COP'], '2026-01-01', false),
      ctx,
    );
    await handler.execute(
      new OpenAccountCommand('Assets:Checking', ['COP'], '2026-01-01', false),
      { ...ctx, userId: 'user-2' },
    );
  });

  it('should dispatch events after save', async () => {
    const { handler, accounts, names, dispatcher } = setup();
    names.isTaken.mockResolvedValue(false);
    accounts.save.mockResolvedValue({ events: ['ev-1', 'ev-2'] as any, version: 1, lastPosition: 2n });
    dispatcher.dispatch.mockResolvedValue(undefined);

    await handler.execute(
      new OpenAccountCommand('Assets:Events', ['COP'], '2026-01-01', false),
      ctx,
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(['ev-1', 'ev-2']);
  });
});
