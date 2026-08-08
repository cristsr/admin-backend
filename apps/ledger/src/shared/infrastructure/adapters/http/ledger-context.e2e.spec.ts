import { Controller, Get, INestApplication, Post, VersioningType } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { Public } from '@shared';
import request from 'supertest';
import { LedgerContextResolver } from '@ledger/shared/application/ports/ledger-context-resolver.port';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { Context } from './context.decorator';
import { LedgerContextGuard } from './ledger-context.guard';
import { GatewayHeaderContextResolver } from './resolvers/gateway-header-context.resolver';


/** Dummy controller for testing the guard integration end-to-end. */
@Controller({ path: 'test', version: '1' })
class StubController {
  @Post('write')
  write(@Context() ctx: LedgerContext): { userId: string; clientId: string } {
    return { userId: ctx.userId, clientId: ctx.clientId };
  }

  @Get('health')
  @Public()
  health(): { ok: boolean } {
    return { ok: true };
  }
}

@Module({
  controllers: [StubController],
  providers: [
    Reflector,
    { provide: LedgerContextResolver, useClass: GatewayHeaderContextResolver },
    { provide: APP_GUARD, useClass: LedgerContextGuard },
  ],
})
class StubModule {}

describe('LedgerContextGuard (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [StubModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects POST without x-user-id with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/test/write')
      .set('x-client-id', 'frontend')
      .expect(401);
  });

  it('rejects POST without x-client-id with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/test/write')
      .set('x-user-id', 'user-1')
      .expect(401);
  });

  it('attaches context and lets the request through when both headers are present', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/test/write')
      .set('x-user-id', 'user-1')
      .set('x-client-id', 'frontend')
      .expect(201)
      .expect({ userId: 'user-1', clientId: 'frontend' });
  });

  it('lets @Public endpoints through without headers', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/test/health')
      .expect(200)
      .expect({ ok: true });
  });
});
