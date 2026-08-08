import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommandResultInterceptor } from '@cqrs/infrastructure/adapters/http';
import { LedgerContextResolver } from '@ledger/shared/application/ports/ledger-context-resolver.port';
import { LedgerContextGuard } from './ledger-context.guard';
import { GatewayHeaderContextResolver } from './resolvers/gateway-header-context.resolver';

/**
 * Wires the cross-cutting HTTP kernel: the context resolver binding (swap this
 * one provider to change the auth mechanism — spec pregunta #5), the global
 * context guard enforced on every route, and the shared write-result
 * interceptor. Global so every feature module inherits them without re-importing.
 */
@Global()
@Module({
  providers: [
    { provide: LedgerContextResolver, useClass: GatewayHeaderContextResolver },
    { provide: APP_GUARD, useClass: LedgerContextGuard },
    CommandResultInterceptor,
  ],
  exports: [LedgerContextResolver, CommandResultInterceptor],
})
export class SharedHttpModule {}
