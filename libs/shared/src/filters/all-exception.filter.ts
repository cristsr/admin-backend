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

    console.debug(exception);

    // Handling http exception
    if (exception instanceof HttpException) {
      return super.catch(exception, host);
    }

    // const Exception =
    //   GrpcToHttpExceptionMap[exception.code] ?? InternalServerErrorException;

    return super.catch(exception, host);
  }
}
