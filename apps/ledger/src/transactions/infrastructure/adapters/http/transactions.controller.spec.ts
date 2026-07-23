import { CommandBus, CommandResult, QueryBus } from '@ledger/shared/application/ep1-contracts.assumed';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { TransactionStatus } from '@ledger/shared/domain/ep1-contracts.assumed';
import {
  AmendPendingTransactionCommand,
  AnnotateTransactionCommand,
  ConfirmTransactionCommand,
  RecordTransactionCommand,
  ReverseConfirmedTransactionCommand,
  TransactionByIdQuery,
  TransactionListQuery,
  VoidPendingTransactionCommand,
} from '@ledger/transactions/application/ep1-contracts.assumed';
import { TransactionsController } from './transactions.controller';

describe('TransactionsController', () => {
  const context: LedgerContext = { userId: 'user-1', clientId: 'mail-system' };
  const result: CommandResult = { aggregateId: 'tx-1', sequence: 1, streamPosition: 5, idempotentReplay: false };

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

  it('dispatches RecordTransactionCommand with postings, status and external_ref', async () => {
    await controller.record(context, 'ref-tx', {
      date: '2026-07-20',
      description: 'Netflix',
      status: TransactionStatus.PENDING,
      postings,
    });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(RecordTransactionCommand);
    expect(command).toMatchObject({
      userId: 'user-1',
      clientId: 'mail-system',
      externalRef: 'ref-tx',
      date: '2026-07-20',
      description: 'Netflix',
      status: TransactionStatus.PENDING,
      payee: null,
      postings: [
        { accountId: 'acc-1', amount: '-31900', currency: 'COP', metadata: null },
        { accountId: 'acc-2', amount: '31900', currency: 'COP', metadata: null },
      ],
    });
  });

  it('dispatches ConfirmTransactionCommand with the path id', async () => {
    await controller.confirm(context, null, 'tx-9', {});

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(ConfirmTransactionCommand);
    expect(command).toMatchObject({ transactionId: 'tx-9', postings: null });
  });

  it('dispatches AmendPendingTransactionCommand', async () => {
    await controller.amend(context, null, 'tx-3', { date: '2026-07-21' });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(AmendPendingTransactionCommand);
    expect(command).toMatchObject({ transactionId: 'tx-3', date: '2026-07-21', postings: null });
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
    const reversal: CommandResult = { aggregateId: 'tx-rev', sequence: 1, streamPosition: 8, idempotentReplay: false };
    commandBus.dispatch.mockResolvedValue(reversal);

    const returned = await controller.reverse(context, null, 'tx-6', { reason: 'refund' });

    const [command] = commandBus.dispatch.mock.calls[0];
    expect(command).toBeInstanceOf(ReverseConfirmedTransactionCommand);
    expect(command).toMatchObject({ transactionId: 'tx-6', reason: 'refund' });
    expect(returned).toBe(reversal);
  });

  it('forwards filters and pagination to TransactionListQuery', async () => {
    queryBus.ask.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });

    await controller.list(context, { payee: 'Netflix', status: TransactionStatus.PENDING, limit: 25, offset: 50 });

    const [query] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(TransactionListQuery);
    expect(query).toMatchObject({
      userId: 'user-1',
      filters: expect.objectContaining({
        payee: 'Netflix',
        status: TransactionStatus.PENDING,
        limit: 25,
        offset: 50,
        accountId: null,
      }),
    });
  });

  it('asks TransactionByIdQuery for a single transaction', async () => {
    queryBus.ask.mockResolvedValue({});

    await controller.getOne(context, 'tx-77');

    const [query] = queryBus.ask.mock.calls[0];
    expect(query).toBeInstanceOf(TransactionByIdQuery);
    expect(query).toMatchObject({ userId: 'user-1', transactionId: 'tx-77' });
  });
});
