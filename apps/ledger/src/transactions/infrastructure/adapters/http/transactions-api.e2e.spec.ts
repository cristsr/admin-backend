import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CommandBus } from '@cqrs/application/command-bus/command-bus';
import { CommandResult } from '@cqrs/application/command-bus/command-result.type';
import { ReadModelStore } from '@cqrs/application/projection/read-model-store';
import { QueryBus } from '@cqrs/application/query-bus/query-bus';
import { EventStore } from '@cqrs/domain/ports/event-store';
import { ExceptionFilter } from '@shared';
import request from 'supertest';
import { LedgerCoreModule } from '@ledger/ledger/ledger-core.module';
import { STREAM_POSITION_HEADER, SharedHttpModule } from '@ledger/shared/infrastructure/adapters/http';
import { GATEWAY_CONTEXT_HEADER } from '@ledger/shared/infrastructure/adapters/http/resolvers/gateway-header-context.resolver';
import { UnbalancedTransactionException } from '@ledger/transactions/domain/transaction/exceptions/transaction.exception';
import { TransactionStatus } from '@ledger/transactions/domain/transaction/transaction-status';
import { TransactionsHttpModule } from './transactions-http.module';

/**
 * End-to-end HTTP behaviour of the transactions adapter with the real buses
 * mocked: versioning, the global context guard, DTO validation, the
 * stable error mapping, read-your-writes headers and `external_ref`
 * idempotency — everything the driving adapter owns.
 */
describe('Transactions API (e2e, buses mocked)', () => {
  let app: INestApplication;
  const dispatch = jest.fn();
  const ask = jest.fn();

  const withContext = (req: request.Test): request.Test =>
    req.set(GATEWAY_CONTEXT_HEADER.userId, 'user-1').set(GATEWAY_CONTEXT_HEADER.clientId, 'mail-system');

  const validBody = {
    date: '2026-07-20',
    description: 'Netflix',
    status: TransactionStatus.PENDING,
    postings: [
      { accountId: '11111111-1111-4111-8111-111111111111', amount: '-31900', currency: 'COP' },
      { accountId: '22222222-2222-4222-8222-222222222222', amount: '31900', currency: 'COP' },
    ],
  };

  const accepted: CommandResult = { aggregateId: 'tx-1', streamPosition: 42n, idempotentReplay: false };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LedgerCoreModule, SharedHttpModule, TransactionsHttpModule],
    })
      .overrideProvider(EventStore)
      .useValue({})
      .overrideProvider(ReadModelStore)
      .useValue({})
      .overrideProvider(CommandBus)
      .useValue({ dispatch })
      .overrideProvider(QueryBus)
      .useValue({ ask })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ transform: true, forbidUnknownValues: false }));
    app.useGlobalFilters(new ExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    dispatch.mockReset();
    ask.mockReset();
  });

  it('rejects a request without context headers with 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/transactions').send(validBody).expect(401);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('records a transaction under /api/v1 and returns 201 with the stream position', async () => {
    dispatch.mockResolvedValue(accepted);

    const response = await withContext(request(app.getHttpServer()).post('/api/v1/transactions').send(validBody)).expect(
      201,
    );

    expect(response.body).toEqual({ id: 'tx-1', streamPosition: '42' });
    expect(response.headers[STREAM_POSITION_HEADER.toLowerCase()]).toBe('42');
  });

  it('carries the external_ref from the header into the dispatch context', async () => {
    dispatch.mockResolvedValue(accepted);

    await withContext(request(app.getHttpServer()).post('/api/v1/transactions').send(validBody))
      .set('X-External-Ref', 'ref-abc')
      .expect(201);

    expect(dispatch.mock.calls[0][1]).toMatchObject({ externalRef: 'ref-abc' });
  });

  it('returns 200 for an idempotent replay of the same external_ref', async () => {
    dispatch.mockResolvedValue({ ...accepted, idempotentReplay: true });

    const response = await withContext(request(app.getHttpServer()).post('/api/v1/transactions').send(validBody))
      .set('X-External-Ref', 'ref-abc')
      .expect(200);

    expect(response.body.streamPosition).toBe('42');
  });

  it('maps an unbalanced transaction to 422 with the stable code', async () => {
    dispatch.mockRejectedValue(new UnbalancedTransactionException('postings do not net to zero'));

    const response = await withContext(request(app.getHttpServer()).post('/api/v1/transactions').send(validBody)).expect(
      422,
    );

    expect(response.body).toMatchObject({ statusCode: 422, code: 'UNBALANCED_TRANSACTION' });
  });

  it('rejects a single-posting body with 400 (shape validation)', async () => {
    await withContext(
      request(app.getHttpServer())
        .post('/api/v1/transactions')
        .send({ ...validBody, postings: [validBody.postings[0]] }),
    ).expect(400);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('confirms via the action sub-resource with 200', async () => {
    dispatch.mockResolvedValue({ ...accepted, streamPosition: 43n });

    await withContext(request(app.getHttpServer()).post('/api/v1/transactions/tx-1/confirm').send({})).expect(200);

    expect(dispatch.mock.calls[0][0]).toMatchObject({ transactionId: 'tx-1' });
  });

  it('lists transactions, forwarding filters to the query bus', async () => {
    ask.mockResolvedValue({ items: [{ id: 'tx-1' }], total: 1 });

    const response = await withContext(
      request(app.getHttpServer()).get('/api/v1/transactions').query({ payee: 'Netflix', status: 'PENDING' }),
    ).expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(ask.mock.calls[0][0]).toMatchObject({ payee: 'Netflix' });
  });
});
