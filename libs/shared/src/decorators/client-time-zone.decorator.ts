import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const ClientTimeZone = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = GqlExecutionContext.create(ctx).getContext().req;
    return request.get('x-time-zone');
  }
);

export const Context = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    console.log('Headers', ctx.switchToRpc().getContext());

    // const request = ctx.switchToRpc().getContext();

    console.log('decorator');

    return 'test';
  }
);
