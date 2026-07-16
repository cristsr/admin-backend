import { ExecutionContext, Logger } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export function extractUserFromContext<T>(ctx: ExecutionContext): T {
  const logger = new Logger(extractUserFromContext.name);

  if (ctx.getType() === 'http') {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }

  if (ctx.getType<string>() === 'graphql') {
    const request = GqlExecutionContext.create(ctx).getContext().req;
    return request.user;
  }

  logger.error('Unable to extract user from context');

  return null;
}
