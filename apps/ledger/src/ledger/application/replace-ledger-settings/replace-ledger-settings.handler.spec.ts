import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { LedgerSettingsRepository } from '@ledger/ledger/application/ledger-settings.repository';
import { LedgerNotInitializedException } from '@ledger/shared/domain/errors/ledger.exception';
import { ReplaceLedgerSettingsCommand } from './replace-ledger-settings.command';
import { ReplaceLedgerSettingsHandler } from './replace-ledger-settings.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-1', externalRef: 'ref-1' };

/** A stand-in aggregate exposing what the handler touches. */
function aLedger(isInitialized = true) {
  return {
    isInitialized,
    changePresentationCurrency: jest.fn(),
    changeTimezone: jest.fn(),
  };
}

function setup() {
  const settings = { load: jest.fn(), save: jest.fn() } as unknown as jest.Mocked<
    LedgerSettingsRepository
  >;
  const dispatcher: jest.Mocked<ProjectionDispatcher> = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };

  settings.save.mockResolvedValue({ events: [], version: 2, lastPosition: 7n });

  return { handler: new ReplaceLedgerSettingsHandler(settings, dispatcher), settings, dispatcher };
}

describe('ReplaceLedgerSettingsHandler', () => {
  it('applies both changes and persists them once', async () => {
    const { handler, settings } = setup();
    const ledger = aLedger();
    settings.load.mockResolvedValue(ledger as never);

    await handler.execute(new ReplaceLedgerSettingsCommand('USD', 'America/Bogota'), ctx);

    expect(ledger.changePresentationCurrency).toHaveBeenCalledTimes(1);
    expect(ledger.changeTimezone).toHaveBeenCalledTimes(1);
    // One save means one append: both events share it, so no intermediate state
    // where the currency changed and the timezone did not.
    expect(settings.save).toHaveBeenCalledTimes(1);
  });

  it('returns the stream position so the caller can read its own write', async () => {
    const { handler, settings } = setup();
    settings.load.mockResolvedValue(aLedger() as never);

    const result = await handler.execute(
      new ReplaceLedgerSettingsCommand('USD', 'America/Bogota'),
      ctx,
    );

    expect(result.aggregateId).toBe('user-1');
    expect(result.streamPosition).toBe(7n);
  });

  it('dispatches the resulting events to the projections', async () => {
    const { handler, settings, dispatcher } = setup();
    settings.load.mockResolvedValue(aLedger() as never);

    await handler.execute(new ReplaceLedgerSettingsCommand('USD', 'America/Bogota'), ctx);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
  });

  it('rejects a ledger that was never initialized', async () => {
    const { handler, settings } = setup();
    settings.load.mockResolvedValue(null as never);

    await expect(
      handler.execute(new ReplaceLedgerSettingsCommand('USD', 'America/Bogota'), ctx),
    ).rejects.toBeInstanceOf(LedgerNotInitializedException);
  });

  it('rejects a ledger aggregate that exists but is not initialized', async () => {
    const { handler, settings } = setup();
    settings.load.mockResolvedValue(aLedger(false) as never);

    await expect(
      handler.execute(new ReplaceLedgerSettingsCommand('USD', 'America/Bogota'), ctx),
    ).rejects.toBeInstanceOf(LedgerNotInitializedException);
  });

  it('reports LEDGER_NOT_INITIALIZED, the code shared with reconciliation', async () => {
    const { handler, settings } = setup();
    settings.load.mockResolvedValue(null as never);

    await expect(
      handler.execute(new ReplaceLedgerSettingsCommand('USD', 'America/Bogota'), ctx),
    ).rejects.toMatchObject({ code: 'LEDGER_NOT_INITIALIZED' });
  });

  it('rejects an invalid ISO-4217 currency before touching the aggregate', async () => {
    const { handler, settings } = setup();
    settings.load.mockResolvedValue(aLedger() as never);

    await expect(
      handler.execute(new ReplaceLedgerSettingsCommand('nope', 'America/Bogota'), ctx),
    ).rejects.toBeDefined();
    expect(settings.save).not.toHaveBeenCalled();
  });

  it('rejects an invalid IANA timezone', async () => {
    const { handler, settings } = setup();
    settings.load.mockResolvedValue(aLedger() as never);

    await expect(
      handler.execute(new ReplaceLedgerSettingsCommand('USD', 'Mars/Olympus'), ctx),
    ).rejects.toBeDefined();
    expect(settings.save).not.toHaveBeenCalled();
  });
});
