import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Metadata } from '@grpc/grpc-js';
import { metaToPlain } from '../functions';

export const Context = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const metadata = ctx.switchToRpc().getContext();
    const values = metaToPlain(metadata);

    if (data) {
      return values[data];
    }

    return values;
  }
);

export const Headers = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const metadata: Metadata = ctx.switchToRpc().getContext();
    const values = metaToPlain(metadata);

    if (data) {
      return values.headers[data];
    }

    return values.headers;
  }
);
