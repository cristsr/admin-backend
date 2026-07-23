import { CloseAccountCommand } from '@ledger/accounts/application/close-account/close-account.command';
import { OpenAccountCommand } from '@ledger/accounts/application/open-account/open-account.command';
import { RenameAccountCommand } from '@ledger/accounts/application/rename-account/rename-account.command';
import { GetAccountBalancesQuery } from '@ledger/read-side/get-account-balances/get-account-balances.query';
import { GetAccountByIdQuery } from '@ledger/read-side/get-account-by-id/get-account-by-id.query';
import { GetAccountTreeQuery } from '@ledger/read-side/get-account-tree/get-account-tree.query';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { QueryBus } from '@ledger/shared-kernel/application/query-bus/query-bus';
import { AccountType } from '@ledger/shared-kernel/domain/value-objects';
import { AccountsController } from './accounts.controller';
import { AccountTreeView } from './dto/account-tree-view';

describe('AccountsController', () => {
  const context: LedgerContext = { userId: 'user-1', clientId: 'frontend' };
  const result: CommandResult = { aggregateId: 'acc-1', streamPosition: 10n, idempotentReplay: false };

  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;
  let controller: AccountsController;

  beforeEach(() => {
    commandBus = { dispatch: jest.fn().mockResolvedValue(result) } as unknown as jest.Mocked<CommandBus>;
    queryBus = { ask: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    controller = new AccountsController(commandBus, queryBus);
  });

  it('dispatches OpenAccountCommand built from the body, with the context carried separately', async () => {
    await controller.open(context, 'ref-1', {
      type: AccountType.ASSETS,
      name: 'Assets:Bank',
      currencies: ['COP'],
      openedOn: '2026-07-20',
      isBankMirror: true,
    });

    const [command, ctx] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(OpenAccountCommand);
    expect(command).toMatchObject({
      name: 'Assets:Bank',
      currencies: ['COP'],
      openedOn: '2026-07-20',
      isBankMirror: true,
    });
    expect(ctx).toEqual({ userId: 'user-1', clientId: 'frontend', externalRef: 'ref-1' });
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

  it('asks GetAccountTreeQuery scoped to the context user and returns the projection unchanged', async () => {
    const tree = { accounts: [] };
    queryBus.ask.mockResolvedValue(tree);

    const returned = await controller.list(context, { view: AccountTreeView.FLAT });

    const [query, ctx] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(GetAccountTreeQuery);
    expect(ctx).toEqual({ userId: 'user-1' });
    expect(returned).toBe(tree);
  });

  it('asks GetAccountByIdQuery for a single account', async () => {
    queryBus.ask.mockResolvedValue({});

    await controller.getOne(context, 'acc-9');

    const [query, ctx] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(GetAccountByIdQuery);
    expect(query).toMatchObject({ accountId: 'acc-9' });
    expect(ctx).toEqual({ userId: 'user-1' });
  });

  it('asks GetAccountBalancesQuery for the account', async () => {
    queryBus.ask.mockResolvedValue([]);

    await controller.balance(context, 'acc-3', { currency: 'COP' });

    const [query] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(GetAccountBalancesQuery);
    expect(query).toMatchObject({ accountId: 'acc-3' });
  });

  it('never touches an event store or repository (only buses are injected)', () => {
    expect(controller).toBeInstanceOf(AccountsController);
    expect(AccountsController.length).toBe(2);
  });
});
