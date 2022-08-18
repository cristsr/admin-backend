import {
  ArgumentsHost,
  Catch,
  HttpException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { GrpcToHttpExceptionMap } from '../exceptions';

@Catch()
export class AllExceptionFilter extends BaseExceptionFilter {
  #logger = new Logger(AllExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    this.#logger.debug('Host type: ' + host.getType());

    // Handling http exception
    if (exception instanceof HttpException) {
      this.#logger.error(exception.message);
      return super.catch(exception, host);
    }

    this.#logger.error(exception.details);
    this.#logger.error(exception.metadata.get('exception'));

    const Exception =
      GrpcToHttpExceptionMap[exception.code] ?? InternalServerErrorException;

    return super.catch(new Exception(exception.details), host);
  }
}
