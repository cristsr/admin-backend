import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  RpcExceptionFilter,
} from '@nestjs/common';
import { BaseRpcExceptionFilter, RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { HttpAdapterHost } from '@nestjs/core';

@Catch(RpcException)
export class RpcFilter implements RpcExceptionFilter<RpcException> {
  #logger = new Logger(RpcFilter.name);

  catch(exception: RpcException, host: ArgumentsHost): Observable<any> {
    // throw new HttpException(exception.getError(), 500);

    return throwError((error) => {
      this.#logger.error(exception.getError());
      return error.getError();
    });
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  #logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly host: HttpAdapterHost) {}

  catch(exception: any, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();

    console.error('AllExceptionsFilter gateway', exception);

    console.error(exception.message);
    console.error(exception.code);
    console.error(exception.details);
    console.error(exception.metadata.get('statusCode'));

    if (exception instanceof BaseRpcExceptionFilter) {
      console.log('AllExceptionsFilter', exception);
      console.log('AllExceptionsFilter', exception);
    }

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : exception.details
        ? exception.details
        : 'Internal server error';

    const responseBody = {
      statusCode: httpStatus,
      timestamp: new Date().toISOString(),
      message,
      path: this.host.httpAdapter.getRequestUrl(ctx.getRequest()),
    };

    this.host.httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
