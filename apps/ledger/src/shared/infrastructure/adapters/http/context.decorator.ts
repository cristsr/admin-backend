import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { LedgerContext } from '@ledger/shared/domain/context/ledger-context';
import { ContextCarryingRequest } from './context-carrying-request';

/**
 * Pure read of the {@link LedgerContext} the guard attached to the request.
 * Exported for direct unit testing.
 */
export function extractContext(ctx: ExecutionContext): LedgerContext {
  return ctx.switchToHttp().getRequest<ContextCarryingRequest>().ledgerContext as LedgerContext;
}

/**
 * Injects the {@link LedgerContext} the {@link LedgerContextGuard} attached to the
 * request. Only reachable on routes the guard protects, so the context is present.
 */
export const Context = createParamDecorator((_data: unknown, ctx: ExecutionContext): LedgerContext =>
  extractContext(ctx),
);
