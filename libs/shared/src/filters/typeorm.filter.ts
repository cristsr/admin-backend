import { Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { TypeORMError } from 'typeorm';
import { throwError } from 'rxjs';
import {
  GrpcCanceledException,
  GrpcInternalException,
  GrpcNotFoundException,
} from '@admin-back/shared';

@Catch(TypeORMError)
export class TypeormFilter implements ExceptionFilter {
  #logger = new Logger(TypeormFilter.name);

  catch(exception: TypeORMError) {
    this.#logger.error(`${exception.name}: ${exception.message}`);

    const grpcException = this.grpcExceptionMapper(exception);

    return throwError(() => grpcException.getResponse());
  }

  grpcExceptionMapper(exception: TypeORMError) {
    const mapped =
      GrpcExceptionMapper[exception.name] || GrpcExceptionMapper.Default;

    return new mapped.exception(mapped.message || exception.message);
  }
}

const GrpcExceptionMapper = {
  EntityNotFoundError: {
    exception: GrpcNotFoundException,
    message: 'Entity not found',
  },
  QueryFailedError: {
    exception: GrpcCanceledException,
    message: 'Query failed',
  },
  Default: {
    exception: GrpcInternalException,
    message: 'Internal server error',
  },
};
