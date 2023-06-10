import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { extractUserFromContext } from '../functions/extract-user-from-context';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => extractUserFromContext(ctx)
);
