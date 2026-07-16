import { HttpException } from '@nestjs/common';

const GRPC_STATUS_ABORTED = 10;

export function getExceptionResponse(exception: HttpException) {
  return {
    code: GRPC_STATUS_ABORTED,
    message: exception.message,
    metadata: {
      exception: exception.constructor.name,
      status: exception.getStatus().toString(),
    },
  };
}
