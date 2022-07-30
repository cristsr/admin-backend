import { status } from '@grpc/grpc-js';

export class GrpcException extends Error {
  public readonly message: string;

  public constructor(
    public readonly code: number,
    private readonly error: string | object
  ) {
    super();
    this.message = error.toString();
  }
  public getError() {
    return this.error;
  }
}

export class GrpcCanceledException extends GrpcException {
  public constructor(error: string | object) {
    super(status.CANCELLED, error);
  }
}

export class GrpcUnkownException extends GrpcException {
  public constructor(error: string | object) {
    super(status.UNKNOWN, error);
  }
}

export class GrpcInvalidArgumentException extends GrpcException {
  public constructor(error: string | object) {
    super(status.INVALID_ARGUMENT, error);
  }
}

export class GrpcDeadlineExceededException extends GrpcException {
  public constructor(error: string | object) {
    super(status.DEADLINE_EXCEEDED, error);
  }
}

export class GrpcNotFoundException extends GrpcException {
  public constructor(error: string | object) {
    super(status.NOT_FOUND, error);
  }
}

export class GrpcAlreadyExistException extends GrpcException {
  public constructor(error: string | object) {
    super(status.ALREADY_EXISTS, error);
  }
}

export class GrpcPermissionDeniedException extends GrpcException {
  public constructor(error: string | object) {
    super(status.PERMISSION_DENIED, error);
  }
}

export class GrpcUnauthenticatedException extends GrpcException {
  public constructor(error: string | object) {
    super(status.UNAUTHENTICATED, error);
  }
}

export class GrpcRessourceExhaustedException extends GrpcException {
  public constructor(error: string | object) {
    super(status.RESOURCE_EXHAUSTED, error);
  }
}

export class GrpcFailedPreconditionException extends GrpcException {
  public constructor(error: string | object) {
    super(status.FAILED_PRECONDITION, error);
  }
}

export class GrpcAbortedException extends GrpcException {
  public constructor(error: string | object) {
    super(status.ABORTED, error);
  }
}

export class GrpcOutOfRangeException extends GrpcException {
  public constructor(error: string | object) {
    super(status.OUT_OF_RANGE, error);
  }
}

export class GrpcUnimplementedException extends GrpcException {
  public constructor(error: string | object) {
    super(status.UNIMPLEMENTED, error);
  }
}

export class GrpcInternalException extends GrpcException {
  public constructor(error: string | object) {
    super(status.CANCELLED, error);
  }
}

export class GrpcUnavailableException extends GrpcException {
  public constructor(error: string | object) {
    super(status.UNAVAILABLE, error);
  }
}

export class GrpcDataLossException extends GrpcException {
  public constructor(error: string | object) {
    super(status.DATA_LOSS, error);
  }
}
