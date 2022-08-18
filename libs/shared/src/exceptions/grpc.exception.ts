import { Metadata, status } from '@grpc/grpc-js';

type RpcError = string | Record<string, any>;

export class GrpcException extends Error {
  status: number;
  response: string | object;

  constructor(readonly code: number, private readonly error: RpcError) {
    super();
  }

  getError() {
    return this.error;
  }

  getResponse() {
    const metadata = new Metadata();
    metadata.add('exception', this.constructor.name);

    const message = !this.error
      ? ''
      : typeof this.error === 'string'
      ? this.error
      : this.error.message;

    return {
      code: this.code,
      message,
      metadata,
    };
  }

  getStatus(): number {
    return this.status;
  }
}

export class GrpcCanceledException extends GrpcException {
  constructor(error: RpcError) {
    super(status.CANCELLED, error);
  }
}

export class GrpcUnkownException extends GrpcException {
  constructor(error: RpcError) {
    super(status.UNKNOWN, error);
  }
}

export class GrpcInvalidArgumentException extends GrpcException {
  constructor(error: RpcError) {
    super(status.INVALID_ARGUMENT, error);
  }
}

export class GrpcDeadlineExceededException extends GrpcException {
  constructor(error: RpcError) {
    super(status.DEADLINE_EXCEEDED, error);
  }
}

export class GrpcNotFoundException extends GrpcException {
  constructor(error: RpcError) {
    super(status.NOT_FOUND, error);
  }
}

export class GrpcAlreadyExistException extends GrpcException {
  constructor(error: RpcError) {
    super(status.ALREADY_EXISTS, error);
  }
}

export class GrpcPermissionDeniedException extends GrpcException {
  constructor(error: RpcError) {
    super(status.PERMISSION_DENIED, error);
  }
}

export class GrpcUnauthenticatedException extends GrpcException {
  constructor(error: RpcError) {
    super(status.UNAUTHENTICATED, error);
  }
}

export class GrpcRessourceExhaustedException extends GrpcException {
  constructor(error: RpcError) {
    super(status.RESOURCE_EXHAUSTED, error);
  }
}

export class GrpcFailedPreconditionException extends GrpcException {
  constructor(error: RpcError) {
    super(status.FAILED_PRECONDITION, error);
  }
}

export class GrpcAbortedException extends GrpcException {
  constructor(error: RpcError) {
    super(status.ABORTED, error);
  }
}

export class GrpcOutOfRangeException extends GrpcException {
  constructor(error: RpcError) {
    super(status.OUT_OF_RANGE, error);
  }
}

export class GrpcUnimplementedException extends GrpcException {
  constructor(error: RpcError) {
    super(status.UNIMPLEMENTED, error);
  }
}

export class GrpcUnavailableException extends GrpcException {
  constructor(error: RpcError) {
    super(status.UNAVAILABLE, error);
  }
}

export class GrpcDataLossException extends GrpcException {
  constructor(error: RpcError) {
    super(status.DATA_LOSS, error);
  }
}

export class GrpcInternalException extends GrpcException {
  constructor(error: RpcError) {
    super(status.CANCELLED, error);
  }
}
