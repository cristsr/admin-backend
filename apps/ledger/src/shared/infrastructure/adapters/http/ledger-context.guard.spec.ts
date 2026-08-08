import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Nullable } from '@shared';
import { LedgerContextResolver, RequestHeaders } from '@ledger/shared/application/ports/ledger-context-resolver.port';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { ContextCarryingRequest } from './context-carrying-request';
import { LedgerContextGuard } from './ledger-context.guard';

class StubResolver extends LedgerContextResolver {
  constructor(private readonly result: Nullable<LedgerContext>) {
    super();
  }

  resolve(_headers: RequestHeaders): Nullable<LedgerContext> {
    return this.result;
  }
}

describe('LedgerContextGuard', () => {
  const executionContext = (request: Partial<ContextCarryingRequest>, isPublic = false): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
      // The reflector reads metadata off these targets; a stub value is enough.
      __isPublic: isPublic,
    }) as unknown as ExecutionContext;

  const reflectorReturning = (isPublic: boolean): Reflector =>
    ({ getAllAndOverride: () => isPublic }) as unknown as Reflector;

  it('attaches the resolved context to the request when present', () => {
    const request: Partial<ContextCarryingRequest> = { headers: {} };
    const guard = new LedgerContextGuard(reflectorReturning(false), new StubResolver({ userId: 'u', clientId: 'c' }));

    expect(guard.canActivate(executionContext(request))).toBe(true);
    expect(request.ledgerContext).toEqual({ userId: 'u', clientId: 'c' });
  });

  it('rejects with 401 when the resolver yields no context', () => {
    const guard = new LedgerContextGuard(reflectorReturning(false), new StubResolver(null));

    expect(() => guard.canActivate(executionContext({ headers: {} }))).toThrow(UnauthorizedException);
  });

  it('bypasses the check for a @Public() route', () => {
    const request: Partial<ContextCarryingRequest> = { headers: {} };
    const guard = new LedgerContextGuard(reflectorReturning(true), new StubResolver(null));

    expect(guard.canActivate(executionContext(request, true))).toBe(true);
    expect(request.ledgerContext).toBeUndefined();
  });
});
