import {
  ArgumentsHost,
  Catch,
  HttpException,
  Logger,
  RpcExceptionFilter,
} from '@nestjs/common';
import { BaseRpcExceptionFilter, RpcException } from '@nestjs/microservices';
import { BaseExceptionFilter } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { serialize } from 'class-transformer';
import { Status } from '@admin-back/shared';

@Catch(RpcException)
export class RpcFilter implements RpcExceptionFilter<RpcException> {
  #logger = new Logger(RpcFilter.name);

  catch(exception: RpcException): Observable<any> {
    console.log('RpcFilter', exception);

    return throwError((error) => {
      console.error('RpcFilter', error);

      const response = {
        code: error.code,
        message: serialize(error.message),
      };

      this.#logger.error(response);

      return response;
    });
  }
}

export class AllExceptionsFilter extends BaseExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      console.log('AllExceptionsFilter', exception.getResponse());

      throw new RpcException({
        code: Status.INTERNAL,
        message: serialize(exception.getResponse()),
      });
    }
  }
}
