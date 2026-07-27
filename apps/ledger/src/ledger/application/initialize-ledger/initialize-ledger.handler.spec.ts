import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { Clock, IdGenerator } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { AccountRepository } from '../../../accounts/application/account.repository';
import { LedgerAlreadyInitializedException } from '../../domain/settings/exceptions/ledger.exception';
import { LedgerSettings } from '../../domain/settings/ledger-settings.aggregate';
import { LedgerSettingsRepository } from '../ledger-settings.repository';
import { InitializeLedgerCommand } from './initialize-ledger.command';
import { InitializeLedgerHandler } from './initialize-ledger.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'init-ref' };

/**
 * Stands in for the event store's transactional scope: records what each save
 * appended and undoes it when the scope fails, the way both real adapters do
 * (their rollback semantics are fixed by the event store contract).
 */
class TransactionScope {
  readonly appended: string[] = [];
  scopes = 0;

  async withTransaction<T>(work: () => Promise<T>): Promise<T> {
    this.scopes += 1;
    const snapshot = [...this.appended];

    try {
      return await work();
    } catch (error) {
      this.appended.length = 0;
      this.appended.push(...snapshot);

      throw error;
    }
  }
}

function setup() {
  const scope = new TransactionScope();

  const settings = {
    load: jest.fn(),
    save: jest.fn(),
  } as unknown as jest.Mocked<LedgerSettingsRepository>;

  const accounts = {
    save: jest.fn(),
  } as unknown as jest.Mocked<AccountRepository>;

  const idGenerator: jest.Mocked<IdGenerator> = { next: jest.fn().mockReturnValue('gen-1') };
  const clock: jest.Mocked<Clock> = { now: jest.fn().mockReturnValue(new Date('2026-07-22T12:00:00.000Z')) };
  const dispatcher: jest.Mocked<ProjectionDispatcher> = { dispatch: jest.fn().mockResolvedValue(undefined) };

  const handler = new InitializeLedgerHandler(
    settings,
    accounts,
    idGenerator,
    clock,
    dispatcher,
    scope as unknown as EventStore,
  );

  return { handler, settings, accounts, dispatcher, scope };
}

/** Makes a repository double append to the scope, so a rollback is observable. */
function appending(scope: TransactionScope, label: string) {
  return async (): Promise<{ events: never[]; version: number; lastPosition: bigint }> => {
    scope.appended.push(label);

    return { events: [], version: 1, lastPosition: 1n };
  };
}

describe('InitializeLedgerHandler', () => {
  it('should create two system accounts and return userId (AC-5)', async () => {
    const { handler, settings, accounts, dispatcher } = setup();
    settings.load.mockResolvedValue(null);
    accounts.save.mockResolvedValue({ events: [], version: 1, lastPosition: 3n });
    settings.save.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

    const result = await handler.execute(
      new InitializeLedgerCommand('COP', 'America/Bogota'),
      ctx,
    );

    expect(result.aggregateId).toBe('user-1');
    expect(result.idempotentReplay).toBe(false);
    expect(accounts.save).toHaveBeenCalledTimes(2);
    expect(settings.save).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(settings.save.mock.calls[0][0].isInitialized).toBe(true);
  });

  it('should reject re-initialization with LEDGER_ALREADY_INITIALIZED (AC-5)', async () => {
    const { handler, settings } = setup();
    const existing = { isInitialized: true } as LedgerSettings;
    settings.load.mockResolvedValue(existing);

    await expect(
      handler.execute(new InitializeLedgerCommand('USD', 'America/New_York'), {
        ...ctx,
        externalRef: 'different-ref',
      }),
    ).rejects.toBeInstanceOf(LedgerAlreadyInitializedException);
  });

  it('should save system accounts without externalRef (AC-5)', async () => {
    const { handler, settings, accounts } = setup();
    settings.load.mockResolvedValue(null);
    accounts.save.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });
    settings.save.mockResolvedValue({ events: [], version: 1, lastPosition: 1n });

    await handler.execute(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx);

    expect(accounts.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ externalRef: null }),
    );
  });

  it('writes the three streams inside a single transactional scope (INV-7)', async () => {
    const { handler, settings, accounts, scope } = setup();
    settings.load.mockResolvedValue(null);
    settings.save.mockImplementation(appending(scope, 'LedgerInitialized'));
    accounts.save.mockImplementation(appending(scope, 'AccountOpened'));

    await handler.execute(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx);

    expect(scope.scopes).toBe(1);
    expect(scope.appended).toEqual(['LedgerInitialized', 'AccountOpened', 'AccountOpened']);
  });

  it('rolls the settings back when a system account fails to append (INV-13)', async () => {
    const { handler, settings, accounts, scope } = setup();
    settings.load.mockResolvedValue(null);
    settings.save.mockImplementation(appending(scope, 'LedgerInitialized'));
    accounts.save
      .mockImplementationOnce(appending(scope, 'AccountOpened'))
      .mockRejectedValueOnce(new Error('append failed'));

    await expect(
      handler.execute(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx),
    ).rejects.toThrow('append failed');

    // Nothing survives: no settings without their technical accounts, and no
    // technical account without the settings that name it.
    expect(scope.appended).toEqual([]);
  });
});
