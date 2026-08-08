import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { AmendPendingTransactionCommand } from '@ledger/transactions/application/usecases/amend-transaction/amend-pending-transaction.command';
import { AnnotateTransactionCommand } from '@ledger/transactions/application/usecases/annotate-transaction/annotate-transaction.command';
import { ConfirmTransactionCommand } from '@ledger/transactions/application/usecases/confirm-transaction/confirm-transaction.command';
import { GetTransactionByIdQuery } from '@ledger/transactions/application/usecases/get-transaction-by-id/get-transaction-by-id.query';
import { ListTransactionsQuery } from '@ledger/transactions/application/usecases/list-transactions/list-transactions.query';
import { RecordTransactionCommand } from '@ledger/transactions/application/usecases/record-transaction/record-transaction.command';
import { ReverseConfirmedTransactionCommand } from '@ledger/transactions/application/usecases/reverse-transaction/reverse-confirmed-transaction.command';
import { VoidPendingTransactionCommand } from '@ledger/transactions/application/usecases/void-transaction/void-pending-transaction.command';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { TransactionsController } from './transactions.controller';

describe('TransactionsController', () => {
  const context: LedgerContext = { userId: 'user-1', clientId: 'mail-system' };
  const result: CommandResult = { aggregateId: 'tx-1', streamPosition: 5n, idempotentReplay: false };

  const postings = [
    { accountId: 'acc-1', amount: '-31900', currency: 'COP' },
    { accountId: 'acc-2', amount: '31900', currency: 'COP' },
  ];

  let commandBus: jest.Mocked<CommandBus>;
  let queryBus: jest.Mocked<QueryBus>;
  let controller: TransactionsController;

  beforeEach(() => {
    commandBus = { dispatch: jest.fn().mockResolvedValue(result) } as unknown as jest.Mocked<CommandBus>;
    queryBus = { ask: jest.fn() } as unknown as jest.Mocked<QueryBus>;
    controller = new TransactionsController(commandBus, queryBus);
  });

  it('dispatches RecordTransactionCommand with postings, status and the context carried separately', async () => {
    await controller.record(context, 'ref-tx', {
      date: '2026-07-20',
      description: 'Netflix',
      status: TransactionStatus.PENDING,
      postings,
    });

    const [command, ctx] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(RecordTransactionCommand);
    expect(command).toMatchObject({
      date: '2026-07-20',
      description: 'Netflix',
      initialStatus: TransactionStatus.PENDING,
      payee: null,
      postings: [
        { accountId: 'acc-1', amount: '-31900', currency: 'COP' },
        { accountId: 'acc-2', amount: '31900', currency: 'COP' },
      ],
    });
    expect(ctx).toEqual({ userId: 'user-1', clientId: 'mail-system', externalRef: 'ref-tx' });
  });

  it('dispatches ConfirmTransactionCommand with the path id', async () => {
    await controller.confirm(context, null, 'tx-9', {});

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(ConfirmTransactionCommand);
    expect(command).toMatchObject({ transactionId: 'tx-9' });
  });

  it('dispatches AmendPendingTransactionCommand with the replacement postings and date', async () => {
    await controller.amend(context, null, 'tx-3', {
      date: '2026-07-21',
      postings: [
        { accountId: 'acc-1', amount: '-4500', currency: 'COP' },
        { accountId: 'acc-2', amount: '4500', currency: 'COP' },
      ],
    });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(AmendPendingTransactionCommand);
    expect(command).toMatchObject({ transactionId: 'tx-3', date: '2026-07-21' });
    expect(command).toMatchObject({ postings: [expect.anything(), expect.anything()] });
  });

  it('dispatches AnnotateTransactionCommand', async () => {
    await controller.annotate(context, null, 'tx-4', { payee: 'Spotify' });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(AnnotateTransactionCommand);
    expect(command).toMatchObject({ transactionId: 'tx-4', payee: 'Spotify' });
  });

  it('dispatches VoidPendingTransactionCommand with the reason', async () => {
    await controller.void(context, null, 'tx-5', { reason: 'duplicate' });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(VoidPendingTransactionCommand);
    expect(command).toMatchObject({ transactionId: 'tx-5', reason: 'duplicate' });
  });

  it('dispatches ReverseConfirmedTransactionCommand and returns the reversal result', async () => {
    const reversal: CommandResult = { aggregateId: 'tx-rev', streamPosition: 8n, idempotentReplay: false };
    commandBus.dispatch.mockResolvedValue(reversal);

    const returned = await controller.reverse(context, null, 'tx-6', { reason: 'refund' });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(ReverseConfirmedTransactionCommand);
    expect(command).toMatchObject({ transactionId: 'tx-6' });
    expect(returned).toBe(reversal);
  });

  it('forwards filters to ListTransactionsQuery, scoped to the context user', async () => {
    queryBus.ask.mockResolvedValue({ items: [], total: 0 });

    await controller.list(context, { payee: 'Netflix', status: TransactionStatus.PENDING, limit: 25 });

    const [query, ctx] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(ListTransactionsQuery);
    expect(query).toMatchObject({
      payee: 'Netflix',
      status: TransactionStatus.PENDING,
      limit: 25,
      accountId: null,
    });
    expect(ctx).toEqual({ userId: 'user-1' });
  });

  it('asks GetTransactionByIdQuery for a single transaction', async () => {
    queryBus.ask.mockResolvedValue({});

    await controller.getOne(context, 'tx-77');

    const [query, ctx] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(GetTransactionByIdQuery);
    expect(query).toMatchObject({ transactionId: 'tx-77' });
    expect(ctx).toEqual({ userId: 'user-1' });
  });
});
