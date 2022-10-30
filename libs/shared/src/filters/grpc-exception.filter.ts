import {
  Catch,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { BaseRpcExceptionFilter } from '@nestjs/microservices';
import { status } from '@grpc/grpc-js';

@Catch()
export class RpcExceptionFilter extends BaseRpcExceptionFilter {
  #logger = new Logger(RpcExceptionFilter.name);

  catch(exception: any): never {
    this.#logger.error(exception.details);

    if (exception.code === status.ABORTED) {
      const { details, metadata } = exception;

      const statusCode = +metadata.get('status')[0];

      throw new HttpException(
        {
          statusCode,
          error: details,
        },
        statusCode
      );
    }

    throw new InternalServerErrorException(exception.details);
  }
}
