import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';
import { BaseExceptionFilter } from '@nestjs/core';

// TODO refactor this for better integration with graphql
@Catch()
export class RpcExceptionFilter extends BaseExceptionFilter {
  #logger = new Logger(RpcExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const message = exception.details || exception.message;

    if (exception.constructor.name === 'BadRequestException') {
      throw exception;
    }

    if (exception.code === status.ABORTED) {
      const [error] = exception.metadata.get('exception');
      const [statusCode] = exception.metadata.get('status').map(Number);

      this.#logger.error(`${error}: ${message}`);

      throw new HttpException(
        {
          statusCode,
          message,
          error,
        },
        statusCode
      );
    }

    this.#logger.error(`${exception.constructor.name}: ${message}`);

    if (exception.constructor.name === 'Error') {
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message,
          error: InternalServerErrorException.name,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    // return exception;

    const e = new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        error: InternalServerErrorException.name,
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );

    super.catch(e, host);
  }
}
