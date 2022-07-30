import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  RpcExceptionFilter,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';
import { serialize } from 'class-transformer';
import { Metadata } from '@grpc/grpc-js';

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

export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const metadata = new Metadata();

    if (exception instanceof HttpException) {
      console.log('AllExceptionsFilter', exception.getResponse());

      metadata.add('statusCode', exception.getStatus().toString());
      metadata.add('message', exception.message);

      console.log(metadata);

      throw new RpcException({
        code: 1,
        message: exception.message,
        metadata: {
          statusCode: exception.getStatus(),
          message: exception.message,
        },
        // details: metadata,
      });
    }

    metadata.add('statusCode', HttpStatus.INTERNAL_SERVER_ERROR.toString());
    metadata.add('message', exception.message);

    console.log(metadata);

    throw new RpcException({
      code: 1,
      message: exception.message,
      details: metadata,
    });
  }
}
