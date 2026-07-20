import { ExecutionContext, Logger } from '@nestjs/common';

/**
 * The authenticated user the guard attached to the request. HTTP is the only
 * transport this API speaks; anything else means the decorator was used
 * somewhere it cannot work, which is worth a log rather than a silent null.
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
