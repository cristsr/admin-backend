import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC } from '@shared';
import { LedgerContextResolver } from '@ledger/shared/application/ports/ledger-context-resolver.port';
import { ContextCarryingRequest } from './context-carrying-request';

/**
 * Enforced globally: no business route runs without an authenticated
 * `(user_id, client_id)` context. The resolver decides how the context is read;
 * a missing or malformed one is a 401. Endpoints marked `@Public()` (e.g. health)
 * bypass the check. The resolved context is attached to the request for the
 * `@Context()` decorator to inject downstream.
 */
@Injectable()
export class LedgerContextGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: LedgerContextResolver,
  ) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      executionContext.getHandler(),
      executionContext.getClass(),
    ]);

    if (isPublic) return true;

    const request = executionContext.switchToHttp().getRequest<ContextCarryingRequest>();
    const context = this.resolver.resolve(request.headers);

    if (!context) {
      throw new UnauthorizedException('Missing or invalid authenticated context');
    }

    request.ledgerContext = context;
    return true;
  }
}
