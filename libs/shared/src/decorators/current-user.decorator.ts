import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    console.log('CurrentUser');
    if (ctx.getType() === 'http') {
      const request = ctx.switchToHttp().getRequest();
      return request.user;
    }

    if (ctx.getType<string>() === 'graphql') {
      const request = GqlExecutionContext.create(ctx).getContext().req;
      return request.user;
    }
  }
);
