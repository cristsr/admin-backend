import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { InterceptingCall, Metadata, RequesterBuilder } from '@grpc/grpc-js';
import { assignPlainToMeta, metaToPlain } from '../functions';
@Injectable()
export class GRPCInterceptor {
  constructor(@Inject(REQUEST) private request) {}
  interceptGrpcCall(options, nextCall): InterceptingCall {
    const requester = new RequesterBuilder()
      .withStart((metadata, listener, next) => {
        const newMetadata = new Metadata();

        const user = this.request.req.user;
        const headers = this.request.req.headers;

        newMetadata.set('user', JSON.stringify(user));
        newMetadata.set('headers', JSON.stringify(headers));

        const clientValues = metaToPlain(metadata);
        assignPlainToMeta(clientValues, newMetadata);

        next(newMetadata, listener);
      })
      .build();

    return new InterceptingCall(nextCall(options), requester);
  }
}
