import { AuthContext } from '@cqrs/application/command-bus/auth-context.type';
import { Command } from '@cqrs/application/command-bus/command';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ProjectionDispatcher } from '@cqrs/application/projection/projection-dispatcher';
import { StoredEvent } from '@cqrs/domain/event/stored-event.type';
import { Clock } from '@cqrs/domain/ports';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { OpenSystemAccountCommand } from '@ledger/accounts/application/usecases/open-system-account/open-system-account.command';
import { LedgerSettingsRepository } from '@ledger/ledger/application/repositories/ledger-settings.repository';
import { LedgerAlreadyInitializedException } from '@ledger/ledger/domain/settings/exceptions/ledger.exception';
import { LedgerSettings } from '@ledger/ledger/domain/settings/ledger-settings.aggregate';
import { InitializeLedgerCommand } from './initialize-ledger.command';
import { InitializeLedgerHandler } from './initialize-ledger.handler';

const ctx: AuthContext = { userId: 'user-1', clientId: 'client-x', externalRef: 'init-ref' };

/**
 * Stands in for the event store: records what each append added, undoes it when
 * the scope fails (the rollback both real adapters implement), and serves the
 * account streams back the way `load` does.
 */
class EventStoreDouble {
  readonly appended: string[] = [];
  readonly streams = new Map<string, StoredEvent[]>();
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

  async load({ aggregateId }: { aggregateId: string }): Promise<readonly StoredEvent[]> {
    return this.streams.get(aggregateId) ?? [];
  }
}

/** A bus double that runs no handler: it records the command and answers with an id. */
function busDouble(store: EventStoreDouble, order: string[]) {
  const dispatched: Command[] = [];
  let opened = 0;

  const bus = {
    dispatch: jest.fn(async (command: Command): Promise<CommandResult> => {
      dispatched.push(command);
      opened += 1;

      const aggregateId = `acc-${opened}`;
      store.appended.push('AccountOpened');
      order.push('AccountOpened');
      store.streams.set(aggregateId, [
        { eventType: 'AccountOpened', aggregateId } as unknown as StoredEvent,
      ]);

      return { aggregateId, streamPosition: BigInt(opened), idempotentReplay: false };
    }),
  } as unknown as jest.Mocked<CommandBus>;

  return { bus, dispatched };
}

function setup() {
  const store = new EventStoreDouble();
  const order: string[] = [];

  const settings = {
    load: jest.fn(),
    save: jest.fn(async () => {
      store.appended.push('LedgerInitialized');
      order.push('LedgerInitialized');

      return { events: [{ eventType: 'LedgerInitialized' } as unknown as StoredEvent], version: 1, lastPosition: 9n };
    }),
  } as unknown as jest.Mocked<LedgerSettingsRepository>;

  const { bus, dispatched } = busDouble(store, order);
  const clock: jest.Mocked<Clock> = {
    now: jest.fn().mockReturnValue(new Date('2026-07-22T12:00:00.000Z')),
  };
  const dispatcher: jest.Mocked<ProjectionDispatcher> = {
    dispatch: jest.fn(async (_events: readonly StoredEvent[]) => {
      order.push('projections');
    }),
  };

  const handler = new InitializeLedgerHandler(
    settings,
    bus,
    clock,
    dispatcher,
    store as unknown as EventStore,
  );

  return { handler, settings, bus, dispatched, dispatcher, store, order };
}

