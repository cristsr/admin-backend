import {
  AccountBalancesQuery,
  AccountByIdQuery,
  AccountTreeQuery,
  AccountTreeView,
  CloseAccountCommand,
  OpenAccountCommand,
  RenameAccountCommand,
} from '@ledger/accounts/application/ep1-contracts.assumed';
import { CommandBus, CommandResult, QueryBus } from '@ledger/shared/application/ep1-contracts.assumed';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { AccountType } from '@ledger/shared/domain/ep1-contracts.assumed';
import { AccountsController } from './accounts.controller';

describe('AccountsController', () => {
  const context: LedgerContext = { userId: 'user-1', clientId: 'frontend' };
  const result: CommandResult = { aggregateId: 'acc-1', sequence: 1, streamPosition: 10, idempotentReplay: false };

  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;
  let controller: AccountsController;

  beforeEach(() => {
    commandBus = { dispatch: jest.fn().mockResolvedValue(result) } as unknown as jest.Mocked<CommandBus>;
    queryBus = { ask: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    controller = new AccountsController(commandBus, queryBus);
  });

  it('dispatches OpenAccountCommand built from body, context and external_ref', async () => {
    await controller.open(context, 'ref-1', {
      type: AccountType.ASSETS,
      name: 'Assets:Bank',
      currencies: ['COP'],
      openedOn: '2026-07-20',
      isBankMirror: true,
    });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(OpenAccountCommand);
    expect(command).toMatchObject({
      userId: 'user-1',
      clientId: 'frontend',
      externalRef: 'ref-1',
      type: AccountType.ASSETS,
      name: 'Assets:Bank',
      parentId: null,
      currencies: ['COP'],
      openedOn: '2026-07-20',
      isBankMirror: true,
    });
  });

  it('returns the raw command result (mapped to CommandAcceptedDto by the interceptor)', async () => {
    const returned = await controller.open(context, null, {
      type: AccountType.EXPENSES,
      name: 'Expenses:Food',
      currencies: ['COP'],
      openedOn: '2026-07-20',
      isBankMirror: false,
    });

    expect(returned).toBe(result);
  });

  it('dispatches RenameAccountCommand carrying the path id', async () => {
    await controller.rename(context, null, 'acc-42', { newName: 'Assets:NewName' });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(RenameAccountCommand);
    expect(command).toMatchObject({ accountId: 'acc-42', newName: 'Assets:NewName' });
  });

  it('dispatches CloseAccountCommand carrying the path id', async () => {
    await controller.close(context, null, 'acc-7', { closedOn: '2026-07-20' });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(CloseAccountCommand);
    expect(command).toMatchObject({ accountId: 'acc-7', closedOn: '2026-07-20' });
  });

  it('asks AccountTreeQuery scoped to the context user and returns the projection unchanged', async () => {
    const tree = { view: AccountTreeView.FLAT, accounts: [] };
    queryBus.ask.mockResolvedValue(tree);

    const returned = await controller.list(context, { view: AccountTreeView.FLAT });

    const [query] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(AccountTreeQuery);
    expect(query).toMatchObject({ userId: 'user-1', view: AccountTreeView.FLAT });
    expect(returned).toBe(tree);
  });

  it('defaults the tree view to TREE when omitted', async () => {
    queryBus.ask.mockResolvedValue({ view: AccountTreeView.TREE, accounts: [] });

    await controller.list(context, {});

    expect(queryBus.ask.mock.calls[0][0]).toMatchObject({ view: AccountTreeView.TREE });
  });

  it('asks AccountByIdQuery for a single account', async () => {
    queryBus.ask.mockResolvedValue({});

    await controller.getOne(context, 'acc-9');

    const [query] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(AccountByIdQuery);
    expect(query).toMatchObject({ userId: 'user-1', accountId: 'acc-9' });
  });

  it('asks AccountBalancesQuery with the optional currency', async () => {
    queryBus.ask.mockResolvedValue([]);

    await controller.balance(context, 'acc-3', { currency: 'COP' });

    const [query] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(AccountBalancesQuery);
    expect(query).toMatchObject({ userId: 'user-1', accountId: 'acc-3', currency: 'COP' });
  });

  it('never touches an event store or repository (only buses are injected)', () => {
    expect(controller).toBeInstanceOf(AccountsController);
    // The constructor takes exactly the two buses — no infrastructure ports.
    expect(AccountsController.length).toBe(2);
  });
});
