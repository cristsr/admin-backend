import { HttpException } from '@nestjs/common';
import { Metadata, status } from '@grpc/grpc-js';

export function getResponse(exception: HttpException) {
  const metadata = new Metadata();
  metadata.add('exception', exception.constructor.name);
  metadata.add('status', exception.getStatus().toString());

  return {
    code: status.ABORTED,
    message: exception.message,
    metadata,
  };
}
