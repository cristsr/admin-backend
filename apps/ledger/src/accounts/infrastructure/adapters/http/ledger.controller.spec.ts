import { InitializeLedgerCommand } from '@ledger/ledger/application/initialize-ledger/initialize-ledger.command';
import { GetLedgerSettingsQuery } from '@ledger/read-side/get-ledger-settings/get-ledger-settings.query';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { QueryBus } from '@ledger/shared-kernel/application/query-bus/query-bus';
import { LedgerController } from './ledger.controller';

describe('LedgerController', () => {
  const context: LedgerContext = { userId: 'user-1', clientId: 'frontend' };
  const result: CommandResult = { aggregateId: 'ledger-1', streamPosition: 1n, idempotentReplay: false };

  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;
  let controller: LedgerController;

  beforeEach(() => {
    commandBus = { dispatch: jest.fn().mockResolvedValue(result) } as unknown as jest.Mocked<CommandBus>;
    queryBus = { ask: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    controller = new LedgerController(commandBus, queryBus);
  });

  it('dispatches InitializeLedgerCommand with the context carried separately', async () => {
    await controller.initialize(context, 'ref-init', {
      presentationCurrency: 'COP',
      timezone: 'America/Bogota',
    });

    const [command, ctx] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(InitializeLedgerCommand);
    expect(command).toMatchObject({ presentationCurrency: 'COP', timezone: 'America/Bogota' });
    expect(ctx).toEqual({ userId: 'user-1', clientId: 'frontend', externalRef: 'ref-init' });
  });

  it('asks GetLedgerSettingsQuery scoped to the context user', async () => {
    const settings = { presentationCurrency: 'COP', timezone: 'America/Bogota', isInitialized: true };
    queryBus.ask.mockResolvedValue(settings);

    const returned = await controller.settings(context);

    const [query, ctx] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(GetLedgerSettingsQuery);
    expect(ctx).toEqual({ userId: 'user-1' });
    expect(returned).toBe(settings);
  });
});
