import {
  ArgumentsHost,
  Catch,
  HttpException,
  Logger,
  RpcExceptionFilter,
} from '@nestjs/common';
import { BaseRpcExceptionFilter, RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

@Catch(RpcException)
export class RpcFilter implements RpcExceptionFilter<RpcException> {
  #logger = new Logger(RpcFilter.name);

  catch(exception: RpcException, host: ArgumentsHost): Observable<any> {
    throw new HttpException(exception.getError(), 500);

    return throwError(() => {
      this.#logger.error(exception.getError());
      return new HttpException(exception.getError(), 500);
    });
  }
}

export class AllExceptionsFilter extends BaseRpcExceptionFilter {
  #logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    this.#logger.error('AllExceptionsFilter', exception);
    console.error('AllExceptionsFilter', exception.code);
    console.error('AllExceptionsFilter', exception.details);

    throw new HttpException(exception.details, 500);

    return super.catch(exception, host);
  }
}
