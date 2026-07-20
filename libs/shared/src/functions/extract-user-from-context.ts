import { ExecutionContext, Logger } from '@nestjs/common';

/**
 * Reads the user the guard attached to the request. Non-HTTP contexts log an
 * error and return null instead of failing silently.
 */
export function extractUserFromContext<T>(ctx: ExecutionContext): T {
  if (ctx.getType() === 'http') {
    return ctx.switchToHttp().getRequest().user;
  }

  new Logger(extractUserFromContext.name).error(
    `Unable to extract user from a "${ctx.getType()}" context`,
  );

  return null;
}
