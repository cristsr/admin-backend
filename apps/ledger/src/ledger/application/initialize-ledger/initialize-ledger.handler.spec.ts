import { AccountRepository } from '../../../accounts/application/account.repository';
import { Clock, IdGenerator } from '../../../shared/domain/ports';
import { AuthContext } from '../../../shared-kernel/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '../../../shared-kernel/application/projection/projection-dispatcher';
import { LedgerAlreadyInitializedException } from '../../domain/settings/exceptions/ledger.exception';
import { LedgerSettings } from '../../domain/settings/ledger-settings.aggregate';
import { LedgerSettingsRepository } from '../ledger-settings.repository';
import { InitializeLedgerCommand } from './initialize-ledger.command';
import { InitializeLedgerHandler } from './initialize-ledger.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'init-ref' };

function setup() {
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

  const handler = new InitializeLedgerHandler(settings, accounts, idGenerator, clock, dispatcher);

  return { handler, settings, accounts, dispatcher };
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
});
