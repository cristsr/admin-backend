import { IdGenerator } from '../../../shared/domain/ports';
import { AuthContext } from '../../../shared-kernel/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '../../../shared-kernel/application/projection/projection-dispatcher';
import { ReadModelStore } from '../../../shared-kernel/application/projection/read-model-store';
import { NameCollisionException } from '../../domain/account/exceptions/account.exception';
import { AccountNameRegistry } from '../account-name.registry';
import { AccountRepository } from '../account.repository';
import { OpenAccountCommand } from './open-account.command';
import { OpenAccountHandler } from './open-account.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: null };

function setup() {
  const accounts = {
    save: jest.fn(),
  } as unknown as jest.Mocked<AccountRepository>;

  const readModel = {
    query: jest.fn(),
  } as unknown as jest.Mocked<ReadModelStore>;

  const idGenerator: jest.Mocked<IdGenerator> = { next: jest.fn().mockReturnValue('gen-1') };
  const dispatcher: jest.Mocked<ProjectionDispatcher> = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const handler = new OpenAccountHandler(
    accounts,
    new AccountNameRegistry(readModel),
    idGenerator,
    dispatcher,
  );

  return { handler, accounts, readModel, dispatcher };
}

describe('OpenAccountHandler', () => {
  it('should open a new account and return its id (AC-6)', async () => {
    const { handler, accounts, readModel } = setup();
    readModel.query.mockResolvedValue([]);
    const savedAccount = { id: 'account-1', pullChanges: () => [] } as any;
    (savedAccount as any).id = 'account-1';
    accounts.save.mockResolvedValue({ events: [], version: 1, lastPosition: 5n });

    const result = await handler.execute(
      new OpenAccountCommand('Assets:Bank:Savings', ['COP'], '2026-01-01', false),
      ctx,
    );

    expect(result.aggregateId).toBeTruthy();
    expect(result.idempotentReplay).toBe(false);
    expect(readModel.query).toHaveBeenCalledTimes(1);
    expect(accounts.save).toHaveBeenCalledTimes(1);
  });

  it('should reject a duplicate name with NAME_COLLISION (AC-6)', async () => {
    const { handler, readModel } = setup();
    readModel.query.mockResolvedValue([{ name: 'Assets:Duplicate' }]);

    await expect(
      handler.execute(new OpenAccountCommand('Assets:Duplicate', ['COP'], '2026-01-01', false), ctx),
    ).rejects.toBeInstanceOf(NameCollisionException);
  });

  it('should allow same name for different users (AC-6 / Art. 5)', async () => {
    const { handler, accounts, readModel } = setup();
    readModel.query.mockResolvedValue([]);
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

  it('should dispatch events after save (AC-6)', async () => {
    const { handler, accounts, readModel, dispatcher } = setup();
    readModel.query.mockResolvedValue([]);
    accounts.save.mockResolvedValue({ events: ['ev-1', 'ev-2'] as any, version: 1, lastPosition: 2n });
    dispatcher.dispatch.mockResolvedValue(undefined);

    await handler.execute(
      new OpenAccountCommand('Assets:Events', ['COP'], '2026-01-01', false),
      ctx,
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(['ev-1', 'ev-2']);
  });
});