describe('InitializeLedgerHandler', () => {
  /**
   * The whole point of the refactor: `Account` belongs to `accounts`, so the two
   * technical accounts enter through that module's command instead of being
   * built here. A rule added to opening an account now reaches them too.
   */
  it('opens both technical accounts through the command bus', async () => {
    const { handler, settings, dispatched } = setup();
    settings.load.mockResolvedValue(null);

    await handler.execute(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx);

    expect(dispatched).toHaveLength(2);
    expect(dispatched.every((command) => command instanceof OpenSystemAccountCommand)).toBe(true);
    expect(dispatched.map((command) => (command as OpenSystemAccountCommand).name)).toEqual([
      'Equity:OpeningBalances',
      'Equity:Adjustments',
    ]);
  });

  /**
   * The two ids only exist after the bus ran, and `LedgerSettings` carries them
   * into `LedgerInitialized` rather than keeping them as state — so the claim is
   * checked where it is made, on the way in.
   */
  it('points the settings at the accounts the bus just opened', async () => {
    const { handler, settings } = setup();
    settings.load.mockResolvedValue(null);
    const initialize = jest.spyOn(LedgerSettings, 'initialize');

    const result = await handler.execute(
      new InitializeLedgerCommand('COP', 'America/Bogota'),
      ctx,
    );

    expect(result.aggregateId).toBe('user-1');
    expect(result.idempotentReplay).toBe(false);
    expect(settings.save.mock.calls[0][0].isInitialized).toBe(true);
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        presentationCurrency: 'COP',
        openingBalancesAccountId: 'acc-1',
        adjustmentsAccountId: 'acc-2',
      }),
    );

    initialize.mockRestore();
  });

  it('should reject re-initialization with LEDGER_ALREADY_INITIALIZED', async () => {
    const { handler, settings } = setup();
    settings.load.mockResolvedValue({ isInitialized: true } as LedgerSettings);

    await expect(
      handler.execute(new InitializeLedgerCommand('USD', 'America/New_York'), {
        ...ctx,
        externalRef: 'different-ref',
      }),
    ).rejects.toBeInstanceOf(LedgerAlreadyInitializedException);
  });

  it('should open the system accounts without externalRef', async () => {
    const { handler, settings, bus } = setup();
    settings.load.mockResolvedValue(null);

    await handler.execute(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx);

    expect(bus.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ externalRef: null }),
    );
  });

  /**
   * INV-7. The order inside the scope flipped with the refactor — the accounts
   * commit first now, because their ids only exist once the command that opens
   * them has run — but the guarantee is unchanged: one scope, three appends.
   */
  it('writes the three streams inside a single transactional scope (INV-7)', async () => {
    const { handler, settings, store } = setup();
    settings.load.mockResolvedValue(null);

    await handler.execute(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx);

    expect(store.scopes).toBe(1);
    expect(store.appended).toEqual(['AccountOpened', 'AccountOpened', 'LedgerInitialized']);
  });

  it('rolls the accounts back when the settings fail to append (INV-13)', async () => {
    const { handler, settings, store } = setup();
    settings.load.mockResolvedValue(null);
    settings.save.mockRejectedValueOnce(new Error('append failed'));

    await expect(
      handler.execute(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx),
    ).rejects.toThrow('append failed');

    // Nothing survives: no settings without their technical accounts, and no
    // technical account without the settings that name it.
    expect(store.appended).toEqual([]);
  });

  /**
   * The bus answers with ids and never events (rules Art. 10), so the accounts'
   * events have to be read back or the projection dispatch silently ships only
   * the settings event — leaving `proj_accounts` with no system accounts and
   * nothing reporting it.
   */
  it('dispatches the account events along with the settings event', async () => {
    const { handler, settings, dispatcher } = setup();
    settings.load.mockResolvedValue(null);

    await handler.execute(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    expect(dispatcher.dispatch.mock.calls[0][0].map((event) => event.eventType)).toEqual([
      'AccountOpened',
      'AccountOpened',
      'LedgerInitialized',
    ]);
  });

  /** A failing projector must not roll back facts that already committed. */
  it('dispatches projections after the scope closes, not inside it', async () => {
    const { handler, settings, order } = setup();
    settings.load.mockResolvedValue(null);

    await handler.execute(new InitializeLedgerCommand('COP', 'America/Bogota'), ctx);

    expect(order[order.length - 1]).toBe('projections');
  });
});
