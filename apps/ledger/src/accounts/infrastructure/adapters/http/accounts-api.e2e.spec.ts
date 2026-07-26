import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ExceptionFilter } from '@shared';
import request from 'supertest';
import {
  NameCollisionException,
  SystemAccountProtectedException,
} from '@ledger/accounts/domain/account/exceptions/account.exception';
import { LedgerCoreModule } from '@ledger/ledger/ledger-core.module';
import { STREAM_POSITION_HEADER, SharedHttpModule } from '@ledger/shared/infrastructure/adapters/http';
import { GATEWAY_CONTEXT_HEADER } from '@ledger/shared/infrastructure/adapters/http/resolvers/gateway-header-context.resolver';
import { CommandBus } from '@ledger/shared-kernel/application/command-bus/command-bus';
import { CommandResult } from '@ledger/shared-kernel/application/command-bus/command-result.type';
import { ReadModelStore } from '@ledger/shared-kernel/application/projection/read-model-store';
import { QueryBus } from '@ledger/shared-kernel/application/query-bus/query-bus';
import { EventStore } from '@ledger/shared-kernel/domain/ports/event-store';
import { AccountType } from '@ledger/shared-kernel/domain/value-objects';
import { AccountsHttpModule } from './accounts-http.module';

/**
 * End-to-end HTTP behaviour of the accounts + ledger adapters with the real
 * buses replaced by mocks. Covers initialization, read-your-writes and the
 * account-specific stable error codes (EP-2.4 / EP-2.6).
 */
describe('Accounts API (e2e, buses mocked)', () => {
  let app: INestApplication;
  const dispatch = jest.fn();
  const ask = jest.fn();

  const withContext = (req: request.Test): request.Test =>
    req.set(GATEWAY_CONTEXT_HEADER.userId, 'user-1').set(GATEWAY_CONTEXT_HEADER.clientId, 'frontend');

  const openBody = {
    type: AccountType.ASSETS,
    name: 'Assets:Bancolombia:Savings',
    currencies: ['COP'],
    openedOn: '2026-07-20',
    isBankMirror: true,
  };

  const accepted: CommandResult = { aggregateId: 'acc-1', streamPosition: 7n, idempotentReplay: false };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LedgerCoreModule, SharedHttpModule, AccountsHttpModule],
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

  it('rejects an unauthenticated open with 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/accounts').send(openBody).expect(401);
  });

  it('initializes the ledger and returns 201 with the stream position', async () => {
    dispatch.mockResolvedValue({ ...accepted, aggregateId: 'ledger-1' });

    const response = await withContext(
      request(app.getHttpServer())
        .post('/api/v1/ledger/initialize')
        .send({ presentationCurrency: 'COP', timezone: 'America/Bogota' }),
    ).expect(201);

    expect(response.body).toEqual({ id: 'ledger-1', streamPosition: '7' });
    expect(response.headers[STREAM_POSITION_HEADER.toLowerCase()]).toBe('7');
  });

  it('opens an account and it appears in the subsequent GET (read-your-writes)', async () => {
    dispatch.mockResolvedValue(accepted);
    await withContext(request(app.getHttpServer()).post('/api/v1/accounts').send(openBody)).expect(201);

    ask.mockResolvedValue({ view: 'tree', accounts: [{ id: 'acc-1', name: 'Assets:Bancolombia:Savings' }] });
    const response = await withContext(request(app.getHttpServer()).get('/api/v1/accounts')).expect(200);

    expect(response.body.accounts).toEqual([{ id: 'acc-1', name: 'Assets:Bancolombia:Savings' }]);
  });

  it('maps a duplicate account name to 409 NAME_COLLISION', async () => {
    dispatch.mockRejectedValue(new NameCollisionException('name already exists'));

    const response = await withContext(request(app.getHttpServer()).post('/api/v1/accounts').send(openBody)).expect(409);

    expect(response.body).toMatchObject({ statusCode: 409, code: 'NAME_COLLISION' });
  });

  it('maps closing a system account to 409 SYSTEM_ACCOUNT_PROTECTED', async () => {
    dispatch.mockRejectedValue(new SystemAccountProtectedException('cannot close a system account'));

    const response = await withContext(
      request(app.getHttpServer()).post('/api/v1/accounts/sys-1/close').send({ closedOn: '2026-07-20' }),
    ).expect(409);

    expect(response.body).toMatchObject({ statusCode: 409, code: 'SYSTEM_ACCOUNT_PROTECTED' });
  });
});
