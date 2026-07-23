import { InitializeLedgerCommand, LedgerSettingsQuery } from '@ledger/accounts/application/ep1-contracts.assumed';
import { CommandBus, CommandResult, QueryBus } from '@ledger/shared/application/ep1-contracts.assumed';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { LedgerController } from './ledger.controller';

describe('LedgerController', () => {
  const context: LedgerContext = { userId: 'user-1', clientId: 'frontend' };
  const result: CommandResult = { aggregateId: 'ledger-1', sequence: 1, streamPosition: 1, idempotentReplay: false };

  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;
  let controller: LedgerController;

  beforeEach(() => {
    commandBus = { dispatch: jest.fn().mockResolvedValue(result) } as unknown as jest.Mocked<CommandBus>;
    queryBus = { ask: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    controller = new LedgerController(commandBus, queryBus);
  });

  it('dispatches InitializeLedgerCommand built from body, context and external_ref', async () => {
    await controller.initialize(context, 'ref-init', {
      presentationCurrency: 'COP',
      timezone: 'America/Bogota',
    });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(InitializeLedgerCommand);
    expect(command).toMatchObject({
      userId: 'user-1',
      clientId: 'frontend',
      externalRef: 'ref-init',
      presentationCurrency: 'COP',
      timezone: 'America/Bogota',
    });
  });

  it('asks the settings projection scoped to the context user', async () => {
    const settings = { presentationCurrency: 'COP', timezone: 'America/Bogota', isInitialized: true };
    queryBus.ask.mockResolvedValue(settings);

    const returned = await controller.settings(context);

    const [query] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(LedgerSettingsQuery);
    expect(query).toMatchObject({ userId: 'user-1' });
    expect(returned).toBe(settings);
  });
});
