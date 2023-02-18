import {
  Catch,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { status } from '@grpc/grpc-js';

@Catch()
export class RpcExceptionFilter {
  #logger = new Logger(RpcExceptionFilter.name);

  catch(exception: any): never {
    console.log('filter exception');

    // if (exception instanceof HttpException) {
    //   this.#logger.error(`${exception.constructor.name}: ${exception.message}`);
    //   throw exception;
    // }

    const message = exception.details || exception.message;

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

    this.#logger.error(`${exception.constructor.name}: ${exception}`);

    throw new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        error: InternalServerErrorException.name,
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
